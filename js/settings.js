// Settings drawer: a native modal <dialog> (focus trap, Esc and inert background for free).
import {
  CUSTOM_THEME,
  CUSTOM_WALLPAPER,
  IMAGE_TYPES,
  LIMITS,
  PRESETS,
  SECTIONS,
  THEMES,
  WALLPAPERS,
  wallpaperSrc,
} from './config.js';
import { readableAccent } from './color.js';
import { $, $$, announce, button, el } from './dom.js';
import { LANGUAGES, numberFormat, t, themeName, wallpaperName } from './i18n.js';
import { appVersion, hasOrigins, removeOrigins, requestOrigins } from './platform.js';
import { loadCustomWallpaper, previewAccent, previewBlur, previewShade } from './appearance.js';
import { applyPreset, syncAlarm } from './focus.js';
import { createDefaultState, normalizeState } from './state.js';
import { dayKey } from './stats.js';
import { getState, replaceState, subscribe, update } from './store.js';
import { SUGGEST_ORIGINS } from './suggest.js';
import { readyTimer } from './timer.js';
import {
  blobToDataURL,
  dataURLToBlob,
  deleteImage,
  getImage,
  prepareWallpaper,
  putImage,
} from './wallpaper.js';

const dialog = () => $('settings');
const formatMB = (bytes) =>
  `${numberFormat({ minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
let hasCustomImage = false;

// Wallpaper sliders: state key -> live preview and label (#<key>-range, #<key>-number).
const RANGES = {
  shade: { preview: previewShade, format: (value) => `${value}%` },
  blur: { preview: previewBlur, format: (value) => `${value} px` },
};

export const isSettingsOpen = () => dialog().open;

/** @param {{focus?: string, scrollTo?: string}} [options] element ids */
export function openSettings({ focus, scrollTo } = {}) {
  if (!dialog().open) dialog().showModal();
  refreshCustomPick();
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

function buildPicks() {
  const wallpapers = WALLPAPERS.map((id) => {
    const node = pickButton('wallpaper-pick', 'wallpaper', id);
    const image = el('img');
    image.src = wallpaperSrc(id);
    image.alt = '';
    image.loading = 'lazy';
    node.append(image, el('span', 'pick-label', wallpaperName(id)));
    return node;
  });
  const custom = pickButton('wallpaper-pick custom-pick', 'wallpaper', CUSTOM_WALLPAPER);
  const thumb = el('img');
  thumb.id = 'custom-thumb';
  thumb.alt = '';
  thumb.hidden = true;
  const placeholder = el('span', 'pick-placeholder', '+');
  placeholder.id = 'custom-placeholder';
  custom.append(thumb, placeholder, el('span', 'pick-label', wallpaperName(CUSTOM_WALLPAPER)));
  $('wallpaper-picks').replaceChildren(...wallpapers, custom);

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

  $('preset-picks').replaceChildren(
    ...PRESETS.map((preset) => {
      const node = pickButton('preset-pick', 'preset', String(preset.id));
      node.textContent = t('preset.label', { focus: preset.focus, pause: preset.break });
      return node;
    }),
  );

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
  mark('[data-wallpaper]', 'wallpaper', state.wallpaper);
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
  $('recent-toggle').checked = state.rememberSearches;
  $('suggest-toggle').checked = state.suggest;
  $('clear-recent').hidden = state.recent.length === 0;
  $('language-select').value = state.lang;
  if (document.activeElement !== $('name-input')) $('name-input').value = state.name;
  const swatch = $('auto-swatch');
  if (state.autoAccent) swatch.style.setProperty('--sample', state.autoAccent.color);
  else swatch.style.removeProperty('--sample');
  $('custom-swatch').style.setProperty('--sample', state.customAccent.color);
  $('accent-row').hidden = state.theme !== CUSTOM_THEME;
  if (document.activeElement !== $('accent-input')) $('accent-input').value = state.customAccent.picked;
  if (dialog().open) refreshCustomPick();
}

function refreshCustomPick() {
  loadCustomWallpaper().then((url) => {
    hasCustomImage = Boolean(url);
    const thumb = $('custom-thumb');
    if (url && thumb.src !== url) thumb.src = url;
    thumb.hidden = !url;
    $('custom-placeholder').hidden = Boolean(url);
    $('remove-wallpaper').hidden = !url;
  });
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
  announce(t('wallpaper.optimizing'));
  try {
    const blob = await prepareWallpaper(file);
    await putImage(blob);
    update((state) => {
      state.wallpaper = CUSTOM_WALLPAPER;
      state.wallpaperRev = Date.now();
    });
    refreshCustomPick();
    announce(t('wallpaper.updated', { size: formatMB(blob.size) }));
  } catch {
    announce(t('wallpaper.failed'));
  }
}

async function removeWallpaper() {
  try {
    await deleteImage();
  } catch {
    announce(t('wallpaper.removeFailed'));
    return;
  }
  update((state) => {
    state.wallpaperRev = Date.now();
    if (state.wallpaper === CUSTOM_WALLPAPER) state.wallpaper = 'workstation';
  });
  refreshCustomPick();
  announce(t('wallpaper.removed'));
}

async function exportData() {
  const state = { ...getState() };
  delete state.timer; // a running session is not worth restoring
  const payload = { app: 'atrio', version: appVersion(), exportedAt: new Date().toISOString(), state };
  const image = await getImage().catch(() => null);
  if (image) payload.wallpaperImage = await blobToDataURL(image);

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

  const next = normalizeState(raw);
  next.timer = readyTimer('focus', next.preset);
  let imageFailed = false;
  if (typeof payload.wallpaperImage === 'string' && payload.wallpaperImage.startsWith('data:image/')) {
    try {
      await putImage(await prepareWallpaper(await dataURLToBlob(payload.wallpaperImage)));
      next.wallpaperRev = Date.now();
    } catch {
      imageFailed = true;
    }
  }
  if (next.wallpaper === CUSTOM_WALLPAPER && (imageFailed || !(await getImage().catch(() => null)))) {
    next.wallpaper = 'workstation';
  }
  replaceState(next);
  syncAlarm();
  refreshCustomPick();
  announce(t(imageFailed ? 'backup.importedNoImage' : 'backup.imported'));
}

async function resetAll() {
  if (!confirm(t('reset.confirm'))) return;
  await deleteImage().catch(() => {});
  const next = createDefaultState();
  next.wallpaperRev = Date.now();
  replaceState(next);
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
    const pick = event.target.closest('[data-wallpaper]');
    if (!pick) return;
    if (pick.dataset.wallpaper === CUSTOM_WALLPAPER && !hasCustomImage) {
      chooseWallpaper();
      return;
    }
    update((state) => {
      state.wallpaper = pick.dataset.wallpaper;
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
    if (pick) applyPreset(Number(pick.dataset.preset));
  });

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

  $('export-data').addEventListener('click', exportBackup);
  $('import-data').addEventListener('click', chooseBackup);
  $('reset-data').addEventListener('click', resetAll);
  $('app-version').textContent = `Atrio ${appVersion()}`;

  render(getState());
  subscribe(render);
}
