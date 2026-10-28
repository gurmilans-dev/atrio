// Settings drawer: a native modal <dialog> (focus trap, Esc and inert background for free).
import {
  CUSTOM_PRESET,
  CUSTOM_PRESET_LIMITS,
  CUSTOM_THEME,
  CUSTOM_WALLPAPER,
  IMAGE_TYPES,
  LIMITS,
  PRESETS,
  ROTATION_KEY,
  SECTIONS,
  STORAGE_KEY,
  THEMES,
  WALLPAPERS,
  wallpaperSrc,
} from './config.js';
import { readableAccent } from './color.js';
import { checkCSS } from './custom-css.js';
import { $, $$, announce, button, el } from './dom.js';
import { LANGUAGES, numberFormat, t, themeName, wallpaperName } from './i18n.js';
import { appVersion, hasOrigins, removeOrigins, requestOrigins } from './platform.js';
import { accentKey, previewAccent, previewBlur, previewShade } from './appearance.js';
import { applyPreset, syncAlarm } from './focus.js';
import { createDefaultState, normalizeState } from './state.js';
import { dayKey } from './stats.js';
import { getState, replaceState, subscribe, trackSave, update } from './store.js';
import { SUGGEST_ORIGINS, hasSuggestions } from './suggest.js';
import { presetOf, readyTimer } from './timer.js';
import {
  blobToDataURL,
  clearImages,
  dataURLToBlob,
  deleteImage,
  getImage,
  newImageId,
  prepareWallpaper,
  putImage,
  storedImageIds,
} from './wallpaper.js';

const dialog = () => $('settings');
const formatMB = (bytes) =>
  `${numberFormat({ minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
let builtinPicks = [];
let renderedImages = '';
const thumbs = new Map(); // image id -> object URL, created while the settings are open

// Wallpaper sliders: state key -> live preview and label (#<key>-range, #<key>-number).
const RANGES = {
  shade: { preview: previewShade, format: (value) => `${value}%` },
  blur: { preview: previewBlur, format: (value) => `${value} px` },
};

export const isSettingsOpen = () => dialog().open;

/** @param {{focus?: string, scrollTo?: string}} [options] element ids */
export function openSettings({ focus, scrollTo } = {}) {
  if (!dialog().open) dialog().showModal();
  refreshThumbs();
  if (scrollTo) $(scrollTo)?.scrollIntoView({ block: 'start' });
  if (focus) $(focus)?.focus();
}

function closeSettings() {
  dialog().close();
}

function pickButton(className, dataKey, value) {
  const node = button(className);
  node.dataset[dataKey] = value;
  node.setAttribute('aria-pressed', 'false');
  return node;
}

// The built-in wallpapers, then one tile per image of the user's, then "Add".
function renderWallpaperPicks(state) {
  const key = state.customImages.join();
  if (key === renderedImages && $('wallpaper-picks').childElementCount) return;
  renderedImages = key;
  const own = state.customImages.map((id, index) => {
    const node = pickButton('wallpaper-pick custom-pick', 'image', id);
    const image = el('img');
    image.alt = '';
    image.dataset.thumb = id;
    if (thumbs.has(id)) image.src = thumbs.get(id);
    node.append(image, el('span', 'pick-label', t('wallpaper.customN', { n: index + 1 })));
    return node;
  });
  const add = button('wallpaper-pick add-pick');
  add.dataset.add = '';
  add.append(el('span', 'pick-placeholder', '+'), el('span', 'pick-label', t('wallpaper.add')));
  add.hidden = state.customImages.length >= LIMITS.wallpapers;
  $('wallpaper-picks').replaceChildren(...builtinPicks, ...own, add);
  if (dialog().open) refreshThumbs();
}

// Thumbnails are object URLs of the stored images: made when the settings open, freed when the
// image goes away.
function refreshThumbs() {
  const { customImages } = getState();
  for (const [id, url] of thumbs) {
    if (customImages.includes(id)) continue;
    URL.revokeObjectURL(url);
    thumbs.delete(id);
  }
  for (const id of customImages) {
    if (thumbs.has(id)) continue;
    getImage(id)
      .then((blob) => {
        if (!blob || thumbs.has(id)) return;
        thumbs.set(id, URL.createObjectURL(blob));
        const image = $('wallpaper-picks').querySelector(`[data-thumb="${id}"]`);
        if (image) image.src = thumbs.get(id);
      })
      .catch(() => {});
  }
}

function buildPicks() {
  builtinPicks = WALLPAPERS.map((id) => {
    const node = pickButton('wallpaper-pick', 'wallpaper', id);
    const image = el('img');
    image.src = wallpaperSrc(id);
    image.alt = '';
    image.loading = 'lazy';
    node.append(image, el('span', 'pick-label', wallpaperName(id)));
    return node;
  });

  $('theme-picks').replaceChildren(
    ...Object.entries(THEMES).map(([id, theme]) => {
      const node = pickButton('theme-pick', 'themeChoice', id);
      const swatch = el('span', 'swatch');
      // The automatic and custom themes show their current color (see render).
      if (theme.swatch) swatch.style.setProperty('--sample', theme.swatch);
      else swatch.id = `${id}-swatch`;
      node.append(swatch, themeName(id));
      return node;
    }),
  );

  const customPreset = pickButton('preset-pick', 'preset', CUSTOM_PRESET);
  customPreset.textContent = t('preset.custom');
  $('preset-picks').replaceChildren(
    ...PRESETS.map((preset) => {
      const node = pickButton('preset-pick', 'preset', String(preset.id));
      node.textContent = t('preset.label', { focus: preset.focus, pause: preset.break });
      return node;
    }),
    customPreset,
  );
  for (const key of ['focus', 'break']) {
    const input = $(`custom-${key}`);
    [input.min, input.max] = CUSTOM_PRESET_LIMITS[key].map(String);
  }

  // Settings → Page: one switch per part of the page; the heatmap lives inside the focus panel.
  $('show-toggles').replaceChildren(
    ...SECTIONS.map((section) => {
      const label = el('label', 'toggle');
      const input = el('input');
      input.type = 'checkbox';
      input.dataset.show = section;
      label.append(input, ' ', el('span', '', t(`show.${section}`)));
      if (section === 'heatmap') label.classList.add('nested');
      return label;
    }),
  );

  $('language-select').replaceChildren(
    ...LANGUAGES.map((id) => {
      const option = el('option', '', t(`language.${id}`));
      option.value = id;
      return option;
    }),
  );
}

function render(state) {
  const mark = (selector, key, value) => {
    for (const node of $$(selector)) {
      const active = node.dataset[key] === String(value);
      node.classList.toggle('active', active);
      node.setAttribute('aria-pressed', String(active));
    }
  };
  renderWallpaperPicks(state);
  mark('[data-wallpaper]', 'wallpaper', state.wallpaper);
  mark('[data-image]', 'image', state.wallpaper === CUSTOM_WALLPAPER ? state.customImage : null);
  $('remove-wallpaper').hidden = state.wallpaper !== CUSTOM_WALLPAPER || !state.customImage;
  $('rotation-select').value = state.rotation;
  $('rotation-select').disabled = state.customImages.length < 2;
  mark('[data-theme-choice]', 'themeChoice', state.theme);
  mark('[data-preset]', 'preset', state.preset);
  for (const [key, { format }] of Object.entries(RANGES)) {
    $(`${key}-range`).value = String(state[key]);
    $(`${key}-number`).textContent = format(state[key]);
  }
  $('notify-toggle').checked = state.notify;
  $('mouse-effects-toggle').checked = state.mouseEffects;
  $('apps-toggle').checked = state.apps.visible;
  for (const input of $$('[data-show]')) {
    input.checked = state.show[input.dataset.show];
    if (input.dataset.show === 'heatmap') input.disabled = !state.show.focus;
  }
  renderCSSStatus(state.customCSS);
  if (document.activeElement !== $('css-input')) $('css-input').value = state.customCSS;
  $('custom-preset').hidden = state.preset !== CUSTOM_PRESET;
  for (const key of ['focus', 'break']) {
    if (document.activeElement !== $(`custom-${key}`)) {
      $(`custom-${key}`).value = String(state.customPreset[key]);
    }
  }
  $('clock-format').value = state.clock.hour12 ? '12' : '24';
  $('seconds-toggle').checked = state.clock.seconds;
  $('clock-format').disabled = !state.show.clock;
  $('seconds-toggle').disabled = !state.show.clock;
  $('recent-toggle').checked = state.rememberSearches;
  $('suggest-toggle').checked = state.suggest;
  // Suggestions come from Google or DuckDuckGo: not offered for Chrome's own engine, whose provider
  // Atrio does not know.
  $('suggest-toggle').disabled = !hasSuggestions(state.engine);
  $('clear-recent').hidden = state.recent.length === 0;
  $('language-select').value = state.lang;
  if (document.activeElement !== $('name-input')) $('name-input').value = state.name;
  const swatch = $('auto-swatch');
  const autoKey = accentKey(state);
  if (autoKey && Object.hasOwn(state.autoAccents, autoKey)) {
    swatch.style.setProperty('--sample', state.autoAccents[autoKey]);
  } else swatch.style.removeProperty('--sample');
  $('custom-swatch').style.setProperty('--sample', state.customAccent.color);
  // On the light theme the veil lightens the wallpaper instead of darkening it.
  $('shade-label').textContent = t(state.theme === 'light' ? 'settings.lighten' : 'settings.dim');
  $('accent-row').hidden = state.theme !== CUSTOM_THEME;
  if (document.activeElement !== $('accent-input')) $('accent-input').value = state.customAccent.picked;
}

function renderCSSStatus(css) {
  const result = css.trim() ? checkCSS(css) : null;
  const status = $('css-status');
  status.textContent = !result
    ? t('css.none')
    : result.error
      ? t('css.escape')
      : t('css.active', { n: result.rules });
  status.classList.toggle('error', Boolean(result?.error));
}

// Applied only when it cannot escape its scope; the settings themselves are never affected.
function applyCSS() {
  const css = $('css-input').value.slice(0, LIMITS.css);
  const result = css.trim() ? checkCSS(css) : { rules: 0 };
  if (result.error) {
    renderCSSStatus(css);
    announce(t('css.escape'));
    return;
  }
  update((state) => {
    state.customCSS = css;
  });
  announce(css.trim() ? t('css.applied', { n: result.rules }) : t('css.cleared'));
}

async function uploadWallpaper(file) {
  if (!IMAGE_TYPES.includes(file.type)) {
    announce(t('wallpaper.unsupported'));
    return;
  }
  if (file.size > LIMITS.uploadBytes) {
    announce(t('wallpaper.tooBig', { size: formatMB(LIMITS.uploadBytes) }));
    return;
  }
  if (getState().customImages.length >= LIMITS.wallpapers) {
    announce(t('wallpaper.max', { n: LIMITS.wallpapers }));
    return;
  }
  announce(t('wallpaper.optimizing'));
  try {
    const blob = await prepareWallpaper(file);
    const id = newImageId();
    await putImage(id, blob);
    update((state) => {
      state.customImages = [...state.customImages, id];
      state.customImage = id;
      state.wallpaper = CUSTOM_WALLPAPER;
      state.wallpaperRev = Date.now();
    });
    announce(t('wallpaper.updated', { size: formatMB(blob.size) }));
  } catch {
    announce(t('wallpaper.failed'));
  }
}

// Removes the selected image of the user's; the next one (or a built-in wallpaper) takes its place.
async function removeWallpaper() {
  const id = getState().customImage;
  if (!id) return;
  try {
    await deleteImage(id);
  } catch {
    announce(t('wallpaper.removeFailed'));
    return;
  }
  update((state) => {
    const index = state.customImages.indexOf(id);
    state.customImages = state.customImages.filter((item) => item !== id);
    state.customImage = state.customImages[Math.min(index, state.customImages.length - 1)] ?? '';
    if (!state.customImages.length && state.wallpaper === CUSTOM_WALLPAPER) state.wallpaper = 'workstation';
    state.wallpaperRev = Date.now();
  });
  announce(t('wallpaper.removed'));
}

async function exportData() {
  const state = { ...getState() };
  delete state.timer; // a running session is not worth restoring
  const payload = { app: 'atrio', version: appVersion(), exportedAt: new Date().toISOString(), state };
  const images = [];
  for (const id of state.customImages) {
    const blob = await getImage(id).catch(() => null);
    if (blob) images.push({ id, image: await blobToDataURL(blob) });
  }
  if (images.length) payload.wallpaperImages = images;

  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = el('a');
  link.href = url;
  link.download = `atrio-backup-${dayKey(new Date())}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  announce(t('backup.exported'));
}

export function exportBackup() {
  exportData().catch(() => announce(t('backup.exportFailed')));
}

async function importData(file) {
  if (file.size > LIMITS.importBytes) {
    announce(t('backup.tooBig'));
    return;
  }
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    announce(t('backup.invalidJson'));
    return;
  }
  // Accepts Atrio backups, those made when the project was called Workspace (old files may still
  // be around), and raw state.
  const raw = ['atrio', 'workspace'].includes(payload?.app) ? payload.state : payload;
  if (typeof raw !== 'object' || raw === null || !('links' in raw || 'tasks' in raw)) {
    announce(t('backup.notAtrio'));
    return;
  }
  if (!confirm(t('backup.confirmImport'))) return;

  // Nothing current is touched before the backup is saved: its images are prepared and stored under
  // new ids, the state is replaced all at once, and only then do the previous images go. If anything
  // fails, the new images are removed and everything stays as it was.
  const next = normalizeState(raw);
  next.timer = readyTimer('focus', presetOf(next));
  // wallpaperImages (several) since the rotation, wallpaperImage (one, kept as "selected") before.
  const images = Array.isArray(payload.wallpaperImages)
    ? payload.wallpaperImages
    : typeof payload.wallpaperImage === 'string'
      ? [{ id: 'selected', image: payload.wallpaperImage }]
      : [];
  let imageFailed = false;
  const staged = new Map(); // id in the backup -> new id
  try {
    for (const item of images.slice(0, LIMITS.wallpapers)) {
      let blob;
      try {
        if (typeof item?.image !== 'string' || !item.image.startsWith('data:image/')) {
          throw new Error('not an image');
        }
        blob = await prepareWallpaper(await dataURLToBlob(item.image));
      } catch {
        imageFailed = true; // an unreadable image is left out, the rest of the backup still comes in
        continue;
      }
      const id = newImageId();
      await putImage(id, blob); // storage full or blocked: the whole restore stops
      staged.set(typeof item.id === 'string' && !staged.has(item.id) ? item.id : id, id);
    }
  } catch {
    await discardImages([...staged.values()]);
    announce(t('backup.failed'));
    return;
  }
  // The backup's images under their new ids: its order for those it listed, then any other.
  const listed = next.customImages.filter((id) => staged.has(id));
  next.customImages = [...listed, ...[...staged.keys()].filter((id) => !listed.includes(id))].map((id) =>
    staged.get(id),
  );
  next.customImage = staged.get(next.customImage) ?? next.customImages[0] ?? '';
  next.autoAccents = Object.fromEntries(
    Object.entries(next.autoAccents).map(([key, color]) => {
      const old = key.startsWith('custom:') ? key.slice(7) : null;
      return [staged.has(old) ? `custom:${staged.get(old)}` : key, color];
    }),
  );
  if (next.wallpaper === CUSTOM_WALLPAPER && !next.customImages.length) next.wallpaper = 'workstation';
  next.wallpaperRev = Date.now();
  if (!(await replaceState(next))) {
    await discardImages([...staged.values()]);
    announce(t('backup.failed'));
    return;
  }
  trackSave(keepOnlyImages(next.customImages)); // saved: the previous images can go
  syncAlarm();
  announce(t(imageFailed ? 'backup.importedNoImage' : 'backup.imported'));
}

const discardImages = (ids) => Promise.all(ids.map((id) => deleteImage(id).catch(() => {})));

async function keepOnlyImages(keep) {
  const stored = await storedImageIds().catch(() => []);
  await discardImages(stored.filter((id) => !keep.includes(id)));
}

// Same rule as the restore: the images and leftovers are deleted only once the reset is saved.
async function resetAll() {
  if (!confirm(t('reset.confirm'))) return;
  const next = createDefaultState();
  next.wallpaperRev = Date.now();
  if (!(await replaceState(next))) {
    announce(t('reset.failed'));
    return;
  }
  trackSave(clearImages().catch(() => {}));
  // The copy of an unreadable save and the rotation counter go too.
  for (const key of [`${STORAGE_KEY}.corrupt`, ROTATION_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Best effort: they hold no personal content.
    }
  }
  syncAlarm();
  closeSettings();
  announce(t('reset.done'));
}

function pickFile(inputId, handler) {
  const input = $(inputId);
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) handler(file);
  });
  return () => input.click();
}

export function initSettings() {
  buildPicks();
  const chooseWallpaper = pickFile('wallpaper-upload', uploadWallpaper);
  const chooseBackup = pickFile('import-file', importData);

  // Close on backdrop clicks only: a drag that ends outside the panel must not close it.
  let pressedBackdrop = false;
  dialog().addEventListener('pointerdown', (event) => {
    pressedBackdrop = event.target === dialog();
  });
  dialog().addEventListener('click', (event) => {
    if (pressedBackdrop && event.target === dialog()) closeSettings();
  });

  $('open-settings').addEventListener('click', () => openSettings());
  $('edit-links').addEventListener('click', () =>
    openSettings({ scrollTo: 'links-section', focus: 'link-name' }),
  );
  $('close-settings').addEventListener('click', closeSettings);

  $('wallpaper-picks').addEventListener('click', (event) => {
    const pick = event.target.closest('[data-wallpaper], [data-image], [data-add]');
    if (!pick) return;
    if ('add' in pick.dataset) {
      chooseWallpaper();
      return;
    }
    update((state) => {
      if (pick.dataset.image) {
        state.wallpaper = CUSTOM_WALLPAPER;
        state.customImage = pick.dataset.image;
      } else {
        state.wallpaper = pick.dataset.wallpaper;
      }
    });
  });
  $('rotation-select').addEventListener('change', (event) => {
    update((state) => {
      state.rotation = event.target.value;
    });
  });
  $('theme-picks').addEventListener('click', (event) => {
    const pick = event.target.closest('[data-theme-choice]');
    if (!pick) return;
    update((state) => {
      state.theme = pick.dataset.themeChoice;
    });
  });
  $('preset-picks').addEventListener('click', (event) => {
    const pick = event.target.closest('[data-preset]');
    if (!pick) return;
    const { preset } = pick.dataset;
    applyPreset(preset === CUSTOM_PRESET ? CUSTOM_PRESET : Number(preset));
  });
  // Custom durations are clamped to their limits and applied when a field is left or confirmed.
  for (const key of ['focus', 'break']) {
    $(`custom-${key}`).addEventListener('change', () => {
      const minutes = (name) => {
        const [min, max] = CUSTOM_PRESET_LIMITS[name];
        const value = Math.round(Number($(`custom-${name}`).value));
        return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : getState().customPreset[name];
      };
      const custom = { focus: minutes('focus'), break: minutes('break') };
      $(`custom-${key}`).value = String(custom[key]);
      applyPreset(CUSTOM_PRESET, custom);
    });
  }

  // Live preview while the picker moves, saved when it closes.
  const accentInput = $('accent-input');
  accentInput.addEventListener('input', () => previewAccent(readableAccent(accentInput.value)));
  accentInput.addEventListener('change', () => {
    update((state) => {
      state.customAccent = { picked: accentInput.value, color: readableAccent(accentInput.value) };
    });
  });

  $('upload-wallpaper').addEventListener('click', chooseWallpaper);
  $('remove-wallpaper').addEventListener('click', removeWallpaper);

  for (const [key, { preview, format }] of Object.entries(RANGES)) {
    const input = $(`${key}-range`);
    // Live preview while dragging, a single save when released.
    input.addEventListener('input', () => {
      preview(Number(input.value));
      $(`${key}-number`).textContent = format(input.value);
    });
    input.addEventListener('change', () => {
      update((state) => {
        state[key] = Number(input.value);
      });
    });
  }

  $('notify-toggle').addEventListener('change', (event) => {
    update((state) => {
      state.notify = event.target.checked;
    });
    syncAlarm();
  });
  $('mouse-effects-toggle').addEventListener('change', (event) => {
    update((state) => {
      state.mouseEffects = event.target.checked;
    });
  });
  // The page reloads in the new language (js/main.js), and so do the other open tabs.
  $('language-select').addEventListener('change', (event) => {
    update((state) => {
      state.lang = event.target.value;
    });
  });
  // Host access is asked inside the click (a user gesture); turning the switch off gives it back.
  $('suggest-toggle').addEventListener('change', async (event) => {
    const on = event.target.checked;
    const granted = on ? await requestOrigins(SUGGEST_ORIGINS).catch(() => false) : true;
    if (!granted) {
      event.target.checked = false;
      announce(t('suggest.denied'));
      return;
    }
    if (!on) removeOrigins(SUGGEST_ORIGINS).catch(() => {});
    update((state) => {
      state.suggest = on;
    });
  });
  // Access removed from Chrome's extension settings, or a backup from another computer: switch off.
  if (getState().suggest) {
    hasOrigins(SUGGEST_ORIGINS).then((granted) => {
      if (granted) return;
      update((state) => {
        state.suggest = false;
      });
    });
  }
  $('recent-toggle').addEventListener('change', (event) => {
    update((state) => {
      state.rememberSearches = event.target.checked;
      if (!state.rememberSearches) state.recent = []; // turning it off also forgets what was kept
    });
  });
  $('clear-recent').addEventListener('click', () => {
    update((state) => {
      state.recent = [];
    });
    $('recent-toggle').focus(); // the button hides itself
    announce(t('recent.cleared'));
  });
  $('show-toggles').addEventListener('change', (event) => {
    const { show } = event.target.dataset;
    if (!show) return;
    update((state) => {
      state.show[show] = event.target.checked;
    });
  });
  $('clock-format').addEventListener('change', (event) => {
    update((state) => {
      state.clock.hour12 = event.target.value === '12';
    });
  });
  $('seconds-toggle').addEventListener('change', (event) => {
    update((state) => {
      state.clock.seconds = event.target.checked;
    });
  });
  $('apps-toggle').addEventListener('change', (event) => {
    update((state) => {
      state.apps.visible = event.target.checked;
    });
  });
  $('name-input').maxLength = LIMITS.name;
  $('name-input').addEventListener('input', (event) => {
    update((state) => {
      state.name = event.target.value.trim().slice(0, LIMITS.name);
    });
  });

  $('css-input').maxLength = LIMITS.css;
  $('css-apply').addEventListener('click', applyCSS);
  $('css-input').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    applyCSS();
  });
  $('css-clear').addEventListener('click', () => {
    $('css-input').value = '';
    update((state) => {
      state.customCSS = '';
    });
    announce(t('css.cleared'));
  });

  $('export-data').addEventListener('click', exportBackup);
  $('import-data').addEventListener('click', chooseBackup);
  $('reset-data').addEventListener('click', resetAll);
  $('app-version').textContent = `Atrio ${appVersion()}`;

  render(getState());
  subscribe(render);
}
