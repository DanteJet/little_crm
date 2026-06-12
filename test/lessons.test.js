import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'little-crm-lessons-test-')), 'crm.sqlite');
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

test('lesson datetime-local input is saved as Moscow wall time without moving to next day', async (t) => {
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

  const type = db.prepare('SELECT id FROM membership_types LIMIT 1').get();
  const studentUser = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)').run('student-lesson', 'unused', 'student');
  const student = db.prepare('INSERT INTO students (user_id, full_name, birth_date, student_type, membership_type_id) VALUES (?, ?, ?, ?, ?)')
    .run(studentUser.lastInsertRowid, 'Ученик на занятие', '2015-01-01', 'child', type.id);

  const response = await fetch(`${base}/admin/lessons`, {
    method: 'POST',
    headers: { cookie },
    body: new URLSearchParams({
      starts_at: '2026-06-12T22:30',
      duration_minutes: '60',
      student_ids: String(student.lastInsertRowid),
    }),
    redirect: 'manual',
  });
  assert.equal(response.status, 302);

  const lesson = db.prepare('SELECT starts_at FROM lessons ORDER BY id DESC LIMIT 1').get();
  assert.equal(lesson.starts_at, '2026-06-12T19:30:00.000Z');
});
