// Entry point. No network requests: navigation happens only when the user searches or opens a link.
import { initAppearance } from './appearance.js';
import { initApps } from './apps.js';
import { initClock } from './clock.js';
import { STORAGE_KEY } from './config.js';
import { announce } from './dom.js';
import { initEffects } from './effects.js';
import { initFocus } from './focus.js';
import { initLinks } from './links.js';
import { initNotes } from './notes.js';
import { initSearch } from './search-ui.js';
import { initSettings } from './settings.js';
import { initShortcuts } from './shortcuts.js';
import { readLegacyState, removeLegacyState } from './state.js';
import { initStore, reloadFromStorage, update } from './store.js';
import { initTasks } from './tasks.js';
import { dataURLToBlob, getImage, prepareWallpaper, putImage } from './wallpaper.js';

// v1 kept the custom wallpaper as base64 inside localStorage: move it to IndexedDB,
// then delete the old key so it stops eating the ~5 MB localStorage quota.
async function migrateLegacy() {
  const legacy = readLegacyState();
  if (!legacy) return;
  try {
    const image = legacy.uploadedWallpaper;
    if (typeof image === 'string' && image.startsWith('data:image/') && !(await getImage())) {
      await putImage(await prepareWallpaper(await dataURLToBlob(image)));
      update((state) => {
        state.wallpaperRev = Date.now();
      });
    }
    removeLegacyState();
  } catch {
    // Keep the old data: the migration is retried on the next new tab.
  }
}

initStore({
  onSaveError: () => announce('Impossibile salvare: spazio di archiviazione pieno o bloccato.'),
});
initAppearance();
initClock();
initSearch();
initLinks();
initTasks();
initNotes();
initFocus();
initApps();
initSettings();
initShortcuts();
initEffects();

// Several new tabs are often open at once: when one saves, the others reload
// instead of overwriting its changes with their stale copy.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) reloadFromStorage();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) reloadFromStorage();
});

migrateLegacy();
