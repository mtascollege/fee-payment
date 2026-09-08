const token = localStorage.getItem('token');
if (!token) window.location.href = '/index.html';

let students = [];

function authHeaders(extra = {}) {
  return Object.assign({ Authorization: 'Bearer ' + token }, extra);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: authHeaders(options.headers || {})
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
    return null;
  }
  return res;
}

async function loadStudents() {
  const res = await api('/api/students');
  if (!res) return;
  students = await res.json();
  renderStats();
  renderTable();
}

function renderStats() {
  const totalFee = students.reduce((s, x) => s + x.totalFee, 0);
  const totalPaid = students.reduce((s, x) => s + x.totalPaid, 0);
  const totalDue = students.reduce((s, x) => s + x.due, 0);
  const pendingCount = students.filter(s => s.status !== 'Paid').length;

  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="label">Total Students</div><div class="value">${students.length}</div></div>
    <div class="stat-card"><div class="label">Total Fee</div><div class="value">₹${totalFee.toLocaleString()}</div></div>
    <div class="stat-card"><div class="label">Collected</div><div class="value" style="color:#16a34a">₹${totalPaid.toLocaleString()}</div></div>
    <div class="stat-card"><div class="label">Outstanding</div><div class="value" style="color:#dc2626">₹${totalDue.toLocaleString()}</div></div>
    <div class="stat-card"><div class="label">Pending Students</div><div class="value">${pendingCount}</div></div>
  `;
}

function renderTable() {
  const search = document.getElementById('search').value.toLowerCase();
  const rows = students
    .filter(s => s.name.toLowerCase().includes(search) || s.rollNo.toLowerCase().includes(search))
    .map(s => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.rollNo)}</td>
        <td>${escapeHtml(s.department)} ${escapeHtml(s.year)}</td>
        <td>₹${s.totalFee.toLocaleString()}</td>
        <td>₹${s.totalPaid.toLocaleString()}</td>
        <td>₹${s.due.toLocaleString()}</td>
        <td><span class="badge ${s.status}">${s.status}</span></td>
        <td class="row-actions">
          <button onclick="openPaymentModal('${s.id}')">Record Payment</button>
          <button onclick="viewReceipts('${s.id}')">Receipts</button>
          <button onclick="editStudent('${s.id}')">Edit</button>
          <button class="danger" onclick="deleteStudent('${s.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  document.getElementById('studentRows').innerHTML = rows || '<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:30px">No students found. Click "Add Student" to get started.</td></tr>';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.getElementById('search').addEventListener('input', renderTable);

// ---- Add / Edit Student ----
function openStudentModal() {
  document.getElementById('studentModal').classList.remove('hidden');
}
function closeStudentModal() {
  document.getElementById('studentModal').classList.add('hidden');
  document.getElementById('studentId').value = '';
  document.getElementById('sName').value = '';
  document.getElementById('sRollNo').value = '';
  document.getElementById('sDept').value = '';
  document.getElementById('sYear').value = '';
  document.getElementById('sTotalFee').value = '';
  document.getElementById('studentModalTitle').textContent = 'Add Student';
}
document.getElementById('addStudentBtn').addEventListener('click', openStudentModal);

function editStudent(id) {
  const s = students.find(x => x.id === id);
  if (!s) return;
  document.getElementById('studentId').value = s.id;
  document.getElementById('sName').value = s.name;
  document.getElementById('sRollNo').value = s.rollNo;
  document.getElementById('sDept').value = s.department;
  document.getElementById('sYear').value = s.year;
  document.getElementById('sTotalFee').value = s.totalFee;
  document.getElementById('studentModalTitle').textContent = 'Edit Student';
  openStudentModal();
}

async function saveStudent() {
  const id = document.getElementById('studentId').value;
  const body = {
    name: document.getElementById('sName').value.trim(),
    rollNo: document.getElementById('sRollNo').value.trim(),
    department: document.getElementById('sDept').value.trim(),
    year: document.getElementById('sYear').value.trim(),
    totalFee: Number(document.getElementById('sTotalFee').value || 0)
  };
  if (!body.name || !body.rollNo) { alert('Name and Roll Number are required'); return; }

  const res = id
    ? await api(`/api/students/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    : await api('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  if (res && res.ok) {
    closeStudentModal();
    loadStudents();
  } else {
    alert('Failed to save student');
  }
}

async function deleteStudent(id) {
  if (!confirm('Delete this student and all their payment records?')) return;
  const res = await api(`/api/students/${id}`, { method: 'DELETE' });
  if (res && res.ok) loadStudents();
}

// ---- Payments ----
function openPaymentModal(studentId) {
  document.getElementById('paymentStudentId').value = studentId;
  document.getElementById('pAmount').value = '';
  document.getElementById('pMode').value = 'Cash';
  document.getElementById('pDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('pNote').value = '';
  document.getElementById('paymentModal').classList.remove('hidden');
}
function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
}

async function savePayment() {
  const studentId = document.getElementById('paymentStudentId').value;
  const body = {
    amount: Number(document.getElementById('pAmount').value || 0),
    mode: document.getElementById('pMode').value,
    date: document.getElementById('pDate').value,
    note: document.getElementById('pNote').value.trim()
  };
  if (!body.amount || body.amount <= 0) { alert('Enter a valid amount'); return; }

  const res = await api(`/api/students/${studentId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res && res.ok) {
    closePaymentModal();
    await loadStudents();
    const student = students.find(s => s.id === studentId);
    const lastPayment = student.payments[student.payments.length - 1];
    if (confirm('Payment recorded! Print receipt now?')) {
      printReceipt(student, lastPayment);
    }
  } else {
    alert('Failed to record payment');
  }
}

function viewReceipts(studentId) {
  const student = students.find(s => s.id === studentId);
  if (!student) return;
  if (student.payments.length === 0) { alert('No payments recorded yet for this student.'); return; }
  const list = student.payments.map(p => `${p.date} — ₹${p.amount} (${p.mode}) [${p.receiptNo}]`).join('\n');
  const choice = prompt(`Payments for ${student.name}:\n\n${list}\n\nType a receipt number to print, or Cancel.`);
  if (choice) {
    const payment = student.payments.find(p => p.receiptNo === choice.trim());
    if (payment) printReceipt(student, payment);
    else alert('Receipt number not found.');
  }
}

function printReceipt(student, payment) {
  const w = window.open('', '_blank', 'width=500,height=650');
  w.document.write(`
    <html>
    <head>
      <title>Receipt ${payment.receiptNo}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #1f2937; }
        h1 { font-size: 20px; margin-bottom: 0; }
        .sub { color: #6b7280; margin-top: 4px; }
        table { width: 100%; margin-top: 20px; border-collapse: collapse; }
        td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .label { color: #6b7280; }
        .amount { font-size: 24px; font-weight: bold; margin-top: 20px; }
        .footer { margin-top: 40px; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <h1>Fee Payment Receipt</h1>
      <div class="sub">Receipt No: ${payment.receiptNo}</div>
      <table>
        <tr><td class="label">Student Name</td><td>${escapeHtml(student.name)}</td></tr>
        <tr><td class="label">Roll Number</td><td>${escapeHtml(student.rollNo)}</td></tr>
        <tr><td class="label">Department / Year</td><td>${escapeHtml(student.department)} ${escapeHtml(student.year)}</td></tr>
        <tr><td class="label">Payment Date</td><td>${payment.date}</td></tr>
        <tr><td class="label">Payment Mode</td><td>${payment.mode}</td></tr>
        <tr><td class="label">Note</td><td>${escapeHtml(payment.note || '-')}</td></tr>
      </table>
      <div class="amount">Amount Paid: ₹${payment.amount.toLocaleString()}</div>
      <div class="footer">This is a computer-generated receipt.</div>
      <script>window.print();</script>
    </body>
    </html>
  `);
  w.document.close();
}

// ---- Export / Logout ----
document.getElementById('exportBtn').addEventListener('click', () => {
  window.open('/api/export.csv?token=' + token, '_blank');
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  localStorage.removeItem('token');
  window.location.href = '/index.html';
});

loadStudents();
