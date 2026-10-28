// State schema, validation and persistence. Every field is checked one by one,
// so a single corrupted entry is dropped instead of resetting everything.
import {
  BANGS,
  CUSTOM_PRESET,
  CUSTOM_PRESET_LIMITS,
  CHROME_ENGINE,
  CUSTOM_WALLPAPER,
  DEFAULT_CUSTOM_ACCENT,
  DEFAULT_CUSTOM_PRESET,
  DEFAULT_LAYOUT,
  DEFAULT_LINKS,
  DEFAULT_VISUAL_STYLE,
  ENGINES,
  LAYOUTS,
  LIMITS,
  PRESETS,
  SCHEMA_VERSION,
  SECTIONS,
  STORAGE_KEY,
  THEMES,
  TOOL_KEYWORDS,
  VISUAL_STYLES,
  WALLPAPERS,
} from './config.js';
import { readableAccent } from './color.js';
import { DEFAULT_APP_FAVORITES, GOOGLE_APPS } from './google-apps.js';
import { LANGUAGES } from './i18n.js';
import { normalizeRecent } from './recent.js';
import { ROTATIONS } from './rotation.js';
import { HISTORY_DAYS } from './stats.js';
import { durationFor, presetOf, readyTimer } from './timer.js';

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
    layout: DEFAULT_LAYOUT,
    visualStyle: DEFAULT_VISUAL_STYLE,
    theme: 'tokyo',
    wallpaper: 'workstation',
    wallpaperRev: 0,
    customImages: [],
    customImage: '',
    rotation: 'off',
    shade: 25,
    blur: 0,
    mouseEffects: false,
    show: Object.fromEntries(SECTIONS.map((section) => [section, true])),
    clock: { hour12: false, seconds: false },
    autoAccents: {},
    customAccent: normalizeCustomAccent(null),
    name: '',
    preset: 25,
    customPreset: { ...DEFAULT_CUSTOM_PRESET },
    engine: CHROME_ENGINE,
    showFavicons: true,
    notify: true,
    links: DEFAULT_LINKS.map((link) => ({ id: newId(), ...link })),
    prefixes: [],
    rememberSearches: true,
    recent: [],
    suggest: false,
    tasks: [],
    notes: '',
    customCSS: '',
    panelTab: 'tasks',
    apps: { visible: true, favorites: [...DEFAULT_APP_FAVORITES], account: 0 },
    stats: { total: 0, today: 0, day: '', history: {} },
    timer: readyTimer('focus', 25),
  };
}

// Accents extracted from wallpapers: { [wallpaper id or "custom:<image id>"]: "#rrggbb" }. One per
// image, so tabs showing different images (rotation) never overwrite each other's.
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

const validAccent = (key, color) =>
  typeof key === 'string' && key.length <= 64 && /^#[0-9a-f]{6}$/i.test(color);

/** Adds or refreshes one accent, keeping the most recent ones. */
export function addAccent(accents, key, color) {
  const next = { ...accents };
  delete next[key];
  next[key] = color.toLowerCase();
  const keys = Object.keys(next);
  for (const old of keys.slice(0, Math.max(0, keys.length - LIMITS.accents))) delete next[old];
  return next;
}

// Saves before schema 6 had a single { key, color }.
function normalizeAccents(value, legacy) {
  let accents = {};
  if (isObject(legacy) && validAccent(legacy.key, legacy.color)) {
    accents = addAccent(accents, legacy.key, legacy.color);
  }
  if (isObject(value)) {
    for (const [key, color] of Object.entries(value)) {
      if (validAccent(key, color)) accents = addAccent(accents, key, color);
    }
  }
  return accents;
}

function normalizeImages(value) {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((id) => typeof id === 'string' && /^[\w-]{1,40}$/.test(id));
  return [...new Set(ids)].slice(0, LIMITS.wallpapers);
}

// Color picked for the custom theme, and the readable version actually applied (boot.js uses it).
function normalizeCustomAccent(value) {
  const picked = /^#[0-9a-f]{6}$/i.test(value?.picked) ? value.picked.toLowerCase() : DEFAULT_CUSTOM_ACCENT;
  return { picked, color: readableAccent(picked) };
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

// Personal search prefixes ("jira 123" -> your Jira): { key, name, url }, where url has %s in
// place of the query. The %s must not be in the host, so the prefix alone can open the site.
export const PREFIX_KEY = /^[a-z][a-z0-9]{0,14}$/;
export const RESERVED_PREFIXES = new Set([...Object.keys(BANGS), ...TOOL_KEYWORDS]);

export function validTemplate(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text.includes('%s')) return null;
  const [a, b] = ['x', 'y'].map((sample) => validURL(text.replaceAll('%s', sample)));
  return a && b && new URL(a).origin === new URL(b).origin ? text : null;
}

/** Returns a clean { key, name, url } or null; an empty name becomes the site's host. */
export function normalizePrefix(item) {
  if (!isObject(item)) return null;
  const key = typeof item.key === 'string' ? item.key.trim().toLowerCase() : '';
  const url = validTemplate(item.url);
  if (!PREFIX_KEY.test(key) || RESERVED_PREFIXES.has(key) || !url) return null;
  const host = new URL(url.replaceAll('%s', 'x')).hostname.replace(/^www\./, '');
  return { key, name: cleanText(item.name, LIMITS.linkName) || host, url };
}

function normalizePrefixes(list) {
  const prefixes = [];
  for (const item of list) {
    const prefix = normalizePrefix(item);
    if (!prefix || prefixes.some((other) => other.key === prefix.key)) continue;
    prefixes.push(prefix);
    if (prefixes.length === LIMITS.prefixes) break;
  }
  return prefixes;
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
    total: toInt(stats.total, 0, 1e9, 0),
    today,
    day,
    history: normalizeHistory(history),
  };
}

function normalizeCustomPreset(value) {
  const minutes = (key) => toInt(value?.[key], ...CUSTOM_PRESET_LIMITS[key], DEFAULT_CUSTOM_PRESET[key]);
  return { focus: minutes('focus'), break: minutes('break') };
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
  const preset =
    input.preset === CUSTOM_PRESET
      ? CUSTOM_PRESET
      : pick(
          Number(input.preset),
          PRESETS.map((item) => item.id),
          base.preset,
        );
  const customPreset = normalizeCustomPreset(input.customPreset);
  const customImages = normalizeImages(input.customImages);
  return {
    schema: SCHEMA_VERSION,
    lang: pick(input.lang, LANGUAGES, base.lang),
    // Saves from before the modes have none: they keep the full layout they had.
    layout: pick(input.layout, LAYOUTS, base.layout),
    // Likewise saves from before the visual styles: they keep the look they had.
    visualStyle: pick(input.visualStyle, VISUAL_STYLES, base.visualStyle),
    theme: pick(input.theme, Object.keys(THEMES), base.theme),
    wallpaper: pick(input.wallpaper, [...WALLPAPERS, CUSTOM_WALLPAPER], base.wallpaper),
    wallpaperRev: toInt(input.wallpaperRev, 0, Number.MAX_SAFE_INTEGER, 0),
    customImages,
    customImage: customImages.includes(input.customImage) ? input.customImage : (customImages[0] ?? ''),
    rotation: pick(input.rotation, ROTATIONS, base.rotation),
    shade: toInt(input.shade, 0, 75, base.shade),
    blur: toInt(input.blur, 0, LIMITS.blur, base.blur),
    // Schema 5 made the mouse effects optional and off by default: older saves start with them off.
    mouseEffects: Number(input.schema) >= 5 ? bool(input.mouseEffects, base.mouseEffects) : false,
    show: Object.fromEntries(SECTIONS.map((section) => [section, bool(input.show?.[section], true)])),
    clock: { hour12: bool(input.clock?.hour12, false), seconds: bool(input.clock?.seconds, false) },
    autoAccents: normalizeAccents(input.autoAccents, input.autoAccent),
    customAccent: normalizeCustomAccent(input.customAccent),
    name: cleanText(input.name, LIMITS.name),
    preset,
    customPreset,
    // Before schema 6 Google was the implicit default: such saves now follow Chrome's own engine.
    // DuckDuckGo and GitHub were explicit choices and stay.
    engine:
      !(Number(input.schema) >= 6) && input.engine === 'google'
        ? CHROME_ENGINE
        : pick(input.engine, Object.keys(ENGINES), base.engine),
    showFavicons: bool(input.showFavicons, base.showFavicons),
    notify: bool(input.notify, base.notify),
    links: Array.isArray(input.links) ? normalizeLinks(input.links) : base.links,
    prefixes: Array.isArray(input.prefixes) ? normalizePrefixes(input.prefixes) : [],
    rememberSearches: bool(input.rememberSearches, base.rememberSearches),
    recent: input.rememberSearches === false ? [] : normalizeRecent(input.recent),
    suggest: bool(input.suggest, base.suggest),
    tasks: Array.isArray(input.tasks) ? normalizeTasks(input.tasks) : [],
    notes: typeof input.notes === 'string' ? input.notes.slice(0, LIMITS.notes) : '',
    customCSS: typeof input.customCSS === 'string' ? input.customCSS.slice(0, LIMITS.css) : '',
    panelTab: input.panelTab === 'notes' ? 'notes' : 'tasks',
    apps: normalizeApps(input.apps),
    stats: normalizeStats(input),
    timer: normalizeTimer(input.timer, presetOf({ preset, customPreset })),
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

export function loadState(storage = globalThis.localStorage) {
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked: run with defaults, saving will report the error.
  }
  const { value, corrupt } = parse(raw);
  return { state: normalizeState(value), raw, corrupt };
}

export const serialize = (state) => JSON.stringify(state);
