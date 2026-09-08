/**
 * College Fee Collection Tracker
 * -------------------------------
 * A zero-dependency Node.js app (no npm install needed).
 * Data is stored in data/db.json (a simple JSON file — no database server required).
 *
 * HOW TO RUN:
 *   node server.js
 * Then open http://localhost:3000 in your browser.
 *
 * HOW TO DEPLOY FOR FREE:
 *   See README.md for step-by-step instructions (Render.com free tier).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---- CHANGE THIS PASSWORD BEFORE DEPLOYING ----
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
// ------------------------------------------------

// In-memory session tokens (fine for a small single-admin college app)
const sessions = new Set();

// ---------- Data helpers ----------
function loadDB() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { students: [] };
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function getToken(req, parsedQuery) {
  const auth = req.headers['authorization'] || '';
  const headerToken = auth.replace('Bearer ', '').trim();
  if (headerToken) return headerToken;
  if (parsedQuery && parsedQuery.token) return parsedQuery.token;
  return '';
}

function requireAuth(req, res, parsedQuery) {
  const token = getToken(req, parsedQuery);
  if (!token || !sessions.has(token)) {
    sendJSON(res, 401, { error: 'Not authenticated' });
    return false;
  }
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Serve static files from /public
function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);

  // prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function studentDue(student) {
  const paid = student.payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    ...student,
    totalPaid: paid,
    due: student.totalFee - paid,
    status: paid >= student.totalFee ? 'Paid' : paid > 0 ? 'Partial' : 'Pending'
  };
}

// ---------- Request handler ----------
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ---- Auth ----
  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req).catch(() => ({}));
    if (body.password === ADMIN_PASSWORD) {
      const token = crypto.randomBytes(24).toString('hex');
      sessions.add(token);
      return sendJSON(res, 200, { token });
    }
    return sendJSON(res, 401, { error: 'Wrong password' });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    sessions.delete(getToken(req, parsed.query));
    return sendJSON(res, 200, { ok: true });
  }

  // ---- Students CRUD ----
  if (pathname === '/api/students' && req.method === 'GET') {
    if (!requireAuth(req, res, parsed.query)) return;
    const db = loadDB();
    return sendJSON(res, 200, db.students.map(studentDue));
  }

  if (pathname === '/api/students' && req.method === 'POST') {
    if (!requireAuth(req, res, parsed.query)) return;
    const body = await readBody(req).catch(() => null);
    if (!body || !body.name || !body.rollNo || body.totalFee == null) {
      return sendJSON(res, 400, { error: 'name, rollNo, and totalFee are required' });
    }
    const db = loadDB();
    const student = {
      id: crypto.randomUUID(),
      name: body.name,
      rollNo: body.rollNo,
      department: body.department || '',
      year: body.year || '',
      totalFee: Number(body.totalFee),
      payments: []
    };
    db.students.push(student);
    saveDB(db);
    return sendJSON(res, 201, studentDue(student));
  }

  const studentMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
  if (studentMatch && req.method === 'PUT') {
    if (!requireAuth(req, res, parsed.query)) return;
    const db = loadDB();
    const student = db.students.find(s => s.id === studentMatch[1]);
    if (!student) return sendJSON(res, 404, { error: 'Student not found' });
    const body = await readBody(req).catch(() => ({}));
    Object.assign(student, {
      name: body.name ?? student.name,
      rollNo: body.rollNo ?? student.rollNo,
      department: body.department ?? student.department,
      year: body.year ?? student.year,
      totalFee: body.totalFee != null ? Number(body.totalFee) : student.totalFee
    });
    saveDB(db);
    return sendJSON(res, 200, studentDue(student));
  }

  if (studentMatch && req.method === 'DELETE') {
    if (!requireAuth(req, res, parsed.query)) return;
    const db = loadDB();
    db.students = db.students.filter(s => s.id !== studentMatch[1]);
    saveDB(db);
    return sendJSON(res, 200, { ok: true });
  }

  // ---- Payments ----
  const paymentMatch = pathname.match(/^\/api\/students\/([^/]+)\/payments$/);
  if (paymentMatch && req.method === 'POST') {
    if (!requireAuth(req, res, parsed.query)) return;
    const db = loadDB();
    const student = db.students.find(s => s.id === paymentMatch[1]);
    if (!student) return sendJSON(res, 404, { error: 'Student not found' });
    const body = await readBody(req).catch(() => null);
    if (!body || !body.amount) return sendJSON(res, 400, { error: 'amount is required' });
    const payment = {
      id: crypto.randomUUID(),
      amount: Number(body.amount),
      mode: body.mode || 'Cash',
      date: body.date || new Date().toISOString().slice(0, 10),
      note: body.note || '',
      receiptNo: 'RCPT-' + Date.now().toString().slice(-8)
    };
    student.payments.push(payment);
    saveDB(db);
    return sendJSON(res, 201, studentDue(student));
  }

  const deletePaymentMatch = pathname.match(/^\/api\/students\/([^/]+)\/payments\/([^/]+)$/);
  if (deletePaymentMatch && req.method === 'DELETE') {
    if (!requireAuth(req, res, parsed.query)) return;
    const db = loadDB();
    const student = db.students.find(s => s.id === deletePaymentMatch[1]);
    if (!student) return sendJSON(res, 404, { error: 'Student not found' });
    student.payments = student.payments.filter(p => p.id !== deletePaymentMatch[2]);
    saveDB(db);
    return sendJSON(res, 200, studentDue(student));
  }

  // ---- CSV export ----
  if (pathname === '/api/export.csv' && req.method === 'GET') {
    if (!requireAuth(req, res, parsed.query)) return;
    const db = loadDB();
    const rows = [['Name', 'Roll No', 'Department', 'Year', 'Total Fee', 'Paid', 'Due', 'Status']];
    db.students.map(studentDue).forEach(s => {
      rows.push([s.name, s.rollNo, s.department, s.year, s.totalFee, s.totalPaid, s.due, s.status]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="fee_report.csv"'
    });
    return res.end(csv);
  }

  // ---- Static files (frontend) ----
  if (req.method === 'GET') {
    return serveStatic(req, res, pathname);
  }

  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Fee collection app running at http://localhost:${PORT}`);
  console.log(`Admin password: ${ADMIN_PASSWORD} (change this via ADMIN_PASSWORD env var before deploying!)`);
});
