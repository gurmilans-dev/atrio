// Recent searches: what was typed and run from the search box, newest first. They are kept only
// in this browser and can be turned off in Settings → General. Pure functions, see
// tests/recent.test.js.
import { LIMITS } from './config.js';
import { fuzzyScore } from './fuzzy.js';

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/** Puts `text` on top; an older copy (even with different case) is dropped, the list is capped. */
export function addRecent(list, text) {
  const value = String(text ?? '')
    .trim()
    .slice(0, LIMITS.recentText);
  if (!value) return list;
  return [value, ...list.filter((item) => !same(item, value))].slice(0, LIMITS.recent);
}

/** The latest searches with nothing typed; otherwise those containing the text, newest first. */
export function matchRecent(list, text, max) {
  const query = text.trim();
  if (!query) return list.slice(0, max);
  return list
    .filter((item) => !same(item, query) && fuzzyScore(query, item, { subsequence: false }) >= 0)
    .slice(0, max);
}

/** Cleans a saved list: strings only, oldest copies of duplicates dropped, capped. */
export const normalizeRecent = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string').reduceRight((list, item) => addRecent(list, item), [])
    : [];
