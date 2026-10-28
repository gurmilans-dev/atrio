// Single source of truth for every list the UI and the validation share.
// boot.js repeats STORAGE_KEY because classic scripts cannot import modules.

// Keys keep the project's former name (Workspace) so existing data still loads.
export const STORAGE_KEY = 'workspace.newtab.v2';
// Per-tab counter for the wallpaper rotation, outside the state so other tabs keep their image.
export const ROTATION_KEY = 'workspace.newtab.v2.rotation';
export const SCHEMA_VERSION = 6;

// "auto" takes its accent from the wallpaper (js/color.js), "custom" from a color picker; their
// swatches are computed. Themes without a label have their name translated (themeName in js/i18n.js).
export const AUTO_THEME = 'auto';
export const CUSTOM_THEME = 'custom';
export const DEFAULT_CUSTOM_ACCENT = '#7aa2f7';
export const THEMES = {
  tokyo: { label: 'Tokyo Night', swatch: '#7aa2f7' },
  mocha: { label: 'Mocha', swatch: '#cba6f7' },
  matrix: { label: 'Terminal', swatch: '#69dbb0' },
  light: { label: null, swatch: 'linear-gradient(135deg, #f4f6fb 50%, #3157d5 50%)' },
  [AUTO_THEME]: { label: null, swatch: null },
  [CUSTOM_THEME]: { label: null, swatch: null },
};

// Interface modes (Settings → Appearance): how the page is laid out, apart from the theme's colors
// and the wallpaper. Developer is the full workspace, Minimal the clock, search and links alone.
// Set on the root element as data-layout; boot.js applies it before the first paint.
export const LAYOUTS = ['developer', 'minimal'];
export const DEFAULT_LAYOUT = 'developer';

// Parts of the page that Settings → Page can hide (data-hide-<name> on the root element).
export const SECTIONS = ['greeting', 'clock', 'date', 'links', 'focus', 'heatmap', 'tasks'];

// Focus heatmap size; the daily history keeps exactly this many days.
export const HEATMAP_WEEKS = 20;

// Built-in wallpapers live at assets/<id>.webp; "custom" is the uploaded image. Ids are lowercase
// words, joined by hyphens (boot.js checks them before building the image's URL).
// Names are translated: wallpaper.<id> in js/i18n.js.
export const WALLPAPERS = ['workstation', 'city', 'deep-space', 'warm-sand', 'sunrise-lake', 'liquid-glass'];
export const CUSTOM_WALLPAPER = 'custom';
export const wallpaperSrc = (id) => `assets/${id}.webp`;

// Web search engines. "chrome" is the default: it searches with the provider set in Chrome, through
// the Search API, as the Chrome Web Store requires for a new tab page. Its label is translated
// (engine.chrome). The others are explicit alternatives; the prefixes below are vertical searches.
export const CHROME_ENGINE = 'chrome';
export const ENGINES = {
  [CHROME_ENGINE]: { label: null, url: null },
  google: { label: 'Google', url: 'https://www.google.com/search?q=' },
  ddg: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  github: { label: 'GitHub', url: 'https://github.com/search?q=' },
};

// Outside the extension (development server, HTTP tests) there is no Search API: Chrome-engine
// searches fall back to this address.
export const FALLBACK_SEARCH_URL = 'https://www.google.com/search?q=';

// Search prefixes: "npm zod" searches npm, "!npm zod" works too.
export const BANGS = {
  g: ENGINES.google,
  ddg: ENGINES.ddg,
  gh: ENGINES.github,
  npm: { label: 'npm', url: 'https://www.npmjs.com/search?q=' },
  mdn: { label: 'MDN', url: 'https://developer.mozilla.org/search?q=' },
  so: { label: 'Stack Overflow', url: 'https://stackoverflow.com/search?q=' },
  py: { label: 'PyPI', url: 'https://pypi.org/search/?q=' },
  ciu: { label: 'Can I use', url: 'https://caniuse.com/?search=' },
  dd: { label: 'DevDocs', url: 'https://devdocs.io/#q=' },
  yt: { label: 'YouTube', url: 'https://www.youtube.com/results?search_query=' },
};

// Keywords of the palette tools (js/devtools.js): personal search prefixes cannot use them.
export const TOOL_KEYWORDS = [
  'ts',
  'uuid',
  'pw',
  'b64',
  'b64d',
  'url',
  'urld',
  'jwt',
  'sha256',
  'json',
  'case',
  'http',
  'cron',
];

export const PRESETS = [
  { id: 25, focus: 25, break: 5 },
  { id: 50, focus: 50, break: 10 },
];
// The custom preset keeps its own durations (state.customPreset), in minutes.
export const CUSTOM_PRESET = 'custom';
export const CUSTOM_PRESET_LIMITS = { focus: [1, 180], break: [1, 60] };
export const DEFAULT_CUSTOM_PRESET = { focus: 45, break: 10 };

export const LIMITS = {
  blur: 24, // px; boot.js repeats it
  links: 30,
  tasks: 200,
  linkName: 30,
  linkSymbol: 3,
  taskText: 120,
  name: 24,
  notes: 10000,
  css: 20000,
  prefixes: 20,
  wallpapers: 8,
  accents: 16,
  recent: 30,
  recentText: 200,
  uploadBytes: 25 * 1024 * 1024,
  importBytes: 40 * 1024 * 1024,
};

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export const DEFAULT_LINKS = [
  { name: 'GitHub', url: 'https://github.com/', symbol: 'GH' },
  { name: 'ChatGPT', url: 'https://chatgpt.com/', symbol: '✦' },
  { name: 'LeetCode', url: 'https://leetcode.com/', symbol: 'LC' },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com/', symbol: 'SO' },
  { name: 'MDN Docs', url: 'https://developer.mozilla.org/', symbol: '{}' },
  { name: 'DevDocs', url: 'https://devdocs.io/', symbol: '≡' },
];
