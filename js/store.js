// In-memory state shared by all modules. Every change is saved and broadcast;
// other open tabs pick it up through the "storage" event (see main.js).
import { STORAGE_KEY } from './config.js';
import { loadState, serialize } from './state.js';

const listeners = new Set();
let state;
let reportSaveError = () => {};

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    reportSaveError();
  }
}

function emit() {
  for (const listener of listeners) listener(state);
}

export function initStore({ onSaveError }) {
  reportSaveError = onSaveError;
  const loaded = loadState();
  state = loaded.state;
  if (loaded.corrupt) {
    // Keep the unreadable data around instead of silently overwriting it.
    try {
      localStorage.setItem(`${STORAGE_KEY}.corrupt`, loaded.raw);
    } catch {
      // Best effort only.
    }
  }
  // Write back migrated or repaired data once, so every tab sees the same ids.
  if (loaded.raw !== serialize(state)) persist();
  return loaded;
}

export const getState = () => state;

export function update(mutate) {
  mutate(state);
  persist();
  emit();
}

export function replaceState(next) {
  state = next;
  persist();
  emit();
}

export function reloadFromStorage() {
  state = loadState().state;
  emit();
}

export function subscribe(listener) {
  listeners.add(listener);
}
