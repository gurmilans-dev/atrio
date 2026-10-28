// Entry point. No network requests: navigation happens only when the user searches or opens a link.
import { initAppearance } from './appearance.js';
import { initApps } from './apps.js';
import { initClock } from './clock.js';
import { STORAGE_KEY } from './config.js';
import { announce } from './dom.js';
import { initEffects } from './effects.js';
import { initFocus } from './focus.js';
import { needsReload, t, translatePage } from './i18n.js';
import { initLayout } from './layout.js';
import { initLinks } from './links.js';
import { initNotes } from './notes.js';
import { initPrefixes } from './prefixes.js';
import { initSearch } from './search-ui.js';
import { initSettings } from './settings.js';
import { initShortcuts } from './shortcuts.js';
import { flush, getState, initStore, reloadFromStorage, subscribe } from './store.js';
import { initTasks } from './tasks.js';

// The page stays hidden (style.css) until the static texts are in the right language.
try {
  translatePage();
  initStore({
    onSaveError: () => announce(t('toast.saveFailed')),
  });
  initAppearance();
  initClock();
  initSearch();
  initLinks();
  initPrefixes();
  initTasks();
  initNotes();
  initFocus();
  initLayout();
  initApps();
  initSettings();
  initShortcuts();
  initEffects();
} finally {
  document.documentElement.dataset.ready = '';
}

// A new language choice, from the settings, a backup, a reset or another tab, reloads the page.
// Only the choice counts: if the browser's own language changes meanwhile (Edge settles it a moment
// after starting with a new profile), the next new tab follows it, instead of a click reloading this one.
let languageChoice = getState().lang;
subscribe((state) => {
  if (state.lang === languageChoice) return;
  languageChoice = state.lang;
  // Saved first: the reloaded page reads the choice back from storage.
  if (needsReload(state.lang)) flush().then(() => window.location.reload());
});

// Several new tabs are often open at once: when one saves, the others show its state (with their
// own unsaved changes on top, see js/store.js).
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) reloadFromStorage();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) reloadFromStorage();
});
