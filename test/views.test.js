import test from 'node:test';
import assert from 'node:assert/strict';
import { adminDashboard, adminUserForm, adminUsersPage, lessonForm, login, membershipTypeForm, membershipTypesPage, scheduleCalendar, studentCabinet, studentDetails } from '../src/views.js';

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

test('weekly schedule starts on Monday, ends on Sunday, highlights today and exposes lesson comment on hover', () => {
  const page = scheduleCalendar([
    { starts_at: '2026-06-15T10:00:00.000Z', duration_minutes: 60, students: 'Иван', count: 1, comment: 'Взять инвентарь' },
  ], 'week', new Date('2026-06-18T12:00:00.000Z'));

  assert.match(page, /пн, 15 июн/);
  assert.match(page, /вс, 21 июн/);
  assert.doesNotMatch(page, /пн, 22 июн/);
  assert.match(page, /is-today/);
  assert.match(page, /title="Взять инвентарь"/);
  assert.match(page, /есть комментарий/);
});


test('public schedule can hide student names and comments', () => {
  const page = scheduleCalendar([
    { starts_at: '2026-06-15T10:00:00.000Z', duration_minutes: 60, students: 'Иван, Анна', count: 2, comment: 'Личный комментарий' },
  ], 'month', new Date('2026-06-15T12:00:00.000Z'), { anonymize: true });

  assert.match(page, /2 чел\./);
  assert.doesNotMatch(page, /Иван/);
  assert.doesNotMatch(page, /Анна/);
  assert.doesNotMatch(page, /Личный комментарий/);
  assert.doesNotMatch(page, /есть комментарий/);
});

test('student overview shows common schedule without payment block', () => {
  const page = studentCabinet({
    user: { role: 'student' },
    allLessons: [],
    myLessons: [],
    payments: [],
    student: { full_name: 'Иван Ученик', membership_name: 'Абонемент', paid_status: 'paid', remaining_visits: 3 },
  });

  assert.match(page, /Общее расписание/);
  assert.doesNotMatch(page, /<h2>Оплата<\/h2>/);
});

test('lesson forms use split date and time picker backed by starts_at field', () => {
  const newPage = adminDashboard({ user: admin, lessons: [], students: [{ id: 1, full_name: 'Иван' }], birthdays: [], view: 'week' });
  const editPage = lessonForm({ user: admin, lesson: { id: 5, starts_at: '2026-06-15T10:00:00.000Z', duration_minutes: 60, student_ids: '1', comment: '' }, students: [{ id: 1, full_name: 'Иван' }] });

  assert.match(newPage, /class="datetime-picker"/);
  assert.match(newPage, /name="starts_at"/);
  assert.match(newPage, /type="date"/);
  assert.match(newPage, /type="time"/);
  assert.match(editPage, /value="2026-06-15"/);
});

test('home page slider uses local uploaded images', async () => {
  const { home } = await import('../src/views.js');
  const page = home({ user: null, publicLessons: [], membershipTypes: [] });

  assert.match(page, /class="photo-slide slide-five"/);
  assert.match(page, /Наши тренировки в движении/);
});

test('admin lesson creation form opens in modal over schedule', () => {
  const page = adminDashboard({ user: admin, lessons: [], students: [{ id: 1, full_name: 'Иван' }], birthdays: [], view: 'week' });

  assert.match(page, /modal-details/);
  assert.match(page, /modal-backdrop/);
  assert.match(page, /lesson-modal/);
});
