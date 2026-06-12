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
  const admin = db.prepare("SELECT login, role FROM users WHERE role='admin' LIMIT 1").get();
  const typeCount = db.prepare('SELECT COUNT(*) AS count FROM membership_types').get().count;
  assert.equal(admin.role, 'admin');
  assert.ok(typeCount >= 3);
});
