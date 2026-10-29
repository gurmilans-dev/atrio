// In-memory state shared by all modules, saved in localStorage (key STORAGE_KEY).
//
// Several new tabs are often open at once, each with its own copy. A change is applied to this
// copy at once, so the page stays responsive, and queued. The queue is then committed under a Web
// Lock shared by every tab: the saved state is read again, the queued changes are replayed on it
// and the result is saved. Two tabs changing different things at the same moment both keep their
// change, instead of the last write erasing the other. A change is therefore a function of the
// state that may run more than once: it must not make up ids or read values that differ between
// runs; those are computed before calling update().
//
// update() resolves to true once the change is saved, false if saving failed (storage full or
// blocked). A failed change stays queued and visible in this tab, and is saved with the next
// commit (or retrySave()); with { rollback: true } it is dropped instead (restore, reset).
import { STORAGE_KEY } from './config.js';
import { loadState, serialize } from './state.js';

const LOCK = 'atrio-state'; // from the former name: every open tab, of any version, must ask for the same lock
const listeners = new Set();
let committed; // the state as last read from, or written to, storage
let state; // committed plus the queued changes: what this tab shows
let queue = []; // { mutate, rollback, resolve }
let committing = null;
let unsaved = false; // the last commit failed: queued changes are not saved yet
let reportSaveError = () => {};

const clone = (value) => JSON.parse(JSON.stringify(value)); // states are plain JSON
// A change edits the state in place, or returns a whole new state (restore, reset).
const apply = (base, mutate) => mutate(base) ?? base;
const withLock = (task) => (globalThis.navigator?.locks ? navigator.locks.request(LOCK, task) : task());

function emit() {
  for (const listener of listeners) listener(state);
}

// What this tab shows: the saved state with its own queued changes on top.
function rebuild() {
  let next = clone(committed);
  for (const { mutate } of queue) next = apply(next, mutate);
  state = next;
}

function commitBatch() {
  const batch = queue.slice();
  for (const item of batch) item.attempted = true;
  return withLock(() => {
    let next = loadState().state; // the latest saved state, other tabs' changes included
    const base = clone(next);
    for (const { mutate } of batch) next = apply(next, mutate);
    try {
      localStorage.setItem(STORAGE_KEY, serialize(next));
      committed = next;
      return true;
    } catch {
      committed = base;
      return false;
    }
  })
    .catch(() => false)
    .then((saved) => {
      // Done before anyone hears the result: a change or a retry from now on starts a new commit.
      committing = null;
      unsaved = !saved;
      queue = queue.filter((item) => !batch.includes(item) || (!saved && !item.rollback));
      rebuild();
      emit();
      if (!saved) reportSaveError();
      for (const item of batch) item.resolve(saved);
      if (queue.some((item) => !item.attempted)) commit();
      return saved;
    });
}

// One commit at a time in this tab; changes queued meanwhile go with the next one. A failed change
// is not retried in a loop: it goes with the next commit, or retrySave().
function commit() {
  committing ??= Promise.resolve().then(commitBatch);
  return committing;
}

/** Applies `mutate` now and saves it; resolves to whether it was saved. */
export function update(mutate, { rollback = false } = {}) {
  state = apply(state, mutate);
  emit();
  return new Promise((resolve) => {
    queue.push({ mutate, rollback, resolve });
    commit();
  });
}

/** Replaces the whole state (restore, reset): all or nothing, false if it could not be saved. */
export function replaceState(next) {
  const snapshot = clone(next);
  return update(() => clone(snapshot), { rollback: true });
}

/** True while changes shown in this tab are not saved (the last attempt failed). */
export const hasUnsavedChanges = () => unsaved && queue.length > 0;

/** Tries again to save the queued changes. */
export const retrySave = () => (queue.length ? commit() : Promise.resolve(true));

// Follow-up work of a save that must end before the page goes (old images being removed).
const work = new Set();
export function trackSave(task) {
  const tracked = Promise.resolve(task)
    .catch(() => {})
    .finally(() => work.delete(tracked));
  work.add(tracked);
}

/** Resolves once every change made so far has been through a commit, follow-up work included. */
export async function flush() {
  while (committing || work.size) await Promise.all([committing, ...work]);
}

// Leaving the page (tab closed, navigation) cannot wait for the lock: queued changes are written
// at once, on top of the latest saved state.
function saveNow() {
  if (!queue.length) return;
  try {
    let next = loadState().state;
    for (const { mutate } of queue) next = apply(next, mutate);
    localStorage.setItem(STORAGE_KEY, serialize(next));
  } catch {
    // Nothing more can be done while the page goes away.
  }
}

export function initStore({ onSaveError }) {
  reportSaveError = onSaveError;
  const loaded = loadState();
  committed = loaded.state;
  state = clone(committed);
  if (loaded.corrupt) {
    // Keep the unreadable data around instead of silently overwriting it.
    try {
      localStorage.setItem(`${STORAGE_KEY}.corrupt`, loaded.raw);
    } catch {
      // Best effort only.
    }
  }
  // Write back migrated or repaired data once, so every tab sees the same ids.
  if (loaded.raw !== serialize(committed)) update(() => {});
  window.addEventListener('pagehide', saveNow);
  return loaded;
}

export const getState = () => state;

/** Another tab saved: show its state, with this tab's queued changes still on top. */
export function reloadFromStorage() {
  committed = loadState().state;
  rebuild();
  emit();
}

export function subscribe(listener) {
  listeners.add(listener);
}
