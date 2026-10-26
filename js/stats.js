// Focus statistics: daily history, streak and the GitHub-style heatmap. Pure functions.
import { HEATMAP_WEEKS } from './config.js';

export const HISTORY_DAYS = HEATMAP_WEEKS * 7;

export function dayKey(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Local noon avoids DST surprises when stepping one day at a time.
function noon(time) {
  const date = new Date(time);
  date.setHours(12, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export const sessionsToday = (stats, now) => (stats.day === dayKey(new Date(now)) ? stats.today : 0);

/** Counts one finished focus session on the day it ended; history older than the heatmap is dropped. */
export function recordSession(stats, endAt) {
  const day = dayKey(new Date(endAt));
  const oldest = dayKey(addDays(noon(endAt), -HISTORY_DAYS));
  const history = { ...stats.history, [day]: (stats.history[day] ?? 0) + 1 };
  for (const key of Object.keys(history)) if (key < oldest) delete history[key];
  return {
    total: stats.total + 1,
    today: stats.day === day ? stats.today + 1 : 1,
    day,
    history,
  };
}

/** Consecutive days with at least one session, ending today (or yesterday if today is still empty). */
export function streak(history, now) {
  let day = noon(now);
  if (!history[dayKey(day)]) day = addDays(day, -1);
  let count = 0;
  while (history[dayKey(day)] > 0) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

/** Week columns (Monday → Sunday), oldest first; the last column holds today, future days are null. */
export function heatmap(history, now, weeks = HEATMAP_WEEKS) {
  const today = noon(now);
  const weekday = (today.getDay() + 6) % 7;
  const start = addDays(today, -weekday - (weeks - 1) * 7);
  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = addDays(start, index);
    if (date > today) return null;
    const key = dayKey(date);
    return { key, date, count: history[key] ?? 0, today: key === dayKey(today) };
  });
}

export function heatLevel(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}
