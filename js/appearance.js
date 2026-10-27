// Theme, wallpaper, shade and blur. boot.js already applied the saved values before the
// first paint; this module keeps them in sync, loads the custom image and sets the accent of the
// automatic theme (extracted from the wallpaper) and of the custom one (picked by the user).
import { FALLBACK_ACCENT, pickAccent } from './color.js';
import { AUTO_THEME, CUSTOM_THEME, CUSTOM_WALLPAPER, SECTIONS, wallpaperSrc } from './config.js';
import { getState, subscribe, update } from './store.js';
import { getImage } from './wallpaper.js';

const root = document.documentElement;
let customRev = null;
let customURL = null;
let customPromise = null;
let samplingKey = null;

// Identifies the image the accent was computed from.
const accentKey = (state) =>
  state.wallpaper === CUSTOM_WALLPAPER ? `custom:${state.wallpaperRev}` : state.wallpaper;

// Reads a 64×36 thumbnail of the wallpaper: a few thousand pixels are plenty for a hue.
async function sampleWallpaper(state) {
  const blob =
    state.wallpaper === CUSTOM_WALLPAPER
      ? await getImage()
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
  if (state.autoAccent?.key === key) {
    root.style.setProperty('--accent', state.autoAccent.color);
    return;
  }
  // Computed once per wallpaper, then saved: boot.js applies it before the first paint.
  if (samplingKey === key) return;
  samplingKey = key;
  sampleWallpaper(state)
    .catch(() => FALLBACK_ACCENT)
    .then((color) => {
      samplingKey = null;
      if (accentKey(getState()) !== key) return;
      update((current) => {
        current.autoAccent = { key, color };
      });
    });
}

/** Object URL of the uploaded image (decoded and ready to paint), or null. Cached per revision. */
export function loadCustomWallpaper() {
  const rev = getState().wallpaperRev;
  if (customPromise && rev === customRev) return customPromise;
  customRev = rev;
  customPromise = getImage()
    .then(async (blob) => {
      if (customURL) URL.revokeObjectURL(customURL);
      customURL = blob ? URL.createObjectURL(blob) : null;
      if (customURL) {
        const image = new Image();
        image.src = customURL;
        await image.decode().catch(() => {});
      }
      return customURL;
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

function apply(state) {
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
  const rev = state.wallpaperRev;
  loadCustomWallpaper().then((url) => {
    const current = getState();
    if (current.wallpaper !== CUSTOM_WALLPAPER || current.wallpaperRev !== rev) return;
    if (url) {
      root.style.setProperty('--wallpaper', `url("${url}")`);
      root.dataset.wallpaperReady = '';
    } else {
      root.style.removeProperty('--wallpaper');
      delete root.dataset.wallpaperReady;
    }
  });
}

export function initAppearance() {
  apply(getState());
  subscribe(apply);
}
