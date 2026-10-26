// Single source of truth for every list the UI and the validation share.
// boot.js repeats STORAGE_KEY because classic scripts cannot import modules.

// Keys keep the project's former name (Workspace) so existing data still loads.
export const STORAGE_KEY = 'workspace.newtab.v2';
export const LEGACY_STORAGE_KEY = 'devstart.v1';
export const SCHEMA_VERSION = 5;

// "auto" takes its accent from the wallpaper (js/color.js); its swatch is computed and its
// name translated (themeName in js/i18n.js).
export const AUTO_THEME = 'auto';
export const THEMES = {
  tokyo: { label: 'Tokyo Night', swatch: '#7aa2f7' },
  mocha: { label: 'Mocha', swatch: '#cba6f7' },
  matrix: { label: 'Terminal', swatch: '#69dbb0' },
  [AUTO_THEME]: { label: null, swatch: null },
};

// Focus heatmap size; the daily history keeps exactly this many days.
export const HEATMAP_WEEKS = 20;

// Built-in wallpapers live at assets/<id>.webp; "custom" is the uploaded image.
// Names are translated: wallpaper.<id> in js/i18n.js.
export const WALLPAPERS = ['workstation', 'city'];
export const CUSTOM_WALLPAPER = 'custom';
export const wallpaperSrc = (id) => `assets/${id}.webp`;

export const ENGINES = {
  google: { label: 'Google', url: 'https://www.google.com/search?q=' },
  ddg: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  github: { label: 'GitHub', url: 'https://github.com/search?q=' },
};

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

export const PRESETS = [
  { id: 25, focus: 25, break: 5 },
  { id: 50, focus: 50, break: 10 },
];

export const LIMITS = {
  blur: 24, // px; boot.js repeats it
  links: 30,
  tasks: 200,
  linkName: 30,
  linkSymbol: 3,
  taskText: 120,
  name: 24,
  notes: 10000,
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
