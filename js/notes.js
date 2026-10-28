// Second tab of the tasks panel: a plain-text scratchpad, saved while you type.
import { LIMITS } from './config.js';
import { $ } from './dom.js';
import { numberFormat, t } from './i18n.js';
import { getState, hasUnsavedChanges, retrySave, subscribe, update } from './store.js';

const TABS = ['tasks', 'notes'];
let saveTimeout;
let lastSave = Promise.resolve(true); // whether the latest text of the notes reached storage
let failed = false;

function setStatus(key) {
  const unsaved = key === 'notes.unsaved';
  const status = $('notes-status');
  status.textContent = t(key);
  status.classList.toggle('failed', unsaved);
  $('notes-size').hidden = unsaved; // room for Retry on the same line
  $('notes-retry').hidden = !unsaved;
}

// "Saved" only once storage holds the text. A failed save keeps the draft, here and in the state, and
// says so until a save goes through: Retry, the next edit, or any other change saved meanwhile.
async function save() {
  clearTimeout(saveTimeout);
  const area = $('notes-input');
  const value = area.value;
  if (value !== getState().notes) {
    lastSave = update((state) => {
      state.notes = value;
    });
  } else if (failed) {
    lastSave = retrySave();
  }
  const saved = await lastSave;
  if (area.value !== value) return; // typed meanwhile: that text has its own save coming
  failed = !saved;
  setStatus(saved ? 'notes.saved' : 'notes.unsaved');
}

export function showPanelTab(tab) {
  if (getState().panelTab === tab) return;
  update((state) => {
    state.panelTab = tab;
  });
}

export function focusNotes() {
  showPanelTab('notes');
  $('notes-input').focus();
}

function render(state) {
  for (const tab of TABS) {
    const active = state.panelTab === tab;
    const button = $(`tab-${tab}`);
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    $(`${tab}-pane`).hidden = !active;
    $(`${tab}-count`).hidden = !active;
  }
  // Never overwrite what is being typed: another tab may have saved meanwhile.
  const area = $('notes-input');
  if (document.activeElement !== area && area.value !== state.notes) area.value = state.notes;
  const count = numberFormat();
  $('notes-length').textContent = `${count.format(state.notes.length)} / ${count.format(LIMITS.notes)}`;
  // Saved along with another change.
  if (failed && !hasUnsavedChanges() && area.value === state.notes) {
    failed = false;
    setStatus('notes.saved');
  }
}

export function initNotes() {
  const area = $('notes-input');
  area.maxLength = LIMITS.notes;
  area.addEventListener('input', () => {
    setStatus('notes.saving');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(save, 400);
  });
  area.addEventListener('blur', save);
  $('notes-retry').addEventListener('click', () => {
    setStatus('notes.saving');
    save();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });

  const tablist = $('panel-tabs');
  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role=tab]');
    if (tab) showPanelTab(tab.dataset.tab);
  });
  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  tablist.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.indexOf(getState().panelTab);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? TABS.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    showPanelTab(TABS[next]);
    $(`tab-${TABS[next]}`).focus();
  });

  render(getState());
  subscribe(render);
}
