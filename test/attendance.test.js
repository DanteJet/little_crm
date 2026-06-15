import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'little-crm-attendance-test-')), 'crm.sqlite');
const { server } = await import('../src/server.js');
const { db } = await import('../src/db.js');

function listen() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close() {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test('attendance at zero visits starts a fresh counter and records admin', async (t) => {
  const port = await listen();
  t.after(close);
  const base = `http://127.0.0.1:${port}`;

  const login = await fetch(`${base}/login`, {
    method: 'POST',
    body: new URLSearchParams({ login: 'admin', password: 'admin123' }),
    redirect: 'manual',
  });
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie);

  const type = db.prepare('SELECT id, visits FROM membership_types WHERE visits=8 LIMIT 1').get();
  const studentUser = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)').run('student-zero', 'unused', 'student');
  const student = db.prepare('INSERT INTO students (user_id, full_name, birth_date, student_type, membership_type_id) VALUES (?, ?, ?, ?, ?)')
    .run(studentUser.lastInsertRowid, 'Ученик с нулём', '2015-01-01', 'child', type.id);
  db.prepare('INSERT INTO subscriptions (student_id, membership_type_id, total_visits, remaining_visits, paid_status) VALUES (?, ?, ?, ?, ?)')
    .run(student.lastInsertRowid, type.id, type.visits, 0, 'unpaid');

  const response = await fetch(`${base}/admin/students/${student.lastInsertRowid}/attendance`, {
    method: 'POST',
    headers: { cookie },
    redirect: 'manual',
  });
  assert.equal(response.status, 302);

  const latest = db.prepare('SELECT * FROM subscriptions WHERE student_id=? ORDER BY id DESC LIMIT 1').get(student.lastInsertRowid);
  assert.equal(latest.total_visits, type.visits);
  assert.equal(latest.remaining_visits, type.visits - 1);
  assert.equal(latest.paid_status, 'unpaid');

  const log = db.prepare('SELECT al.*, u.full_name FROM attendance_log al JOIN users u ON u.id=al.admin_user_id WHERE al.student_id=?').get(student.lastInsertRowid);
  assert.equal(log.full_name, 'Главный администратор');
  assert.equal(log.note, 'Занятие проставлено администратором');

  const details = await fetch(`${base}/admin/students/${student.lastInsertRowid}`, { headers: { cookie } });
  assert.equal(details.status, 200);
  const detailsHtml = await details.text();
  assert.match(detailsHtml, /Занятие проставил: Главный администратор/);
});

test('admin can cancel marked attendance and restore visit counter', async (t) => {
  const port = await listen();
  t.after(close);
  const base = `http://127.0.0.1:${port}`;

  const login = await fetch(`${base}/login`, {
    method: 'POST',
    body: new URLSearchParams({ login: 'admin', password: 'admin123' }),
    redirect: 'manual',
  });
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie);

  const type = db.prepare('SELECT id, visits FROM membership_types WHERE visits=8 LIMIT 1').get();
  const studentUser = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)').run('student-cancel', 'unused', 'student');
  const student = db.prepare('INSERT INTO students (user_id, full_name, birth_date, student_type, membership_type_id) VALUES (?, ?, ?, ?, ?)')
    .run(studentUser.lastInsertRowid, 'Ученик для отмены', '2014-02-02', 'child', type.id);
  db.prepare('INSERT INTO subscriptions (student_id, membership_type_id, total_visits, remaining_visits, paid_status) VALUES (?, ?, ?, ?, ?)')
    .run(student.lastInsertRowid, type.id, type.visits, type.visits, 'paid');

  const mark = await fetch(`${base}/admin/students/${student.lastInsertRowid}/attendance`, {
    method: 'POST',
    headers: { cookie },
    redirect: 'manual',
  });
  assert.equal(mark.status, 302);
  assert.equal(db.prepare('SELECT remaining_visits FROM subscriptions WHERE student_id=? ORDER BY id DESC LIMIT 1').get(student.lastInsertRowid).remaining_visits, type.visits - 1);

  const log = db.prepare('SELECT id FROM attendance_log WHERE student_id=?').get(student.lastInsertRowid);
  assert.ok(log);

  const cancel = await fetch(`${base}/admin/students/${student.lastInsertRowid}/attendance/${log.id}/cancel`, {
    method: 'POST',
    headers: { cookie },
    redirect: 'manual',
  });
  assert.equal(cancel.status, 302);
  assert.equal(db.prepare('SELECT remaining_visits FROM subscriptions WHERE student_id=? ORDER BY id DESC LIMIT 1').get(student.lastInsertRowid).remaining_visits, type.visits);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM attendance_log WHERE student_id=?').get(student.lastInsertRowid).count, 0);
});

test('manual remaining visit correction does not add attendance history', async (t) => {
  const port = await listen();
  t.after(close);
  const base = `http://127.0.0.1:${port}`;

  const login = await fetch(`${base}/login`, {
    method: 'POST',
    body: new URLSearchParams({ login: 'admin', password: 'admin123' }),
    redirect: 'manual',
  });
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie);

  const type = db.prepare('SELECT id, visits FROM membership_types WHERE visits=8 LIMIT 1').get();
  const studentUser = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)').run('student-manual', 'unused', 'student');
  const student = db.prepare('INSERT INTO students (user_id, full_name, birth_date, student_type, membership_type_id) VALUES (?, ?, ?, ?, ?)')
    .run(studentUser.lastInsertRowid, 'Ученик для переноса', '2013-03-03', 'child', type.id);
  db.prepare('INSERT INTO subscriptions (student_id, membership_type_id, total_visits, remaining_visits, paid_status) VALUES (?, ?, ?, ?, ?)')
    .run(student.lastInsertRowid, type.id, type.visits, 2, 'paid');

  const response = await fetch(`${base}/admin/students/${student.lastInsertRowid}/remaining`, {
    method: 'POST',
    headers: { cookie },
    body: new URLSearchParams({ remaining_visits: '5' }),
    redirect: 'manual',
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `/admin/students/${student.lastInsertRowid}`);

  const latest = db.prepare('SELECT total_visits, remaining_visits, paid_status FROM subscriptions WHERE student_id=? ORDER BY id DESC LIMIT 1').get(student.lastInsertRowid);
  assert.equal(latest.total_visits, type.visits);
  assert.equal(latest.remaining_visits, 5);
  assert.equal(latest.paid_status, 'paid');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM attendance_log WHERE student_id=?').get(student.lastInsertRowid).count, 0);

  const details = await fetch(`${base}/admin/students/${student.lastInsertRowid}`, { headers: { cookie } });
  assert.equal(details.status, 200);
  const detailsHtml = await details.text();
  assert.match(detailsHtml, /Нет посещений\./);
  assert.match(detailsHtml, /value="5"/);
});
