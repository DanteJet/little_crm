import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, html, passwordStrengthError, isStrongPassword } from '../src/security.js';

test('password hashing verifies only correct password', () => {
  const hash = hashPassword('safe-password');
  assert.equal(verifyPassword('safe-password', hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
});

test('html escapes dangerous characters', () => {
  assert.equal(html('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});


test('student permanent password must be strong and must not contain login', () => {
  assert.equal(isStrongPassword('Very$trong42', { login: 'ivan' }), true);
  assert.match(passwordStrengthError('short', { login: 'ivan' }), /не короче 10/);
  assert.match(passwordStrengthError('Very$trong42ivan', { login: 'ivan' }), /не должен содержать логин/);
});
