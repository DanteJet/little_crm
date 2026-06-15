import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const actual = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').filter(Boolean).map((part) => {
    const [name, ...rest] = part.trim().split('=');
    return [decodeURIComponent(name), decodeURIComponent(rest.join('='))];
  }));
}

export function html(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function passwordStrengthError(password, user = {}) {
  const value = String(password || '');
  if (value.length < 10) return 'Пароль должен быть не короче 10 символов';
  if (!/[a-zа-яё]/u.test(value)) return 'Добавьте строчную букву';
  if (!/[A-ZА-ЯЁ]/u.test(value)) return 'Добавьте заглавную букву';
  if (!/\d/.test(value)) return 'Добавьте цифру';
  if (!/[^A-Za-zА-Яа-яЁё0-9]/u.test(value)) return 'Добавьте специальный символ';
  const login = String(user.login || '').trim().toLowerCase();
  if (login && value.toLowerCase().includes(login)) return 'Пароль не должен содержать логин';
  return '';
}

export function isStrongPassword(password, user = {}) {
  return passwordStrengthError(password, user) === '';
}
