# College Fee Collection Tracker (100% Free)

A simple web app to track student fee payments — no payment gateway, no paid
services, no database server required. Built with plain Node.js and vanilla
HTML/CSS/JS so there's nothing extra to install.

## What it does

- Add/edit/delete students (name, roll number, department, year, total fee)
- Record offline payments (cash, bank transfer, UPI, cheque) against a student
- Auto-calculates paid amount, due amount, and status (Paid / Partial / Pending)
- Generates a printable receipt after each payment
- Dashboard with totals: total fee, collected, outstanding, pending count
- Search students by name or roll number
- Export the whole fee report as a CSV file
- Single admin login (password-protected)

All data is stored in a plain file: `data/db.json`. No SQL, no external database.

## 1. Run it on your own computer

You need [Node.js](https://nodejs.org) installed (version 18 or newer) — that's it.

```bash
cd fee-app
node server.js
```

Open **http://localhost:3000** in your browser.

**Default admin password:** `admin123`
Change it by setting an environment variable before starting the app:

```bash
ADMIN_PASSWORD=your_new_password node server.js
```

## 2. Deploy it online for free (so students/admin can access it from anywhere)

### Option A: Render.com (recommended, easiest)

1. Create a free account at https://render.com
2. Push this folder to a GitHub repository (create one at github.com if you don't have one)
3. On Render, click **New +** → **Web Service** → connect your GitHub repo
4. Settings:
   - **Build Command:** (leave blank)
   - **Start Command:** `node server.js`
5. Add an environment variable: `ADMIN_PASSWORD` = your chosen password
6. Click **Create Web Service**. Render gives you a free URL like
   `https://your-app.onrender.com`

**Important:** Render's free tier does not keep a permanent disk by default,
so `data/db.json` may reset when the service restarts/sleeps. For a real
college deployment with data that must never be lost, add a free "Persistent
Disk" (Render offers a small free disk on some plans) or upgrade later to a
real database — see "Next steps" below.

### Option B: Railway.app

1. Create a free account at https://railway.app
2. New Project → Deploy from GitHub repo
3. Railway auto-detects Node.js and runs `node server.js`
4. Add `ADMIN_PASSWORD` under Variables
5. Railway gives you a public URL

### Option C: Run it on a college computer/server permanently

If you have access to any always-on PC in the college (e.g., an admin office
computer), just run `node server.js` there and connect it to the local network
(Wi-Fi/LAN) — other computers in college can reach it at
`http://<that-computer's-IP>:3000`. This avoids reliability issues with free
hosting tiers "sleeping."

## 3. File structure

```
fee-app/
  server.js          → backend (all logic, no dependencies)
  package.json
  data/
    db.json          → your data (auto-created on first run)
  public/
    index.html        → login page
    dashboard.html     → admin dashboard
    app.js             → dashboard logic
    style.css
```

## 4. Security notes before going live

- **Change `admin123`** immediately — set `ADMIN_PASSWORD` as shown above.
- This app has a single shared admin login. If multiple staff need separate
  logins/roles, that's a good next feature to add.
- Back up `data/db.json` regularly (just copy the file) — it's your entire database.
- Serve over HTTPS in production — Render/Railway do this automatically.

## 5. Possible next steps (all still free)

- Add student self-login so students can see only their own dues
- Switch `data/db.json` to a free PostgreSQL database (Render/Supabase free tier)
  once you have hundreds of students, for better reliability
- Add email reminders for pending dues (free tier of Resend/Brevo)
- Add multiple admin accounts with roles

---
Built with plain Node.js — no npm install needed, no paid services required.
