// State schema, validation and persistence. Every field is checked one by one,
// so a single corrupted entry is dropped instead of resetting everything.
import {
  CUSTOM_WALLPAPER,
  DEFAULT_LINKS,
  ENGINES,
  LEGACY_STORAGE_KEY,
  LIMITS,
  PRESETS,
  SCHEMA_VERSION,
  STORAGE_KEY,
  THEMES,
  WALLPAPERS,
} from './config.js';
import { DEFAULT_APP_FAVORITES, GOOGLE_APPS } from './google-apps.js';
import { LANGUAGES } from './i18n.js';
import { HISTORY_DAYS } from './stats.js';
import { durationFor, readyTimer } from './timer.js';

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const newId = () => crypto.randomUUID();

function toInt(value, min, max, fallback) {
  const number = Number(value);
  if (value === null || value === '' || !Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export function validURL(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function createDefaultState() {
  return {
    schema: SCHEMA_VERSION,
    lang: 'auto',
    theme: 'tokyo',
    wallpaper: 'workstation',
    wallpaperRev: 0,
    shade: 25,
    blur: 0,
    mouseEffects: false,
    autoAccent: null,
    name: '',
    preset: 25,
    engine: 'google',
    showFavicons: true,
    notify: true,
    links: DEFAULT_LINKS.map((link) => ({ id: newId(), ...link })),
    tasks: [],
    notes: '',
    panelTab: 'tasks',
    apps: { visible: true, favorites: [...DEFAULT_APP_FAVORITES], account: 0 },
    stats: { total: 0, today: 0, day: '', history: {} },
    timer: readyTimer('focus', 25),
  };
}

// Accent extracted from a wallpaper: { key: wallpaper id or "custom:<rev>", color: "#rrggbb" }.
// Google apps launcher: favorites are known app ids in the user's order.
function normalizeApps(value) {
  const input = isObject(value) ? value : {};
  const known = new Set(GOOGLE_APPS.map((app) => app.id));
  const favorites = Array.isArray(input.favorites)
    ? [...new Set(input.favorites.filter((id) => known.has(id)))]
    : [...DEFAULT_APP_FAVORITES];
  return {
    visible: input.visible !== false,
    favorites,
    account: toInt(input.account, 0, 9, 0),
  };
}

function normalizeAccent(value) {
  if (!isObject(value) || typeof value.key !== 'string' || value.key.length > 64) return null;
  return /^#[0-9a-f]{6}$/i.test(value.color) ? { key: value.key, color: value.color.toLowerCase() } : null;
}

function normalizeHistory(value) {
  if (!isObject(value)) return {};
  const days = Object.keys(value)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort()
    .slice(-HISTORY_DAYS);
  const history = {};
  for (const key of days) {
    const count = toInt(value[key], 0, 1000, 0);
    if (count) history[key] = count;
  }
  return history;
}

function normalizeLinks(list) {
  const links = [];
  const seen = new Set();
  for (const item of list) {
    if (!isObject(item)) continue;
    const url = validURL(item.url);
    const name = cleanText(item.name, LIMITS.linkName);
    if (!url || !name) continue;
    const id = typeof item.id === 'string' && item.id && !seen.has(item.id) ? item.id : newId();
    seen.add(id);
    const symbol = cleanText(item.symbol, LIMITS.linkSymbol);
    links.push(symbol ? { id, name, url, symbol } : { id, name, url });
    if (links.length === LIMITS.links) break;
  }
  return links;
}

function normalizeTasks(list) {
  const tasks = [];
  const seen = new Set();
  for (const item of list) {
    if (!isObject(item)) continue;
    const text = cleanText(item.text, LIMITS.taskText);
    if (!text) continue;
    const rawId = item.id === undefined || item.id === null ? '' : String(item.id);
    const id = rawId && !seen.has(rawId) ? rawId : newId();
    seen.add(id);
    tasks.push({ id, text, done: item.done === true });
    if (tasks.length === LIMITS.tasks) break;
  }
  return tasks;
}

function normalizeStats(input) {
  const stats = isObject(input.stats) ? input.stats : {};
  const day = typeof stats.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stats.day) ? stats.day : '';
  const today = day ? toInt(stats.today, 0, 1e6, 0) : 0;
  const history = normalizeHistory(stats.history);
  // Data from before the heatmap: seed it with the last known day.
  if (day && today && !history[day]) history[day] = today;
  return {
    // v2 stored a single counter called completedSessions.
    total: toInt(stats.total ?? input.completedSessions, 0, 1e9, 0),
    today,
    day,
    history: normalizeHistory(history),
  };
}

function normalizeTimer(timer, preset) {
  const input = isObject(timer) ? timer : {};
  const mode = input.mode === 'break' ? 'break' : 'focus';
  const total = toInt(input.total, 1, 24 * 3600, durationFor(mode, preset));
  const running = input.running === true && Number.isFinite(input.endAt) && input.endAt > 0;
  return {
    mode,
    running,
    remaining: toInt(input.remaining, 0, total, total),
    total,
    endAt: running ? input.endAt : null,
  };
}

export function normalizeState(raw) {
  const input = isObject(raw) ? raw : {};
  const base = createDefaultState();
  const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
  const preset = pick(
    Number(input.preset),
    PRESETS.map((item) => item.id),
    base.preset,
  );
  return {
    schema: SCHEMA_VERSION,
    lang: pick(input.lang, LANGUAGES, base.lang),
    theme: pick(input.theme, Object.keys(THEMES), base.theme),
    wallpaper: pick(input.wallpaper, [...WALLPAPERS, CUSTOM_WALLPAPER], base.wallpaper),
    wallpaperRev: toInt(input.wallpaperRev, 0, Number.MAX_SAFE_INTEGER, 0),
    shade: toInt(input.shade, 0, 75, base.shade),
    blur: toInt(input.blur, 0, LIMITS.blur, base.blur),
    // Schema 5 made the mouse effects optional and off by default: older saves start with them off.
    mouseEffects: Number(input.schema) >= 5 ? bool(input.mouseEffects, base.mouseEffects) : false,
    autoAccent: normalizeAccent(input.autoAccent),
    name: cleanText(input.name, LIMITS.name),
    preset,
    engine: pick(input.engine, Object.keys(ENGINES), base.engine),
    showFavicons: bool(input.showFavicons, base.showFavicons),
    notify: bool(input.notify, base.notify),
    links: Array.isArray(input.links) ? normalizeLinks(input.links) : base.links,
    tasks: Array.isArray(input.tasks) ? normalizeTasks(input.tasks) : [],
    notes: typeof input.notes === 'string' ? input.notes.slice(0, LIMITS.notes) : '',
    panelTab: input.panelTab === 'notes' ? 'notes' : 'tasks',
    apps: normalizeApps(input.apps),
    stats: normalizeStats(input),
    timer: normalizeTimer(input.timer, preset),
  };
}

function parse(raw) {
  if (raw === null) return { value: null, corrupt: false };
  try {
    return { value: JSON.parse(raw), corrupt: false };
  } catch {
    return { value: null, corrupt: true };
  }
}

// Reads the current key, falling back to the v1 key the first time.
export function loadState(storage = globalThis.localStorage) {
  let raw = null;
  let legacy = false;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      raw = storage.getItem(LEGACY_STORAGE_KEY);
      legacy = raw !== null;
    }
  } catch {
    // Storage blocked: run with defaults, saving will report the error.
  }
  const { value, corrupt } = parse(raw);
  return { state: normalizeState(value), raw, legacy, corrupt };
}

export function readLegacyState(storage = globalThis.localStorage) {
  try {
    const { value } = parse(storage.getItem(LEGACY_STORAGE_KEY));
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

export function removeLegacyState(storage = globalThis.localStorage) {
  try {
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}

export const serialize = (state) => JSON.stringify(state);
