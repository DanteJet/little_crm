import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'little-crm-test-')), 'crm.sqlite');
const { db, migrate, seed, initDb } = await import('../src/db.js');

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

test('sqlite is configured for concurrent production access', () => {
  assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  assert.equal(db.prepare('PRAGMA synchronous').get().synchronous, 1);
  assert.equal(db.prepare('PRAGMA busy_timeout').get().timeout, 5000);
  assert.equal(db.prepare('PRAGMA wal_autocheckpoint').get().wal_autocheckpoint, 256);
  assert.equal(db.prepare('PRAGMA journal_size_limit').get().journal_size_limit, 1048576);
});

test('startup checkpoint folds an existing WAL back into the database', () => {
  migrate();
  db.prepare("INSERT INTO lessons (starts_at, duration_minutes, comment) VALUES (?, ?, ?)")
    .run('2026-08-20T10:00:00.000Z', 60, 'checkpoint-test');
  initDb();
  const checkpoint = db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get();
  assert.equal(checkpoint.busy, 0);
  assert.equal(checkpoint.log, 0);
  assert.equal(checkpoint.checkpointed, 0);
});
