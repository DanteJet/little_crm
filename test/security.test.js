import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, html } from '../src/security.js';

test('password hashing verifies only correct password', () => {
  const hash = hashPassword('safe-password');
  assert.equal(verifyPassword('safe-password', hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
});

test('html escapes dangerous characters', () => {
  assert.equal(html('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});
