# Енот Archery CRM

Полноценная CRM для клуба стрельбы из лука: публичная страница, личный кабинет администратора, личный кабинет ученика, расписание, ученики, абонементы, посещения и оплаты. Интерфейс выполнен в спокойной зелёной палитре, временный маскот — енот 🦝, логотип можно заменить позже.

## Что реализовано

- **Главная страница**: информация о клубе, ценовая политика, обезличенное расписание на месяц с количеством занимающихся и кнопкой входа.
- **Администратор**:
  - недельное расписание с переключением на месяц;
  - добавление занятия для одного или нескольких учеников;
  - автозаполнение занятия на месяц по выбранному дню недели и времени;
  - баннер о ближайших днях рождения за 14 дней;
  - список учеников, просмотр/редактирование, проставление занятия по абонементу, статус оплаты;
  - вкладка абонементов;
  - вкладка типов абонементов с формой добавления;
  - добавление ученика с ФИО, датой рождения, типом, логином/паролем, типом абонемента, комментарием и отметкой согласия на обработку ПДн;
  - история посещений и оплат ученика.
- **Ученик**:
  - общее расписание;
  - своё расписание и посещения;
  - информация по оплате и абонементу.
- **База данных**: SQLite, таблицы пользователей, учеников, типов абонементов, абонементов, занятий, посещений и оплат.
- **Безопасность**: роли `admin`/`student`, httpOnly-сессии, хеширование паролей через `scrypt`, экранирование HTML, внешние зависимости не требуются.

## Исследование аналогичных CRM

При проектировании учтены типовые функции спортивных CRM и club-management систем: расписание, посещаемость, membership/pass accounting, платежи, карточка участника, родительский/ученический доступ и публичные обновления. В качестве ориентиров использовались описания Pitchero, ClubCloud, SportEasy, Clubiqo и Inf CRM.

Полезные ссылки: Pitchero — https://www.pitchero.com/, ClubCloud — https://clubcloud.com/features, SportEasy — https://www.sporteasy.net/en/clubs/features/crm-for-clubs/, Clubiqo — https://clubiqo.com/en/, Inf CRM — https://infcrm.app/en.

## Требования

- Node.js **24+** — используется встроенный модуль `node:sqlite`.
- Linux-сервер или локальная машина.
- Reverse proxy с HTTPS для продакшена: Nginx, Caddy или Traefik.

Пакетов из npm устанавливать не нужно: проект работает на стандартной библиотеке Node.js.

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

> В продакшене обязательно задайте собственный пароль через переменные окружения до первого запуска на пустой базе.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `PORT` | `3000` | порт приложения |
| `DB_PATH` | `./data/crm.sqlite` | путь к SQLite-базе |
| `SESSION_SECRET` | `dev-secret-change-me` | секрет подписи cookie-сессии |
| `ADMIN_LOGIN` | `admin` | логин администратора при первичном seed |
| `ADMIN_PASSWORD` | `admin123` | пароль администратора при первичном seed |

Пример локального запуска:

```bash
PORT=3000 \
DB_PATH=./data/crm.sqlite \
SESSION_SECRET='replace-with-long-random-secret' \
ADMIN_LOGIN='owner' \
ADMIN_PASSWORD='change-this-password' \
npm start
```

## Развертывание на сервере

### 1. Подготовьте пользователя и директории

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin little-crm
sudo mkdir -p /opt/little_crm /var/lib/little_crm
sudo chown -R little-crm:little-crm /opt/little_crm /var/lib/little_crm
```

### 2. Скопируйте код

```bash
sudo rsync -a --delete ./ /opt/little_crm/
sudo chown -R little-crm:little-crm /opt/little_crm
```

### 3. Создайте environment-файл

```bash
sudo tee /etc/little-crm.env >/dev/null <<'ENV'
PORT=3000
DB_PATH=/var/lib/little_crm/crm.sqlite
SESSION_SECRET=replace-with-64-random-characters
ADMIN_LOGIN=owner
ADMIN_PASSWORD=replace-before-first-start
ENV
sudo chmod 600 /etc/little-crm.env
```

### 4. Создайте systemd unit

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

### 5. Настройте HTTPS reverse proxy на Nginx

```nginx
server {
    listen 80;
    server_name crm.example.ru;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.example.ru;

    ssl_certificate /etc/letsencrypt/live/crm.example.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.example.ru/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Резервное копирование

SQLite хранится в одном файле и WAL-файлах. Делайте ежедневные бэкапы всей директории `DB_PATH`:

```bash
sudo systemctl stop little-crm
sudo tar -czf /backup/little-crm-$(date +%F).tar.gz /var/lib/little_crm
sudo systemctl start little-crm
```

Для «горячего» бэкапа можно использовать `sqlite3` с `.backup`, если пакет установлен:

```bash
sqlite3 /var/lib/little_crm/crm.sqlite ".backup '/backup/little-crm-$(date +%F).sqlite'"
```

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
src/db.js          миграции, схема БД и начальные данные
src/security.js    пароли, подпись сессий, cookies, HTML escaping
src/server.js      HTTP-сервер, роутинг, бизнес-операции
src/views.js       HTML-шаблоны страниц
public/styles.css  спокойная зелёная тема интерфейса
test/*.test.js     базовые автотесты
```

## Дальнейшее развитие

- Заменить временный emoji-маскот на фирменный логотип и енота после предоставления файлов.
- Добавить экспорт в CSV/XLSX.
- Добавить роли тренеров.
- Добавить SMS/Telegram-напоминания о занятиях и оплатах.
- Добавить интеграцию с онлайн-кассой и платёжным провайдером.
- Добавить загрузку договоров/согласий и журнал версий документов.
