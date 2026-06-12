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
  const admin = db.prepare("SELECT login, role, full_name FROM users WHERE role='admin' LIMIT 1").get();
  const typeCount = db.prepare('SELECT COUNT(*) AS count FROM membership_types WHERE is_active=1').get().count;
  const type = db.prepare('SELECT is_active FROM membership_types LIMIT 1').get();
  assert.equal(admin.role, 'admin');
  assert.equal(admin.full_name, 'Главный администратор');
  assert.ok(typeCount >= 3);
  assert.equal(type.is_active, 1);
});
