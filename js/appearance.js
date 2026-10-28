// Theme, wallpaper, shade and blur. boot.js already applied the saved values before the
// first paint; this module keeps them in sync, loads the user's own image this tab shows (see
// js/rotation.js) and sets the accent of the automatic theme (extracted from the wallpaper shown)
// and of the custom one (picked by the user).
import { FALLBACK_ACCENT, pickAccent } from './color.js';
import { checkCSS, scopeCSS } from './custom-css.js';
import { AUTO_THEME, CUSTOM_THEME, CUSTOM_WALLPAPER, LIMITS, SECTIONS, wallpaperSrc } from './config.js';
import { localDay, shownImage } from './rotation.js';
import { addAccent } from './state.js';
import { getState, subscribe, update } from './store.js';
import { getImage, storedImageIds } from './wallpaper.js';

const root = document.documentElement;
// This tab's number for the "every new tab" rotation, counted by boot.js.
const tabCounter = Number(root.dataset.rotation) || 0;
let customKey = null;
let customPromise = null;
let paintedURL = null;
let samplingKey = null;

/** The id of the user's image this tab shows when the wallpaper is one of them, or null. */
export const shownImageId = (state) => shownImage(state, { day: localDay(Date.now()), counter: tabCounter });

// Identifies the image the accent was computed from.
// null while the wallpaper is the user's but no image is listed yet (repairImages may add it).
export function accentKey(state) {
  if (state.wallpaper !== CUSTOM_WALLPAPER) return state.wallpaper;
  const id = shownImageId(state);
  return id ? `custom:${id}` : null;
}

// Reads a 64×36 thumbnail of the wallpaper: a few thousand pixels are plenty for a hue.
async function sampleWallpaper(state) {
  const blob =
    state.wallpaper === CUSTOM_WALLPAPER
      ? await getImage(shownImageId(state))
      : await (await fetch(wallpaperSrc(state.wallpaper))).blob();
  if (!blob) return FALLBACK_ACCENT;
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: 64,
    resizeHeight: 36,
    resizeQuality: 'medium',
  });
  const canvas = new OffscreenCanvas(64, 36);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return pickAccent(context.getImageData(0, 0, 64, 36).data);
}

function applyAccent(state) {
  if (state.theme === CUSTOM_THEME) {
    root.style.setProperty('--accent', state.customAccent.color);
    return;
  }
  if (state.theme !== AUTO_THEME) {
    root.style.removeProperty('--accent');
    return;
  }
  const key = accentKey(state);
  if (!key) return;
  if (Object.hasOwn(state.autoAccents, key)) {
    root.style.setProperty('--accent', state.autoAccents[key]);
    return;
  }
  // Computed once per image, then saved: boot.js applies it before the first paint.
  if (samplingKey === key) return;
  samplingKey = key;
  sampleWallpaper(state)
    .catch(() => FALLBACK_ACCENT)
    .then((color) => {
      samplingKey = null;
      if (accentKey(getState()) !== key) return;
      update((current) => {
        current.autoAccents = addAccent(current.autoAccents, key, color);
      });
    });
}

// Object URL of one of the user's images, decoded and ready to paint (null if missing). The last
// one is cached; wallpaperRev changes when a backup may have put another image under the same id.
function loadCustomWallpaper(id, rev) {
  const key = `${id}:${rev}`;
  if (customPromise && key === customKey) return customPromise;
  customKey = key;
  customPromise = (id ? getImage(id) : Promise.resolve(null))
    .then(async (blob) => {
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.src = url;
      await image.decode().catch(() => {});
      return url;
    })
    .catch(() => null);
  return customPromise;
}

export function previewShade(value) {
  root.style.setProperty('--shade', String(value / 100));
}

/** Live preview while the color picker moves; the color is saved when it closes. */
export function previewAccent(color) {
  root.style.setProperty('--accent', color);
}

// At 0 no filter is set at all, so the unblurred wallpaper costs nothing extra.
export function previewBlur(value) {
  root.style.setProperty('--blur', `${value}px`);
  if (value > 0) root.style.setProperty('--wallpaper-filter', `blur(${value}px)`);
  else root.style.removeProperty('--wallpaper-filter');
}

// The custom CSS, unless it would escape its scope (then it is kept in the settings, not applied).
let checkedCSS = null;
let validCSS = true;
function applyCustomCSS({ customCSS }) {
  if (customCSS !== checkedCSS) {
    checkedCSS = customCSS;
    validCSS = !customCSS.trim() || !checkCSS(customCSS).error;
  }
  const text = validCSS ? scopeCSS(customCSS) : '';
  let style = document.getElementById('custom-css');
  if (!style && !text) return;
  if (!style) {
    style = document.createElement('style');
    style.id = 'custom-css';
    document.head.append(style);
  }
  if (style.textContent !== text) style.textContent = text;
}

function apply(state) {
  applyCustomCSS(state);
  root.dataset.layout = state.layout;
  root.dataset.theme = state.theme;
  root.dataset.wallpaper = state.wallpaper;
  for (const section of SECTIONS) root.toggleAttribute(`data-hide-${section}`, !state.show[section]);
  previewShade(state.shade);
  previewBlur(state.blur);
  applyAccent(state);

  if (state.wallpaper !== CUSTOM_WALLPAPER) {
    root.style.setProperty('--wallpaper', `url("${wallpaperSrc(state.wallpaper)}")`);
    return;
  }
  const id = shownImageId(state);
  root.dataset.customImage = id ?? '';
  loadCustomWallpaper(id, state.wallpaperRev).then((url) => {
    const current = getState();
    if (current.wallpaper !== CUSTOM_WALLPAPER || shownImageId(current) !== id) return;
    if (url) {
      root.style.setProperty('--wallpaper', `url("${url}")`);
      root.dataset.wallpaperReady = '';
    } else {
      root.style.removeProperty('--wallpaper');
      delete root.dataset.wallpaperReady;
    }
    if (paintedURL && paintedURL !== url) URL.revokeObjectURL(paintedURL);
    paintedURL = url;
  });
}

// The images stored and the list in the state can drift apart: the single image of earlier
// versions (stored, never listed), a backup restored on another computer, an interrupted save.
async function repairImages() {
  const stored = await storedImageIds().catch(() => null);
  if (!stored) return;
  const { customImages } = getState();
  const kept = customImages.filter((id) => stored.includes(id));
  const found = stored.filter(
    (id) => typeof id === 'string' && /^[\w-]{1,40}$/.test(id) && !kept.includes(id),
  );
  const next = [...kept, ...found].slice(0, LIMITS.wallpapers);
  if (next.join() === customImages.join()) return;
  update((state) => {
    state.customImages = next;
    if (!next.includes(state.customImage)) state.customImage = next[0] ?? '';
    if (state.wallpaper === CUSTOM_WALLPAPER && !next.length) state.wallpaper = 'workstation';
  });
}

export function initAppearance() {
  apply(getState());
  subscribe(apply);
  repairImages();
}
