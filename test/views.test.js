import test from 'node:test';
import assert from 'node:assert/strict';
import { adminUsersPage, login, studentDetails } from '../src/views.js';

const admin = { role: 'admin', full_name: 'Главный администратор' };

test('login form asks only for credentials', () => {
  const page = login({});

  assert.match(page, /name="login"/);
  assert.match(page, /name="password"/);
  assert.doesNotMatch(page, /name="full_name"/);
});

test('admin creation form asks for administrator full name', () => {
  const page = adminUsersPage({ user: admin, admins: [] });

  assert.match(page, /Создать администратора/);
  assert.match(page, /<label>ФИО<input name="full_name" autocomplete="name" required><\/label>/);
});

test('student details show who marked attendance', () => {
  const page = studentDetails({
    user: admin,
    student: {
      id: 1,
      full_name: 'Иван Ученик',
      student_type: 'child',
      membership_name: 'Абонемент 8 занятий',
      paid_status: 'paid',
    },
    visits: [{ happened_at: '2026-06-12T10:00:00.000Z', note: 'Занятие проставлено администратором', admin_name: 'Анна Тренер' }],
    payments: [],
  });

  assert.match(page, /Занятие проставил: Анна Тренер/);
});
