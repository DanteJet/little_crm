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
