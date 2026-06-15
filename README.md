# Малыш Джон Archery CRM

CRM и публичный сайт для клуба традиционной стрельбы из лука «Малыш Джон»: витрина клуба, открытое расписание, кабинет администратора, кабинет ученика, учёт учеников, администраторов, абонементов, посещений и оплат. Приложение работает без npm-зависимостей: только стандартная библиотека Node.js и встроенный `node:sqlite`.

## Что реализовано

### Публичная часть

- **Главная страница клуба** с описанием тренировок, преимуществ, услуг и цен.
- **Фотослайдер с клубными фотографиями** из каталога `img/`.
- **Логотип и маскот** клуба в шапке и hero-блоке.
- **Открытое расписание на месяц**: для посетителей показываются дата, время, длительность и обезличенное количество участников без ФИО учеников.
- **Адаптивная зелёная тема** для десктопа и мобильных устройств.

### Администратор

- **Расписание**:
  - календарь на неделю или месяц;
  - добавление занятия в модальном окне;
  - выбор нескольких учеников на одно занятие;
  - отдельный удобный выбор даты и времени;
  - сохранение времени как локального времени клуба (по умолчанию `Asia/Irkutsk`, можно изменить через `CLUB_TIME_ZONE`);
  - автозаполнение занятий на месяц по выбранному дню недели и времени;
  - редактирование и удаление существующих занятий;
  - комментарий к занятию, видимый администратору.
- **Ученики**:
  - список учеников с типом, абонементом, использованными и оставшимися посещениями, статусом оплаты;
  - создание ученика с ФИО, датой рождения, типом «ребёнок/взрослый», логином, паролем, типом абонемента, комментарием и отметкой согласия на обработку ПДн;
  - редактирование карточки ученика;
  - просмотр истории посещений и оплат;
  - ручная корректировка остатка посещений без добавления записи в историю;
  - проставление посещения по абонементу;
  - отмена ошибочно проставленного посещения с восстановлением счётчика;
  - автоматическое создание нового счётчика абонемента, если посещение проставлено при нулевом остатке.
- **Оплаты**:
  - быстрый перевод текущего абонемента в статус «Оплачено»;
  - добавление платежа с суммой, способом оплаты и комментарием;
  - автоматический сброс счётчика посещений после оплаты, если предыдущий абонемент был израсходован.
- **Абонементы и типы абонементов**:
  - список выданных абонементов;
  - создание и редактирование типов абонементов;
  - мягкое удаление типов абонементов через флаг активности, чтобы не ломать исторические записи.
- **Администраторы и тренеры**:
  - создание дополнительных администраторских доступов;
  - редактирование ФИО, логина и пароля администратора;
  - удаление других администраторов с защитой от удаления текущего пользователя и последнего администратора.
- **Напоминания**:
  - баннер ближайших дней рождения учеников за 14 дней.

### Ученик

- Личный кабинет с вкладками:
  - **общее расписание** на месяц;
  - **моё расписание** и статусы занятий;
  - **оплата** и история платежей.
- Отображение текущего абонемента, статуса оплаты и остатка занятий.

### База данных и безопасность

- SQLite-база с WAL-журналом.
- Миграции создают и дополняют таблицы при старте приложения.
- Таблицы: `users`, `students`, `membership_types`, `subscriptions`, `lessons`, `lesson_students`, `payments`, `attendance_log`.
- Роли `admin` и `student`.
- Подписанные httpOnly cookie-сессии с `SameSite=Lax`.
- Хеширование паролей через `scrypt`.
- Экранирование HTML в шаблонах.
- Статические файлы отдаются только из `/public/` и `/img/`.

## Требования

- Linux-сервер или локальная машина.
- Node.js **24+** — нужен встроенный модуль `node:sqlite`.
- Git для получения и обновления кода.
- Для продакшена: reverse proxy с HTTPS — Nginx, Caddy или Traefik.
- npm-пакеты устанавливать не нужно, зависимостей в `package.json` нет.

## Быстрый локальный запуск

```bash
git clone <repo-url> little_crm
cd little_crm
node --version
npm test
npm start
```

Откройте: <http://localhost:3000>

Демо-доступ администратора:

- логин: `admin`
- пароль: `admin123`

> В продакшене обязательно задайте собственный логин, ФИО и пароль администратора через переменные окружения **до первого запуска на пустой базе**.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `PORT` | `3000` | порт HTTP-сервера приложения |
| `DB_PATH` | `./data/crm.sqlite` | путь к SQLite-базе |
| `SESSION_SECRET` | `dev-secret-change-me` | секрет подписи cookie-сессии |
| `ADMIN_LOGIN` | `admin` | логин администратора при первичном seed |
| `ADMIN_PASSWORD` | `admin123` | пароль администратора при первичном seed |
| `ADMIN_FULL_NAME` | `Главный администратор` | ФИО администратора при первичном seed |

Пример локального запуска:

```bash
PORT=3000 \
DB_PATH=./data/crm.sqlite \
SESSION_SECRET='replace-with-long-random-secret' \
ADMIN_LOGIN='owner' \
ADMIN_PASSWORD='change-this-password' \
ADMIN_FULL_NAME='Иван Иванов' \
npm start
```

## Подробное развертывание и настройка на чистом сервере

Ниже пример для чистого Ubuntu/Debian-сервера с systemd, Nginx и Let's Encrypt. Для других дистрибутивов команды установки пакетов могут отличаться.

### 1. Обновите сервер и установите базовые пакеты

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git rsync nginx
```

### 2. Установите Node.js 24+

Проверьте версию из системного репозитория:

```bash
node --version || true
```

Если Node.js отсутствует или версия ниже 24, установите актуальную версию удобным для вашей инфраструктуры способом. Например, через NodeSource, официальный бинарный архив Node.js или корпоративный пакетный репозиторий. После установки проверьте:

```bash
node --version
npm --version
```

Ожидаемо: `node` должен быть `v24.x.x` или новее.

### 3. Создайте системного пользователя и рабочие директории

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin little-crm
sudo mkdir -p /opt/little_crm /var/lib/little_crm /var/backups/little_crm
sudo chown -R little-crm:little-crm /opt/little_crm /var/lib/little_crm
sudo chmod 750 /var/lib/little_crm
```

- `/opt/little_crm` — код приложения.
- `/var/lib/little_crm` — SQLite-база и WAL-файлы.
- `/var/backups/little_crm` — резервные копии.

### 4. Загрузите код приложения

Вариант через Git:

```bash
sudo git clone <repo-url> /opt/little_crm
sudo chown -R little-crm:little-crm /opt/little_crm
```

Если код уже собран локально, можно скопировать его через `rsync`:

```bash
sudo rsync -a --delete ./ /opt/little_crm/
sudo chown -R little-crm:little-crm /opt/little_crm
```

### 5. Проверьте приложение перед первым запуском

```bash
cd /opt/little_crm
sudo -u little-crm node --version
sudo -u little-crm npm test
```

Так как внешних зависимостей нет, `npm install` не требуется.

### 6. Сгенерируйте секреты

```bash
openssl rand -hex 32
```

Сохраните результат для `SESSION_SECRET`. Пароль администратора задайте длинным и уникальным. Эти значения понадобятся только до первичного создания базы: seed администратора выполняется, когда в базе ещё нет пользователей с ролью `admin`.

### 7. Создайте environment-файл

```bash
sudo tee /etc/little-crm.env >/dev/null <<'ENV'
PORT=3000
DB_PATH=/var/lib/little_crm/crm.sqlite
SESSION_SECRET=replace-with-64-random-hex-characters
ADMIN_LOGIN=owner
ADMIN_PASSWORD=replace-before-first-start
ADMIN_FULL_NAME=Главный администратор клуба
ENV
sudo chown root:little-crm /etc/little-crm.env
sudo chmod 640 /etc/little-crm.env
```

Важно:

- не коммитьте `/etc/little-crm.env` в репозиторий;
- меняйте `ADMIN_PASSWORD` до первого запуска на пустой базе;
- после создания администратора пароль лучше менять через интерфейс администраторов или пересозданием пользователя вручную в базе, потому что повторный seed не перезаписывает существующего администратора.

### 8. Создайте systemd unit

```bash
sudo tee /etc/systemd/system/little-crm.service >/dev/null <<'UNIT'
[Unit]
Description=Little Archery CRM
After=network.target

[Service]
Type=simple
User=little-crm
Group=little-crm
WorkingDirectory=/opt/little_crm
EnvironmentFile=/etc/little-crm.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/var/lib/little_crm

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now little-crm
sudo systemctl status little-crm
```

Проверьте логи:

```bash
sudo journalctl -u little-crm -n 100 --no-pager
```

Локальная проверка на сервере:

```bash
curl -I http://127.0.0.1:3000/
```

### 9. Настройте домен и DNS

Создайте DNS A/AAAA-запись, например:

```text
crm.example.ru -> <PUBLIC_SERVER_IP>
```

Дождитесь распространения DNS и проверьте:

```bash
dig +short crm.example.ru
```

### 10. Настройте Nginx reverse proxy

Создайте конфигурацию:

```bash
sudo tee /etc/nginx/sites-available/little-crm >/dev/null <<'NGINX'
server {
    listen 80;
    server_name crm.example.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/little-crm /etc/nginx/sites-enabled/little-crm
sudo nginx -t
sudo systemctl reload nginx
```

### 11. Выпустите HTTPS-сертификат Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d crm.example.ru
sudo certbot renew --dry-run
```

После выпуска сертификата убедитесь, что сайт открывается по HTTPS:

```bash
curl -I https://crm.example.ru/
```

Рекомендуемые security-заголовки можно добавить в HTTPS-блок Nginx:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
```

### 12. Первый вход и базовая настройка CRM

1. Откройте `https://crm.example.ru/`.
2. Войдите под `ADMIN_LOGIN` и `ADMIN_PASSWORD` из `/etc/little-crm.env`.
3. Перейдите в раздел **Администраторы** и при необходимости создайте доступы тренерам.
4. Перейдите в **Типы абонементов** и настройте реальные цены и количество занятий.
5. Добавьте учеников в разделе **Ученики**.
6. Создайте занятия в расписании, при необходимости включив заполнение на месяц.
7. Проверьте кабинет одного ученика по созданному логину и паролю.

### 13. Обновление приложения на сервере

```bash
cd /opt/little_crm
sudo -u little-crm git pull --ff-only
sudo -u little-crm npm test
sudo systemctl restart little-crm
sudo journalctl -u little-crm -n 100 --no-pager
```

Миграции выполняются автоматически при старте приложения.

### 14. Диагностика типовых проблем

- **`Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite`** — установлена версия Node.js ниже 24.
- **Приложение не создаёт базу** — проверьте права пользователя `little-crm` на каталог `/var/lib/little_crm`.
- **Не работает вход** — убедитесь, что seed администратора выполнялся с правильными `ADMIN_LOGIN`/`ADMIN_PASSWORD`; если база уже была создана, переменные окружения не перезаписывают существующего администратора.
- **Сайт открывается по HTTP, но не по HTTPS** — проверьте DNS, firewall, Nginx и выпуск сертификата Certbot.
- **В расписании время отображается не так, как введено** — приложение хранит дату в UTC, но формы, вывод и границы текущего дня работают в часовом поясе клуба (`CLUB_TIME_ZONE`, по умолчанию `Asia/Irkutsk`).

## Резервное копирование

SQLite хранится в файле базы и WAL-файлах рядом с ним. Минимальный безопасный вариант — остановить приложение и архивировать весь каталог данных:

```bash
sudo systemctl stop little-crm
sudo tar -czf /var/backups/little_crm/little-crm-$(date +%F).tar.gz /var/lib/little_crm
sudo systemctl start little-crm
```

Для «горячего» бэкапа можно использовать `sqlite3` с `.backup`, если пакет установлен:

```bash
sudo apt install -y sqlite3
sqlite3 /var/lib/little_crm/crm.sqlite ".backup '/var/backups/little_crm/little-crm-$(date +%F).sqlite'"
```

Пример ежедневного cron-задания для холодного бэкапа:

```bash
sudo tee /etc/cron.daily/little-crm-backup >/dev/null <<'CRON'
#!/bin/sh
set -eu
systemctl stop little-crm
tar -czf /var/backups/little_crm/little-crm-$(date +%F).tar.gz /var/lib/little_crm
systemctl start little-crm
find /var/backups/little_crm -type f -name 'little-crm-*' -mtime +30 -delete
CRON
sudo chmod +x /etc/cron.daily/little-crm-backup
```

Периодически проверяйте восстановление на отдельном сервере или локальной машине.

## Персональные данные и 152-ФЗ

Приложение спроектировано так, чтобы упростить соблюдение требований к обработке персональных данных, но оно **не заменяет юридический аудит**. Для реальной эксплуатации в РФ владельцу клуба нужно выполнить организационные меры оператора персональных данных.

Ориентиры по законодательству и регулятору:

- Федеральный закон РФ от 27.07.2006 № 152-ФЗ «О персональных данных» регулирует сбор, запись, хранение, использование, передачу и уничтожение ПДн.
- Роскомнадзор указывает, что оператор должен направлять уведомление об обработке персональных данных, если не применимо исключение, и предоставляет портал для подготовки уведомлений: https://pd.rkn.gov.ru/operators-registry/notification/form/.
- В системе есть явная отметка «Получено согласие на обработку персональных данных», но сам текст согласия и политики должен быть подготовлен под реквизиты вашего клуба.

### Практический чек-лист перед запуском

1. Назначить ответственного за обработку персональных данных.
2. Подготовить и опубликовать политику обработки ПДн.
3. Подготовить отдельные согласия на обработку ПДн для взрослых учеников и законных представителей детей.
4. Уведомить Роскомнадзор о начале/осуществлении обработки, если ваша ситуация не подпадает под исключения.
5. Хранить базу и резервные копии на инфраструктуре, соответствующей требованиям локализации ПДн граждан РФ.
6. Выдать доступ только администраторам клуба, использовать сложные пароли и HTTPS.
7. Ограничить срок хранения: удалять или обезличивать данные после достижения целей обработки и истечения обязательных сроков хранения документов.
8. Вести журнал организационных решений: кто имеет доступ, где хранятся бэкапы, как отрабатываются запросы субъектов ПДн.

## Структура проекта

```text
src/db.js          миграции, схема БД, WAL и начальные данные
src/security.js    пароли, подпись сессий, cookies, HTML escaping
src/server.js      HTTP-сервер, роутинг, бизнес-операции
src/views.js       HTML-шаблоны страниц и календарей
public/styles.css  адаптивная зелёная тема интерфейса
public/app.js      поведение модальных окон и составного выбора даты/времени
img/*              логотип, маскот и фотографии публичной страницы
test/*.test.js     автотесты базы, безопасности, расписания, посещений, оплат и шаблонов
```

## Исследование аналогичных CRM

При проектировании учтены типовые функции спортивных CRM и club-management систем: расписание, посещаемость, membership/pass accounting, платежи, карточка участника, родительский/ученический доступ и публичные обновления. В качестве ориентиров использовались описания Pitchero, ClubCloud, SportEasy, Clubiqo и Inf CRM.

Полезные ссылки: Pitchero — https://www.pitchero.com/, ClubCloud — https://clubcloud.com/features, SportEasy — https://www.sporteasy.net/en/clubs/features/crm-for-clubs/, Clubiqo — https://clubiqo.com/en/, Inf CRM — https://infcrm.app/en.

## Дальнейшее развитие

- Добавить экспорт в CSV/XLSX.
- Добавить отдельную роль тренера с ограниченными правами.
- Добавить SMS/Telegram-напоминания о занятиях и оплатах.
- Добавить интеграцию с онлайн-кассой и платёжным провайдером.
- Добавить загрузку договоров/согласий и журнал версий документов.
- Добавить журнал аудита действий администраторов.
