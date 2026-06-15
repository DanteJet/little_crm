export const CLUB_TIME_ZONE = process.env.CLUB_TIME_ZONE || 'Europe/Moscow';

const dateFormatter = (locale, options = {}) => new Intl.DateTimeFormat(locale, { timeZone: CLUB_TIME_ZONE, ...options });

export const formatClubDate = (locale, options = {}) => dateFormatter(locale, options);

export function clubDateKey(value) {
  return formatClubDate('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function clubParts(date) {
  const parts = formatClubDate('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

function offsetMs(date) {
  const p = clubParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

export function clubWallTimeToUtc(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return new Date(value);
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let utc = new Date(wallUtc - offsetMs(new Date(wallUtc)));
  utc = new Date(wallUtc - offsetMs(utc));
  return utc;
}

export function clubStartOfDayUtc(value = new Date()) {
  const key = clubDateKey(value);
  return clubWallTimeToUtc(`${key}T00:00`);
}

export function clubMonthStartUtc(value = new Date()) {
  const [year, month] = clubDateKey(value).split('-');
  return clubWallTimeToUtc(`${year}-${month}-01T00:00`);
}

export function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addUtcMonths(date, months) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function clubWeekStartUtc(value = new Date()) {
  const start = clubStartOfDayUtc(value);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: CLUB_TIME_ZONE, weekday: 'short' }).format(start);
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const daysFromMonday = (index + 6) % 7;
  return addUtcDays(start, -daysFromMonday);
}
