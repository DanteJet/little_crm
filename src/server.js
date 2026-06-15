import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { db, initDb } from './db.js';
import { hashPassword, verifyPassword, parseCookies, sign } from './security.js';
import { adminDashboard, adminUserForm, adminUsersPage, home, login, membershipTypeForm, membershipTypesPage, studentCabinet, studentDetails, studentForm, studentsPage, subscriptionsPage } from './views.js';

initDb();
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const sessions = new Map();

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...headers });
  res.end(body);
}
function redirect(res, location) { send(res, 302, '', { Location: location }); }
function notFound(res) { send(res, 404, '<h1>404</h1>'); }
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
}
async function multiBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const params = new URLSearchParams(Buffer.concat(chunks).toString());
  const result = Object.fromEntries(params);
  result.student_ids = params.getAll('student_ids').map(Number).filter(Boolean);
  return result;
}
function currentUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.sid;
  if (!token) return null;
  const [id, mac] = token.split('.');
  if (!id || sign(id, SECRET) !== mac) return null;
  const session = sessions.get(id);
  if (!session) return null;
  return db.prepare('SELECT id, login, role, full_name FROM users WHERE id=?').get(session.userId) || null;
}
function setSession(res, userId) {
  const id = randomUUID();
  sessions.set(id, { userId, createdAt: Date.now() });
  return `sid=${encodeURIComponent(`${id}.${sign(id, SECRET)}`)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`;
}
function requireRole(res, user, role) {
  if (!user) { redirect(res, '/login'); return false; }
  if (role && user.role !== role) { send(res, 403, '<h1>Нет доступа</h1>'); return false; }
  return true;
}
function monthRange() {
  const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
  const end = new Date(start); end.setMonth(end.getMonth() + 1);
  return [start.toISOString(), end.toISOString()];
}
function weekBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0,0,0,0);
  const day = start.getDay();
  const daysFromMonday = (day + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return [start, end];
}
function periodRange(view) {
  const start = new Date(); start.setHours(0,0,0,0);
  if (view === 'month') {
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return [start.toISOString(), end.toISOString()];
  }
  const [weekStart, weekEnd] = weekBounds(start);
  return [weekStart.toISOString(), weekEnd.toISOString()];
}
function publicLessons() {
  const [start, end] = monthRange();
  return db.prepare(`SELECT l.starts_at, COUNT(ls.student_id) AS count FROM lessons l LEFT JOIN lesson_students ls ON ls.lesson_id=l.id WHERE l.starts_at>=? AND l.starts_at<? GROUP BY l.id ORDER BY l.starts_at`).all(start, end);
}
const allTypes = () => db.prepare('SELECT * FROM membership_types WHERE is_active=1 ORDER BY price, visits').all();
const studentRows = () => db.prepare(`SELECT s.*, mt.name AS membership_name, sub.total_visits, sub.remaining_visits, sub.paid_status, (sub.total_visits - sub.remaining_visits) AS used_visits FROM students s LEFT JOIN membership_types mt ON mt.id=s.membership_type_id LEFT JOIN subscriptions sub ON sub.id=(SELECT id FROM subscriptions WHERE student_id=s.id ORDER BY created_at DESC, id DESC LIMIT 1) ORDER BY s.full_name`).all();
function upcomingBirthdays() {
  const rows = db.prepare('SELECT id, full_name, birth_date FROM students').all();
  const today = new Date(); today.setHours(0,0,0,0);
  return rows.map((s) => {
    const b = new Date(s.birth_date); const next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
    if (next < today) next.setFullYear(next.getFullYear() + 1);
    const days = Math.round((next - today) / 86400000);
    return { ...s, next_birthday: next.toISOString(), days };
  }).filter((s) => s.days <= 14).sort((a,b) => a.days - b.days);
}
function lessonRows(view) {
  const [start, end] = periodRange(view);
  return db.prepare(`SELECT l.*, COUNT(ls.student_id) AS count, group_concat(s.full_name, ', ') AS students FROM lessons l LEFT JOIN lesson_students ls ON ls.lesson_id=l.id LEFT JOIN students s ON s.id=ls.student_id WHERE l.starts_at>=? AND l.starts_at<? GROUP BY l.id ORDER BY l.starts_at`).all(start, end);
}
function studentSummary(id) {
  return db.prepare(`SELECT s.*, mt.name AS membership_name, mt.price AS membership_price, sub.id AS subscription_id, sub.total_visits, sub.remaining_visits, sub.paid_status FROM students s LEFT JOIN membership_types mt ON mt.id=s.membership_type_id LEFT JOIN subscriptions sub ON sub.id=(SELECT id FROM subscriptions WHERE student_id=s.id ORDER BY created_at DESC, id DESC LIMIT 1) WHERE s.id=?`).get(id);
}
function latestSub(id) { return db.prepare('SELECT * FROM subscriptions WHERE student_id=? ORDER BY created_at DESC, id DESC LIMIT 1').get(id); }
function latestSubWithType(id) {
  return db.prepare(`SELECT sub.*, mt.price, mt.name, mt.visits
    FROM subscriptions sub
    JOIN membership_types mt ON mt.id=sub.membership_type_id
    WHERE sub.student_id=?
    ORDER BY sub.created_at DESC, sub.id DESC
    LIMIT 1`).get(id);
}
function recordSubscriptionPayment(studentId, method = 'cash', comment = 'Оплата проставлена администратором') {
  const sub = latestSubWithType(studentId);
  if (!sub) return null;
  const result = db.prepare('INSERT INTO payments (student_id, subscription_id, amount, method, comment) VALUES (?, ?, ?, ?, ?)')
    .run(studentId, sub.id, sub.price, method, comment);
  db.prepare("UPDATE subscriptions SET paid_status='paid' WHERE id=?").run(sub.id);
  resetSubscriptionVisitsIfEmpty(studentId);
  return result;
}
function updateAdmin(adminId, data) {
  const login = String(data.login || '').trim();
  const fullName = String(data.full_name || '').trim();
  if (!login || !fullName) return;
  if (data.password) {
    db.prepare('UPDATE users SET login=?, full_name=?, password_hash=? WHERE id=? AND role=\'admin\'')
      .run(login, fullName, hashPassword(data.password), adminId);
  } else {
    db.prepare('UPDATE users SET login=?, full_name=? WHERE id=? AND role=\'admin\'')
      .run(login, fullName, adminId);
  }
}
function deleteAdmin(adminId, currentAdminId) {
  if (adminId === currentAdminId) return false;
  const count = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get().count;
  if (count <= 1) return false;
  db.prepare("DELETE FROM users WHERE id=? AND role='admin'").run(adminId);
  return true;
}

function parseMoscowDateTimeLocal(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return new Date(value);
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
}

function createSubscription(studentId, typeId, remainingVisits = null, paidStatus = 'unpaid') {
  const t = db.prepare('SELECT * FROM membership_types WHERE id=?').get(typeId);
  if (!t) return null;
  return db.prepare('INSERT INTO subscriptions (student_id, membership_type_id, total_visits, remaining_visits, paid_status) VALUES (?, ?, ?, ?, ?)')
    .run(studentId, typeId, t.visits, remainingVisits ?? t.visits, paidStatus);
}

function resetSubscriptionVisitsIfEmpty(studentId) {
  const sub = latestSubWithType(studentId);
  if (!sub || sub.remaining_visits !== 0) return sub;
  db.prepare('UPDATE subscriptions SET remaining_visits=?, total_visits=? WHERE id=?')
    .run(sub.visits, sub.visits, sub.id);
  return { ...sub, total_visits: sub.visits, remaining_visits: sub.visits };
}

function addLesson(data) {
  const insert = db.prepare('INSERT INTO lessons (starts_at, duration_minutes, comment) VALUES (?, ?, ?)');
  const findExisting = db.prepare('SELECT id, comment FROM lessons WHERE starts_at=? ORDER BY id LIMIT 1');
  const fillComment = db.prepare("UPDATE lessons SET comment=? WHERE id=? AND trim(COALESCE(comment, ''))=''");
  const link = db.prepare('INSERT OR IGNORE INTO lesson_students (lesson_id, student_id) VALUES (?, ?)');
  const starts = parseMoscowDateTimeLocal(data.starts_at);
  const dates = [new Date(starts)];
  if (data.repeat_month) {
    const d = new Date(starts);
    const end = new Date(starts); end.setMonth(end.getMonth() + 1);
    while (true) {
      d.setDate(d.getDate() + 7);
      if (d > end) break;
      dates.push(new Date(d));
    }
  }
  db.exec('BEGIN');
  try {
    for (const date of dates) {
      const startsAt = date.toISOString();
      const existing = findExisting.get(startsAt);
      const lessonId = existing?.id || insert.run(startsAt, Number(data.duration_minutes || 60), data.comment || '').lastInsertRowid;
      if (existing && data.comment) fillComment.run(data.comment, lessonId);
      for (const sid of data.student_ids) link.run(lessonId, sid);
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function markAttendance(studentId, lessonId = null, admin = null) {
  let sub = latestSub(studentId);
  db.exec('BEGIN');
  try {
    if (sub && sub.remaining_visits > 0) {
      const nextRemaining = sub.remaining_visits - 1;
      db.prepare('UPDATE subscriptions SET remaining_visits=?, paid_status=? WHERE id=?').run(nextRemaining, nextRemaining === 0 ? 'unpaid' : sub.paid_status, sub.id);
    } else {
      const student = db.prepare('SELECT membership_type_id FROM students WHERE id=?').get(studentId);
      if (student?.membership_type_id) {
        createSubscription(studentId, student.membership_type_id, null, 'unpaid');
        sub = latestSub(studentId);
        if (sub) {
          const nextRemaining = Math.max(sub.total_visits - 1, 0);
          db.prepare('UPDATE subscriptions SET remaining_visits=?, paid_status=? WHERE id=?').run(nextRemaining, nextRemaining === 0 ? 'unpaid' : sub.paid_status, sub.id);
        }
      } else if (sub) {
        db.prepare("UPDATE subscriptions SET paid_status='unpaid' WHERE id=?").run(sub.id);
      }
    }
    if (lessonId) db.prepare("UPDATE lesson_students SET status='visited' WHERE lesson_id=? AND student_id=?").run(lessonId, studentId);
    db.prepare('INSERT INTO attendance_log (student_id, lesson_id, admin_user_id, note) VALUES (?, ?, ?, ?)').run(studentId, lessonId, admin?.id || null, 'Занятие проставлено администратором');
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const user = currentUser(req);
  if (url.pathname.startsWith('/public/')) {
    const file = join(process.cwd(), url.pathname);
    if (!existsSync(file)) return notFound(res);
    const types = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    return res.end(readFileSync(file));
  }
  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, home({ user, publicLessons: publicLessons(), membershipTypes: allTypes() }));
  if (req.method === 'GET' && url.pathname === '/login') return send(res, 200, login({}));
  if (req.method === 'POST' && url.pathname === '/login') {
    const form = await body(req); const found = db.prepare('SELECT * FROM users WHERE login=?').get(form.login);
    if (!found || !verifyPassword(form.password, found.password_hash)) return send(res, 401, login({ error: 'Неверный логин или пароль' }));
    return send(res, 302, '', { Location: found.role === 'admin' ? '/admin' : '/student', 'Set-Cookie': setSession(res, found.id) });
  }
  if (req.method === 'POST' && url.pathname === '/logout') return send(res, 302, '', { Location: '/', 'Set-Cookie': 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });

  if (url.pathname.startsWith('/admin')) {
    if (!requireRole(res, user, 'admin')) return;
    if (req.method === 'GET' && url.pathname === '/admin') {
      const view = url.searchParams.get('view') === 'month' ? 'month' : 'week';
      return send(res, 200, adminDashboard({ user, lessons: lessonRows(view), students: studentRows(), birthdays: upcomingBirthdays(), view }));
    }
    if (req.method === 'POST' && url.pathname === '/admin/lessons') { const form = await multiBody(req); addLesson(form); return redirect(res, `/admin?view=${form.repeat_month ? 'month' : 'week'}`); }
    if (req.method === 'GET' && url.pathname === '/admin/admins') return send(res, 200, adminUsersPage({ user, admins: db.prepare("SELECT id, login, full_name, created_at FROM users WHERE role='admin' ORDER BY created_at DESC").all() }));
    if (req.method === 'POST' && url.pathname === '/admin/admins') { const f = await body(req); db.prepare('INSERT INTO users (login, password_hash, role, full_name) VALUES (?, ?, ?, ?)').run(f.login, hashPassword(f.password), 'admin', f.full_name); return redirect(res, '/admin/admins'); }
    const adminMatch = url.pathname.match(/^\/admin\/admins\/(\d+)\/(edit|delete)$/);
    if (adminMatch) {
      const adminId = Number(adminMatch[1]); const action = adminMatch[2];
      if (req.method === 'GET' && action === 'edit') { const admin = db.prepare("SELECT id, login, full_name FROM users WHERE id=? AND role='admin'").get(adminId); if (!admin) return notFound(res); return send(res, 200, adminUserForm({ user, admin })); }
      if (req.method === 'POST' && action === 'edit') { const f = await body(req); updateAdmin(adminId, f); return redirect(res, '/admin/admins'); }
      if (req.method === 'POST' && action === 'delete') { deleteAdmin(adminId, user.id); return redirect(res, '/admin/admins'); }
    }
    if (req.method === 'GET' && url.pathname === '/admin/students') return send(res, 200, studentsPage({ user, students: studentRows() }));
    if (req.method === 'GET' && url.pathname === '/admin/students/new') return send(res, 200, studentForm({ user, types: allTypes() }));
    if (req.method === 'POST' && url.pathname === '/admin/students') {
      const f = await body(req);
      db.exec('BEGIN');
      try {
        const u = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)').run(f.login, hashPassword(f.password), 'student');
        const s = db.prepare('INSERT INTO students (user_id, full_name, birth_date, student_type, membership_type_id, comment, consent_received) VALUES (?, ?, ?, ?, ?, ?, ?)').run(u.lastInsertRowid, f.full_name, f.birth_date, f.student_type, Number(f.membership_type_id), f.comment || '', f.consent_received ? 1 : 0);
        createSubscription(s.lastInsertRowid, Number(f.membership_type_id)); db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
      return redirect(res, '/admin/students');
    }
    const m = url.pathname.match(/^\/admin\/students\/(\d+)(?:\/(edit|attendance|payment-status|payments))?$/);
    if (m) {
      const id = Number(m[1]); const action = m[2];
      if (req.method === 'GET' && !action) return send(res, 200, studentDetails({ user, student: studentSummary(id), visits: db.prepare(`SELECT al.*, COALESCE(NULLIF(u.full_name, ''), u.login) AS admin_name FROM attendance_log al LEFT JOIN users u ON u.id=al.admin_user_id WHERE al.student_id=? ORDER BY al.happened_at DESC`).all(id), payments: db.prepare('SELECT * FROM payments WHERE student_id=? ORDER BY paid_at DESC').all(id) }));
      if (req.method === 'GET' && action === 'edit') return send(res, 200, studentForm({ user, types: allTypes(), student: studentSummary(id) }));
      if (req.method === 'POST' && action === 'edit') { const f = await body(req); db.prepare('UPDATE students SET full_name=?, birth_date=?, student_type=?, membership_type_id=?, comment=?, consent_received=? WHERE id=?').run(f.full_name, f.birth_date, f.student_type, Number(f.membership_type_id), f.comment || '', f.consent_received ? 1 : 0, id); return redirect(res, `/admin/students/${id}`); }
      if (req.method === 'POST' && action === 'attendance') { markAttendance(id, null, user); return redirect(res, '/admin/students'); }
      if (req.method === 'POST' && action === 'payment-status') { recordSubscriptionPayment(id); return redirect(res, '/admin/students'); }
      if (req.method === 'POST' && action === 'payments') { const f = await body(req); const sub = latestSub(id); db.prepare('INSERT INTO payments (student_id, subscription_id, amount, method, comment) VALUES (?, ?, ?, ?, ?)').run(id, sub?.id || null, Number(f.amount), f.method || 'cash', f.comment || ''); if (sub) { db.prepare("UPDATE subscriptions SET paid_status='paid' WHERE id=?").run(sub.id); resetSubscriptionVisitsIfEmpty(id); } return redirect(res, `/admin/students/${id}`); }
    }
    if (req.method === 'GET' && url.pathname === '/admin/subscriptions') return send(res, 200, subscriptionsPage({ user, subscriptions: db.prepare('SELECT sub.*, s.full_name, mt.name FROM subscriptions sub JOIN students s ON s.id=sub.student_id JOIN membership_types mt ON mt.id=sub.membership_type_id ORDER BY sub.created_at DESC').all() }));
    if (req.method === 'GET' && url.pathname === '/admin/membership-types') return send(res, 200, membershipTypesPage({ user, types: allTypes() }));
    if (req.method === 'POST' && url.pathname === '/admin/membership-types') { const f = await body(req); db.prepare('INSERT INTO membership_types (name, visits, price) VALUES (?, ?, ?)').run(f.name, Number(f.visits), Number(f.price)); return redirect(res, '/admin/membership-types'); }
    const typeMatch = url.pathname.match(/^\/admin\/membership-types\/(\d+)\/(edit|delete)$/);
    if (typeMatch) {
      const typeId = Number(typeMatch[1]); const action = typeMatch[2];
      if (req.method === 'GET' && action === 'edit') { const type = db.prepare('SELECT * FROM membership_types WHERE id=? AND is_active=1').get(typeId); if (!type) return notFound(res); return send(res, 200, membershipTypeForm({ user, type })); }
      if (req.method === 'POST' && action === 'edit') { const f = await body(req); db.prepare('UPDATE membership_types SET name=?, visits=?, price=? WHERE id=?').run(f.name, Number(f.visits), Number(f.price), typeId); return redirect(res, '/admin/membership-types'); }
      if (req.method === 'POST' && action === 'delete') {
        db.prepare('UPDATE membership_types SET is_active=0 WHERE id=?').run(typeId);
        return redirect(res, '/admin/membership-types');
      }
    }
  }

  if (url.pathname.startsWith('/student')) {
    if (!requireRole(res, user, 'student')) return;
    const student = db.prepare('SELECT id FROM students WHERE user_id=?').get(user.id);
    const summary = studentSummary(student.id);
    const allLessons = publicLessons();
    const myLessons = db.prepare('SELECT l.*, ls.status FROM lessons l JOIN lesson_students ls ON ls.lesson_id=l.id WHERE ls.student_id=? ORDER BY l.starts_at').all(student.id);
    const payments = db.prepare('SELECT * FROM payments WHERE student_id=? ORDER BY paid_at DESC').all(student.id);
    return send(res, 200, studentCabinet({ user, allLessons, myLessons, payments, student: summary }));
  }
  notFound(res);
}

export const server = createServer((req, res) => handle(req, res).catch((error) => send(res, 500, `<h1>Ошибка</h1><pre>${String(error.stack || error)}</pre>`)));
if (process.argv[1] === new URL(import.meta.url).pathname) server.listen(PORT, () => console.log(`CRM listening on http://localhost:${PORT}`));
