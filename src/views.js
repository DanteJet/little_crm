import { html } from './security.js';

const money = (v) => `${Number(v || 0).toLocaleString('ru-RU')} ₽`;
const dateRu = (v) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'Europe/Moscow' }).format(new Date(v));
const dtRu = (v) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(v));
const timeRu = (v) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(v));
const dayRu = (v) => new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }).format(new Date(v));
const monthTitleRu = (v) => new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).format(new Date(v));
const typeRu = (v) => v === 'child' ? 'Ребёнок' : 'Взрослый';
const statusRu = (v) => ({ paid: 'Оплачено', partial: 'Частично', unpaid: 'Не оплачено', planned: 'Запланировано', visited: 'Посетил', missed: 'Пропуск' }[v] || v);
const isoDate = (v) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v));

function weekStart(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const daysFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);
  return start;
}

export function scheduleCalendar(lessons, view, currentDate = new Date()) {
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  const todayKey = isoDate(now);
  const start = view === 'month' ? new Date(now) : weekStart(now);
  const days = [];

  if (view === 'month') {
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  } else {
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
  }

  const grouped = new Map();
  for (const lesson of lessons) {
    const key = isoDate(lesson.starts_at);
    grouped.set(key, [...(grouped.get(key) || []), lesson]);
  }

  return `<div class="calendar ${view === 'month' ? 'calendar-month' : 'calendar-week'}">${days.map((day) => {
    const key = isoDate(day);
    const dayLessons = grouped.get(key) || [];
    const isToday = key === todayKey;
    return `<div class="calendar-day${isToday ? ' is-today' : ''}"><div class="calendar-date"><span>${dayRu(day)}</span>${view === 'month' ? `<small>${monthTitleRu(day)}</small>` : ''}</div><div class="calendar-items">${dayLessons.length ? dayLessons.map((l) => {
      const comment = String(l.comment || '').trim();
      return `<article class="lesson-card"${comment ? ` title="${html(comment)}"` : ''}><strong>${timeRu(l.starts_at)} · ${l.duration_minutes} мин.</strong><span>${html(l.students || 'без учеников')}</span><em>${l.count} чел.${comment ? ' · есть комментарий' : ''}</em></article>`;
    }).join('') : '<p class="muted">Нет занятий</p>'}</div></div>`;
  }).join('')}</div>`;
}

export function layout({ title, user, body }) {
  const nav = user ? `<nav class="nav"><a href="/">Главная</a>${user.role === 'admin' ? '<a href="/admin">Расписание</a><a href="/admin/students">Ученики</a><a href="/admin/subscriptions">Абонементы</a><a href="/admin/membership-types">Типы абонементов</a><a href="/admin/admins">Администраторы</a><a href="/admin/students/new">Добавить ученика</a>' : '<a href="/student">Кабинет</a><a href="/student/schedule">Моё расписание</a><a href="/student/payments">Оплата</a>'}<form method="post" action="/logout"><button class="ghost">Выйти</button></form></nav>` : `<nav class="nav"><a href="/">Главная</a><a class="button" href="/login">Вход</a></nav>`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(title)} · Енот Archery</title><link rel="stylesheet" href="/public/styles.css"></head><body><header class="top"><div class="brand"><span class="logo">🦝</span><div><strong>Енот Archery</strong><small>клуб стрельбы из лука</small></div></div>${nav}</header><main>${body}</main><footer>© ${new Date().getFullYear()} Енот Archery · персональные данные защищены ролями, сессиями и локальной БД</footer></body></html>`;
}

export function home({ user, publicLessons, membershipTypes: _membershipTypes }) {
  const accountHref = user?.role === 'admin' ? '/admin' : user ? '/student' : '/login';
  const accountLabel = user ? 'Открыть личный кабинет' : 'Войти в личный кабинет';

  const services = [
    ['Разовое занятие', 'Познакомьтесь со стрельбой из лука', '800 ₽'],
    ['Индивидуальное занятие', 'Быстрый прогресс и полное погружение', '1 400 ₽'],
    ['Абонемент 8 занятий/месяц', 'Идеален для регулярных тренировок', '5 000 ₽'],
    ['Абонемент 12/16 занятий в месяц', 'Для самых целеустремленных лучников!', 'индивидуально'],
    ['Приведи друга', 'Заинтересуй друга стрельбой из лука и получите скидку на абонементы', '30 %'],
    ['Семейное посещение (до 4 чел)', 'Проведите полезно время всей семьей', '2 500 ₽'],
  ];

  const servicesHtml = services.map(([name, description, price]) => `
    <article class="service-card">
      <div>
        <h3>${html(name)}</h3>
        <p>${html(description)}</p>
      </div>
      <strong>${html(price)}</strong>
    </article>
  `).join('');

  return layout({
    title: 'Главная',
    user,
    body: `
      <section class="hero hero-archery">
        <div>
          <p class="eyebrow">Традиционная стрельба · история · сила</p>
          <h1>Спортивный клуб стрельбы из лука «Малыш Джон»</h1>
          <p>Хотите попробовать себя в роли средневекового воина, легендарного охотника или просто освоить красивый и полезный навык? Добро пожаловать в «Малыш Джон» — клуб традиционной стрельбы из лука.</p>
          <div class="hero-actions">
            <a class="button" href="${accountHref}">${accountLabel}</a>
            <a class="button secondary" href="#services">Посмотреть цены</a>
          </div>
        </div>
        <div class="mascot archery-mark">🏹</div>
      </section>

      <section class="grid two story-grid">
        <article class="card feature-card">
          <p class="eyebrow">Что вас ждет</p>
          <h2>Тренировки с характером</h2>
          <ul class="feature-list">
            <li><strong>Традиционный лук</strong><span>Только классика, проверенная веками.</span></li>
            <li><strong>Погружение в историю</strong><span>От первых каменных наконечников до легенд о Робин Гуде: расскажем о происхождении лука, его видах и особенностях.</span></li>
            <li><strong>Здоровье и сила</strong><span>Регулярные занятия укрепляют мышцы спины и рук, улучшают осанку, развивают концентрацию и координацию движений.</span></li>
            <li><strong>Атмосфера единства</strong><span>Стрельба из лука объединяет: это спорт, искусство и немного магии.</span></li>
          </ul>
        </article>
        <article class="card why-card">
          <p class="eyebrow">Почему именно мы</p>
          <h2>За каждым выстрелом — история</h2>
          <p>В «Малыше Джоне» мы не просто учим стрелять в цель — мы показываем, что за каждым выстрелом стоит целая история.</p>
          <p>Вы получите не только физическую тренировку, но и вдохновение от прикосновения к традиции.</p>
        </article>
      </section>

      <section id="services" class="card services-section">
        <div class="section-head">
          <p class="eyebrow">Наши услуги</p>
          <h2>Выберите свой формат занятий</h2>
        </div>
        <div class="services-grid">${servicesHtml}</div>
      </section>

      <section class="card schedule-card">
        <h2>Открытое расписание на месяц</h2>
        <div class="schedule-list">${publicLessons.length ? publicLessons.map((l) => `<div class="schedule-row"><span>${dtRu(l.starts_at)}</span><strong>${l.count} чел.</strong></div>`).join('') : '<p class="muted">Пока нет открытых занятий.</p>'}</div>
      </section>
    `,
  });
}

export function login({ error = '' }) {
  return layout({ title: 'Вход', user: null, body: `<section class="auth card"><h1>Вход</h1>${error ? `<p class="alert">${html(error)}</p>` : ''}<form method="post" action="/login" class="form"><label>Логин<input name="login" autocomplete="username" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button>Войти</button></form><p class="hint">Демо-админ: <code>admin</code> / <code>admin123</code>. Смените пароль через переменные окружения при первом запуске.</p></section>` });
}

export function adminDashboard({ user, lessons, students, birthdays, view }) {
  const options = students.map((s) => `<option value="${s.id}">${html(s.full_name)}</option>`).join('');
  return layout({ title: 'Администратор', user, body: `${birthdays.length ? `<div class="birthday">🎂 Скоро дни рождения: ${birthdays.map((s) => html(`${s.full_name} — ${dateRu(s.next_birthday)}`)).join(', ')}</div>` : ''}<section class="page-head"><div><h1>Расписание</h1><p>Календарь на ${view === 'month' ? 'месяц' : 'неделю'}</p></div><div class="actions"><a class="button secondary" href="/admin?view=week">Неделя</a><a class="button secondary" href="/admin?view=month">Месяц</a><details class="add-lesson"><summary class="button">+ Добавить занятие</summary><article class="card popover"><h2>Новое занятие</h2><form class="form" method="post" action="/admin/lessons"><label>Дата и время<input type="datetime-local" name="starts_at" required></label><label>Длительность, минут<input type="number" name="duration_minutes" min="30" step="15" value="60"></label><label>Ученики<select name="student_ids" multiple size="8" required>${options}</select></label><label class="check"><input type="checkbox" name="repeat_month" value="1"> Заполнить на месяц по этому дню недели и времени</label><label>Комментарий<textarea name="comment"></textarea></label><button>Создать</button></form></article></details></div></section><section class="card schedule-card"><h2>${view === 'month' ? 'Месячный календарь' : 'Недельный календарь'}</h2>${scheduleCalendar(lessons, view)}</section>` });
}

export function studentsPage({ user, students }) {
  return layout({ title: 'Ученики', user, body: `<section class="page-head"><h1>Ученики</h1><a class="button" href="/admin/students/new">Добавить ученика</a></section><section class="card table-wrap"><table><thead><tr><th>Имя Фамилия</th><th>Тип</th><th>Тип абонемента</th><th>Посещений</th><th>Остаток</th><th>Оплата</th><th>Действия</th></tr></thead><tbody>${students.map((s) => `<tr><td>${html(s.full_name)}</td><td>${typeRu(s.student_type)}</td><td>${html(s.membership_name || '—')}</td><td>${s.used_visits || 0}/${s.total_visits || 0}</td><td>${s.remaining_visits ?? 0}</td><td><span class="pill ${s.paid_status}">${statusRu(s.paid_status)}</span></td><td><div class="row-actions"><a class="action-btn view" href="/admin/students/${s.id}">Просмотр</a><a class="action-btn edit" href="/admin/students/${s.id}/edit">Правка</a><form class="inline" method="post" action="/admin/students/${s.id}/attendance"><button class="action-btn visit">+ Занятие</button></form><form class="inline" method="post" action="/admin/students/${s.id}/payment-status"><button class="action-btn pay">Оплата</button></form></div></td></tr>`).join('')}</tbody></table></section>` });
}

export function adminUsersPage({ user, admins }) {
  return layout({ title: 'Администраторы', user, body: `<section class="grid two"><article class="card"><h1>Администраторы и тренеры</h1><p class="muted">Главный администратор может создавать, редактировать и удалять доступы для других администраторов и тренеров.</p><table><thead><tr><th>ФИО</th><th>Логин</th><th>Дата создания</th><th>Действия</th></tr></thead><tbody>${admins.map((a) => `<tr><td>${html(a.full_name || '—')}</td><td>${html(a.login)}</td><td>${dtRu(a.created_at)}</td><td><a class="action-btn edit" href="/admin/admins/${a.id}/edit">Правка</a>${a.id === user.id ? '<span class="muted">Текущий пользователь</span>' : `<form class="inline" method="post" action="/admin/admins/${a.id}/delete"><button class="action-btn danger">Удалить</button></form>`}</td></tr>`).join('')}</tbody></table></article><article class="card"><h2>Создать администратора</h2><form class="form" method="post" action="/admin/admins"><label>ФИО<input name="full_name" autocomplete="name" required></label><label>Логин<input name="login" autocomplete="username" required></label><label>Пароль<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button>Создать доступ</button></form></article></section>` });
}

export function adminUserForm({ user, admin }) {
  return layout({ title: 'Редактировать администратора', user, body: `<section class="card narrow"><p><a href="/admin/admins">← К администраторам</a></p><h1>Редактировать администратора</h1><form class="form" method="post" action="/admin/admins/${admin.id}/edit"><label>ФИО<input name="full_name" autocomplete="name" required value="${html(admin.full_name)}"></label><label>Логин<input name="login" autocomplete="username" required value="${html(admin.login)}"></label><label>Новый пароль<input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Оставьте пустым, чтобы не менять"></label><button>Сохранить</button></form></section>` });
}

export function studentForm({ user, types, student = null }) {
  const isEdit = Boolean(student);
  return layout({ title: isEdit ? 'Редактировать ученика' : 'Добавить ученика', user, body: `<section class="card narrow"><h1>${isEdit ? 'Редактировать ученика' : 'Добавить ученика'}</h1><form class="form" method="post" action="${isEdit ? `/admin/students/${student.id}/edit` : '/admin/students'}"><label>ФИО<input name="full_name" required value="${html(student?.full_name)}"></label><label>Дата рождения<input type="date" name="birth_date" required value="${html(student?.birth_date)}"></label><label>Тип<select name="student_type"><option value="child" ${student?.student_type === 'child' ? 'selected' : ''}>Ребёнок</option><option value="adult" ${student?.student_type === 'adult' ? 'selected' : ''}>Взрослый</option></select></label>${isEdit ? '' : '<label>Логин<input name="login" required></label><label>Пароль<input name="password" type="password" required minlength="8"></label>'}<label>Тип абонемента<select name="membership_type_id" required>${types.map((t) => `<option value="${t.id}" ${student?.membership_type_id === t.id ? 'selected' : ''}>${html(t.name)} — ${t.visits} / ${money(t.price)}</option>`).join('')}</select></label><label>Комментарий<textarea name="comment">${html(student?.comment)}</textarea></label><label class="check"><input type="checkbox" name="consent_received" value="1" ${student?.consent_received ? 'checked' : ''}> Получено согласие на обработку персональных данных</label><button>${isEdit ? 'Сохранить' : 'Добавить'}</button></form></section>` });
}

export function studentDetails({ user, student, visits, payments }) {
  return layout({ title: student.full_name, user, body: `<section class="page-head"><div><h1>${html(student.full_name)}</h1><p>${typeRu(student.student_type)} · ${html(student.membership_name)} · ${statusRu(student.paid_status)}</p></div><a class="button" href="/admin/students/${student.id}/edit">Редактировать</a></section><section class="grid two"><article class="card"><h2>История посещений</h2>${visits.length ? visits.map((v) => `<p>${dtRu(v.happened_at)} — ${html(v.note || 'Посещение по абонементу')}${v.admin_name ? ` <span class="muted">· Занятие проставил: ${html(v.admin_name)}</span>` : ''}</p>`).join('') : '<p class="muted">Нет посещений.</p>'}</article><article class="card"><h2>История оплат</h2><form class="form compact" method="post" action="/admin/students/${student.id}/payments"><input name="amount" type="number" placeholder="Сумма" value="${student.membership_price ?? ''}" required><input name="method" placeholder="Способ" value="cash"><button>Добавить оплату</button></form>${payments.length ? payments.map((p) => `<p>${dateRu(p.paid_at)} — ${money(p.amount)} (${html(p.method)})${p.comment ? ` <span class="muted">· ${html(p.comment)}</span>` : ''}</p>`).join('') : '<p class="muted">Нет оплат.</p>'}</article></section>` });
}

export function subscriptionsPage({ user, subscriptions }) {
  return layout({ title: 'Абонементы', user, body: `<section class="card"><h1>Абонементы</h1><table><thead><tr><th>Владелец</th><th>Тип</th><th>Остаток</th><th>Оплата</th><th>Старт</th></tr></thead><tbody>${subscriptions.map((s) => `<tr><td>${html(s.full_name)}</td><td>${html(s.name)}</td><td>${s.remaining_visits}/${s.total_visits}</td><td><span class="pill ${s.paid_status}">${statusRu(s.paid_status)}</span></td><td>${dateRu(s.started_at)}</td></tr>`).join('')}</tbody></table></section>` });
}

export function membershipTypesPage({ user, types }) {
  return layout({ title: 'Типы абонементов', user, body: `<section class="grid two"><article class="card"><h1>Типы абонементов</h1><table><thead><tr><th>Название</th><th>Посещения</th><th>Цена</th><th>Действия</th></tr></thead><tbody>${types.map((t) => `<tr><td>${html(t.name)}</td><td>${t.visits}</td><td>${money(t.price)}</td><td><a class="action-btn edit" href="/admin/membership-types/${t.id}/edit">Правка</a><form class="inline" method="post" action="/admin/membership-types/${t.id}/delete"><button class="action-btn danger">Удалить</button></form></td></tr>`).join('')}</tbody></table></article><article class="card"><h2>Добавить абонемент</h2><form class="form" method="post" action="/admin/membership-types"><label>Название<input name="name" required></label><label>Количество посещений<input type="number" name="visits" min="1" required></label><label>Цена<input type="number" name="price" min="0" required></label><button>Добавить</button></form></article></section>` });
}

export function membershipTypeForm({ user, type }) {
  return layout({ title: 'Редактировать абонемент', user, body: `<section class="card narrow"><p><a href="/admin/membership-types">← К типам абонементов</a></p><h1>Редактировать абонемент</h1><form class="form" method="post" action="/admin/membership-types/${type.id}/edit"><label>Название<input name="name" required value="${html(type.name)}"></label><label>Количество посещений<input type="number" name="visits" min="1" required value="${type.visits}"></label><label>Цена<input type="number" name="price" min="0" required value="${type.price}"></label><button>Сохранить</button></form></section>` });
}

export function studentCabinet({ user, allLessons, myLessons, payments, student }) {
  return layout({ title: 'Кабинет ученика', user, body: `<section class="page-head"><div><h1>Личный кабинет</h1><p>${html(student.full_name)} · остаток занятий: ${student.remaining_visits ?? 0}</p></div></section><section class="grid three"><article class="card"><h2>Общее расписание</h2>${allLessons.map((l) => `<p>${dtRu(l.starts_at)} · ${l.count} чел.</p>`).join('') || '<p class="muted">Нет занятий.</p>'}</article><article class="card"><h2>Моё расписание и посещения</h2>${myLessons.map((l) => `<p>${dtRu(l.starts_at)} · ${statusRu(l.status)}</p>`).join('') || '<p class="muted">Нет записей.</p>'}</article><article class="card"><h2>Оплата</h2><p>${html(student.membership_name)} · <span class="pill ${student.paid_status}">${statusRu(student.paid_status)}</span></p>${payments.map((p) => `<p>${dateRu(p.paid_at)} — ${money(p.amount)}</p>`).join('') || '<p class="muted">Нет оплат.</p>'}</article></section>` });
}
