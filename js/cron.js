// Cron expressions for the "cron" palette tool: the five classic fields (lists, ranges, steps,
// month and weekday names) and the @daily-style macros, described in words, with the next runs.
// Classic (Vixie) cron rules: when both day fields are restricted, a day matching either one runs.
// Pure functions, see tests/cron.test.js.
import { dateFormat, t } from './i18n.js';

const FIELDS = [
  { key: 'minute', min: 0, max: 59 },
  { key: 'hour', min: 0, max: 23 },
  { key: 'day', min: 1, max: 31 },
  {
    key: 'month',
    min: 1,
    max: 12,
    offset: 1,
    names: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  },
  // 0 and 7 are both Sunday.
  { key: 'weekday', min: 0, max: 7, offset: 0, names: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
];

const MACROS = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};
export const CRON_MACROS = Object.keys(MACROS);

const LOOKAHEAD_DAYS = 366 * 5;

function valueOf(text, field) {
  const index = field.names?.indexOf(text) ?? -1;
  const value = index >= 0 ? index + field.offset : /^\d+$/.test(text) ? Number(text) : NaN;
  return value >= field.min && value <= field.max ? value : null;
}

function parseField(text, field) {
  const values = new Set();
  const parts = [];
  for (const part of text.split(',')) {
    const match = part.match(/^(\*|[a-z0-9]+)(?:-([a-z0-9]+))?(?:\/(\d+))?$/);
    if (!match) return null;
    const [, from, to, stepText] = match;
    const step = stepText === undefined ? 1 : Number(stepText);
    const star = from === '*';
    if (step < 1 || (star && to !== undefined)) return null;
    const start = star ? field.min : valueOf(from, field);
    // "5/15" runs from 5 to the end of the field, as most crons read it.
    const open = star || (to === undefined && stepText !== undefined);
    const end = open ? field.max : to === undefined ? start : valueOf(to, field);
    if (start === null || end === null || start > end) return null;
    for (let value = start; value <= end; value += step) {
      values.add(field.key === 'weekday' ? value % 7 : value);
    }
    parts.push({ star, start, end, step });
  }
  return {
    parts,
    values: [...values].sort((a, b) => a - b),
    any: text === '*',
    // Classic cron: a day field starting with "*" (even "*/2") does not count as restricted.
    restricted: !text.startsWith('*'),
  };
}

/** { fields: { minute, hour, day, month, weekday } }, or { error: 'fields' | 'reboot' | <field key> }. */
export function parseCron(text) {
  const source = String(text ?? '')
    .trim()
    .toLowerCase();
  if (source === '@reboot') return { error: 'reboot' };
  const tokens = (Object.hasOwn(MACROS, source) ? MACROS[source] : source).split(/\s+/);
  if (tokens.length !== FIELDS.length) return { error: 'fields' };
  const fields = {};
  for (const [index, field] of FIELDS.entries()) {
    const parsed = parseField(tokens[index], field);
    if (!parsed) return { error: field.key };
    fields[field.key] = parsed;
  }
  return { fields };
}

function dayMatches({ day, month, weekday }, date) {
  if (!month.values.includes(date.getMonth() + 1)) return false;
  const byDay = day.values.includes(date.getDate());
  const byWeekday = weekday.values.includes(date.getDay());
  return day.restricted && weekday.restricted ? byDay || byWeekday : byDay && byWeekday;
}

/** The next `count` runs strictly after `now`, in local time, looking up to five years ahead. */
export function nextRuns({ fields }, now, count = 3) {
  const runs = [];
  const from = new Date(now);
  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset++) {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    if (!dayMatches(fields, date)) continue;
    for (const hour of fields.hour.values) {
      for (const minute of fields.minute.values) {
        const run = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
        // A time skipped by a daylight-saving change does not exist that day.
        if (run.getHours() !== hour || run.getMinutes() !== minute || run <= from) continue;
        runs.push(run);
        if (runs.length === count) return runs;
      }
    }
  }
  return runs;
}

const pad = (value) => String(value).padStart(2, '0');
const monthName = (month) =>
  dateFormat({ month: 'long', timeZone: 'UTC' }).format(Date.UTC(2024, month - 1, 1));
// 7 January 2024 was a Sunday.
const weekdayName = (day) =>
  dateFormat({ weekday: 'long', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 7 + (day % 7)));

const isSingle = (field) =>
  field.parts.length === 1 && !field.parts[0].star && field.parts[0].start === field.parts[0].end;
const everyN = (field) => (field.parts.length === 1 && field.parts[0].star ? field.parts[0].step : 0);

function listOf(field, name = String) {
  return field.parts
    .map(({ star, start, end, step }) => {
      if (star) return t('cron.every', { n: step });
      const range = start === end ? name(start) : `${name(start)}–${name(end)}`;
      return step > 1 ? t('cron.step', { range, n: step }) : range;
    })
    .join(', ');
}

/** "At 09:00, on Monday–Friday", "Every 15 minutes, hours 9–18"… in the interface language. */
export function describeCron({ fields }) {
  const { minute, hour, day, month, weekday } = fields;
  const pieces = [];
  const hourList = !hour.any && hour.parts.every((part) => !part.star && part.start === part.end);
  const atTimes = isSingle(minute) && hourList && hour.values.length <= 4;
  if (atTimes) {
    const times = hour.values.map((value) => `${pad(value)}:${pad(minute.values[0])}`).join(', ');
    pieces.push(t('cron.at', { times }));
  } else {
    if (minute.any) pieces.push(t('cron.everyMinute'));
    else if (everyN(minute) > 1) pieces.push(t('cron.everyNMinutes', { n: everyN(minute) }));
    else pieces.push(t('cron.atMinutes', { n: minute.values.length, list: listOf(minute) }));

    if (hour.any) {
      if (!minute.any && !(everyN(minute) > 1)) pieces[0] += ` ${t('cron.pastEveryHour')}`;
    } else if (everyN(hour) > 1) pieces.push(t('cron.everyNHours', { n: everyN(hour) }));
    else pieces.push(t('cron.hours', { list: listOf(hour) }));
  }

  const days = [];
  if (!day.any) {
    days.push(
      everyN(day) > 1
        ? t('cron.everyNDays', { n: everyN(day) })
        : t('cron.days', { n: day.values.length, list: listOf(day) }),
    );
  }
  if (!weekday.any) days.push(t('cron.weekdays', { list: listOf(weekday, weekdayName) }));
  if (days.length) pieces.push(days.join(day.restricted && weekday.restricted ? t('cron.or') : ', '));
  if (!month.any) {
    pieces.push(
      everyN(month) > 1
        ? t('cron.everyNMonths', { n: everyN(month) })
        : t('cron.months', { list: listOf(month, monthName) }),
    );
  }
  if (atTimes && day.any && weekday.any && month.any) pieces.push(t('cron.everyDay'));

  const text = pieces.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
