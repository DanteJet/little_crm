import test from 'node:test';
import assert from 'node:assert/strict';
import { adminUserForm, adminUsersPage, login, membershipTypeForm, membershipTypesPage, studentDetails } from '../src/views.js';

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


test('membership types page includes edit and delete controls', () => {
  const page = membershipTypesPage({
    user: admin,
    types: [{ id: 7, name: 'Абонемент 4 занятия', visits: 4, price: 4000 }],
  });

  assert.match(page, /href="\/admin\/membership-types\/7\/edit"/);
  assert.doesNotMatch(page, /<details class="table-details">/);
  assert.match(page, /action="\/admin\/membership-types\/7\/delete"/);
});

test('admin users page includes edit and delete controls for other admins', () => {
  const page = adminUsersPage({
    user: { ...admin, id: 1 },
    admins: [{ id: 2, full_name: 'Анна Тренер', login: 'anna', created_at: '2026-06-12T10:00:00.000Z' }],
  });

  assert.match(page, /href="\/admin\/admins\/2\/edit"/);
  assert.doesNotMatch(page, /<details class="table-details">/);
  assert.match(page, /action="\/admin\/admins\/2\/delete"/);
});


test('membership type edit form opens on a separate page', () => {
  const page = membershipTypeForm({
    user: admin,
    type: { id: 7, name: 'Абонемент 4 занятия', visits: 4, price: 4000 },
  });

  assert.match(page, /Редактировать абонемент/);
  assert.match(page, /action="\/admin\/membership-types\/7\/edit"/);
  assert.match(page, /← К типам абонементов/);
});

test('admin edit form opens on a separate page', () => {
  const page = adminUserForm({
    user: { ...admin, id: 1 },
    admin: { id: 2, full_name: 'Анна Тренер', login: 'anna' },
  });

  assert.match(page, /Редактировать администратора/);
  assert.match(page, /action="\/admin\/admins\/2\/edit"/);
  assert.match(page, /← К администраторам/);
});
