import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashPassword } from './security.js';

const dbPath = process.env.DB_PATH || './data/crm.sqlite';
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((info) => info.name === column);
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','student')),
      full_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      must_change_password INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS membership_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      visits INTEGER NOT NULL CHECK (visits > 0),
      price INTEGER NOT NULL CHECK (price >= 0),
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      student_type TEXT NOT NULL CHECK (student_type IN ('child','adult')),
      membership_type_id INTEGER REFERENCES membership_types(id),
      comment TEXT DEFAULT '',
      consent_received INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      membership_type_id INTEGER NOT NULL REFERENCES membership_types(id),
      total_visits INTEGER NOT NULL,
      remaining_visits INTEGER NOT NULL,
      paid_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (paid_status IN ('paid','partial','unpaid')),
      started_at TEXT NOT NULL DEFAULT CURRENT_DATE,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      starts_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      title TEXT NOT NULL DEFAULT 'Тренировка',
      comment TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS lesson_students (
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','visited','missed')),
      PRIMARY KEY (lesson_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
      amount INTEGER NOT NULL CHECK (amount >= 0),
      paid_at TEXT NOT NULL DEFAULT CURRENT_DATE,
      method TEXT NOT NULL DEFAULT 'Online payment',
      comment TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS attendance_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
      admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      happened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      note TEXT DEFAULT ''
    );
  `);

  if (!hasColumn('users', 'full_name')) {
    db.exec("ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''");
  }
  if (!hasColumn('users', 'must_change_password')) {
    db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
  }
  if (!hasColumn('membership_types', 'is_active')) {
    db.exec('ALTER TABLE membership_types ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }
  if (!hasColumn('attendance_log', 'admin_user_id')) {
    db.exec('ALTER TABLE attendance_log ADD COLUMN admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
  }
}

export function seed() {
  const adminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get().count;
  if (!adminCount) {
    db.prepare('INSERT INTO users (login, password_hash, role, full_name) VALUES (?, ?, ?, ?)')
      .run(process.env.ADMIN_LOGIN || 'admin', hashPassword(process.env.ADMIN_PASSWORD || 'admin123'), 'admin', process.env.ADMIN_FULL_NAME || 'Главный администратор');
  }
  db.prepare("UPDATE users SET full_name=login WHERE role='admin' AND trim(full_name)= ''").run();
  const typeCount = db.prepare('SELECT COUNT(*) AS count FROM membership_types').get().count;
  if (!typeCount) {
    db.prepare('INSERT INTO membership_types (name, visits, price) VALUES (?, ?, ?)').run('Пробное занятие', 1, 1000);
    db.prepare('INSERT INTO membership_types (name, visits, price) VALUES (?, ?, ?)').run('Абонемент 8 занятий', 8, 7200);
    db.prepare('INSERT INTO membership_types (name, visits, price) VALUES (?, ?, ?)').run('Абонемент 12 занятий', 12, 9600);
  }
}

export function initDb() {
  migrate();
  seed();
}
