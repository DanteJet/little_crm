import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'little-crm-payments-test-')), 'crm.sqlite');
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

test('quick payment status records subscription price in payment history', async (t) => {
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

  const type = db.prepare('SELECT id, visits, price FROM membership_types WHERE visits=8 LIMIT 1').get();
  const studentUser = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)').run('student-pay', 'unused', 'student');
  const student = db.prepare('INSERT INTO students (user_id, full_name, birth_date, student_type, membership_type_id) VALUES (?, ?, ?, ?, ?)')
    .run(studentUser.lastInsertRowid, 'Ученик с оплатой', '2015-01-01', 'child', type.id);
  const subscription = db.prepare('INSERT INTO subscriptions (student_id, membership_type_id, total_visits, remaining_visits, paid_status) VALUES (?, ?, ?, ?, ?)')
    .run(student.lastInsertRowid, type.id, type.visits, type.visits, 'unpaid');

  const response = await fetch(`${base}/admin/students/${student.lastInsertRowid}/payment-status`, {
    method: 'POST',
    headers: { cookie },
    redirect: 'manual',
  });
  assert.equal(response.status, 302);

  const payment = db.prepare('SELECT * FROM payments WHERE student_id=? AND subscription_id=?').get(student.lastInsertRowid, subscription.lastInsertRowid);
  assert.equal(payment.amount, type.price);
  assert.equal(payment.method, 'cash');
  assert.equal(payment.comment, 'Оплата проставлена администратором');

  const latest = db.prepare('SELECT paid_status FROM subscriptions WHERE id=?').get(subscription.lastInsertRowid);
  assert.equal(latest.paid_status, 'paid');
});


test('payment at zero visits immediately resets subscription visit counter', async (t) => {
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

  const type = db.prepare('SELECT id, visits, price FROM membership_types WHERE visits=8 LIMIT 1').get();
  const studentUser = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)').run('student-zero-pay', 'unused', 'student');
  const student = db.prepare('INSERT INTO students (user_id, full_name, birth_date, student_type, membership_type_id) VALUES (?, ?, ?, ?, ?)')
    .run(studentUser.lastInsertRowid, 'Ученик с нулевым остатком', '2015-01-01', 'child', type.id);
  const subscription = db.prepare('INSERT INTO subscriptions (student_id, membership_type_id, total_visits, remaining_visits, paid_status) VALUES (?, ?, ?, ?, ?)')
    .run(student.lastInsertRowid, type.id, type.visits, 0, 'unpaid');

  const response = await fetch(`${base}/admin/students/${student.lastInsertRowid}/payment-status`, {
    method: 'POST',
    headers: { cookie },
    redirect: 'manual',
  });
  assert.equal(response.status, 302);

  const latest = db.prepare('SELECT total_visits, remaining_visits, paid_status FROM subscriptions WHERE id=?').get(subscription.lastInsertRowid);
  assert.equal(latest.total_visits, type.visits);
  assert.equal(latest.remaining_visits, type.visits);
  assert.equal(latest.paid_status, 'paid');
});
