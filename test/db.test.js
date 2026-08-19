import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'little-crm-test-')), 'crm.sqlite');
const { db, migrate, seed } = await import('../src/db.js');

test('database migration creates seeded admin and membership types', () => {
  migrate();
  seed();
  const admin = db.prepare("SELECT login, role, full_name, must_change_password FROM users WHERE role='admin' LIMIT 1").get();
  const typeCount = db.prepare('SELECT COUNT(*) AS count FROM membership_types WHERE is_active=1').get().count;
  const type = db.prepare('SELECT is_active FROM membership_types LIMIT 1').get();
  assert.equal(admin.role, 'admin');
  assert.equal(admin.full_name, 'Главный администратор');
  assert.equal(admin.must_change_password, 0);
  assert.ok(typeCount >= 3);
  assert.equal(type.is_active, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('users') WHERE name='must_change_password'").get().count, 1);
});

test('database migration creates indexes for hot schedule queries', () => {
  migrate();
  const indexes = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((row) => row.name));
  assert.ok(indexes.has('idx_lessons_starts_at'));
  assert.ok(indexes.has('idx_lesson_students_student_lesson'));
  assert.ok(indexes.has('idx_subscriptions_student_latest'));
  assert.ok(indexes.has('idx_payments_student_paid'));
  assert.ok(indexes.has('idx_attendance_student_happened'));

  const plan = db.prepare("EXPLAIN QUERY PLAN SELECT * FROM lessons WHERE starts_at>=? AND starts_at<? ORDER BY starts_at")
    .all('2026-08-17T00:00:00.000Z', '2026-08-24T00:00:00.000Z')
    .map((row) => row.detail)
    .join(' ');
  assert.match(plan, /idx_lessons_starts_at/);
});
