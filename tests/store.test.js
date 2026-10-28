// Two tabs, two copies of the store module, one storage and one lock manager: changes made at the
// same moment in both must all be saved (js/store.js), and failed saves must be reported, kept and
// retried, or rolled back when asked.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const KEY = 'workspace.newtab.v2';
const saved = new Map();
let full = false; // simulates a full or blocked storage
const define = (name, value) =>
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
define('localStorage', {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => {
    if (full) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    saved.set(key, String(value));
  },
  removeItem: (key) => saved.delete(key),
});
// Web Locks: one holder at a time, in request order, callbacks always asynchronous.
let held = Promise.resolve();
define('navigator', { locks: { request: (name, task) => (held = held.then(() => task())) } });
define('window', { addEventListener() {} });

const tab = async (name) => {
  const store = await import(`../js/store.js?tab=${name}`);
  store.initStore({ onSaveError() {} });
  await store.flush();
  return store;
};
const storedTasks = () => JSON.parse(saved.get(KEY)).tasks.map((task) => task.text);
const addTask = (store, text) => {
  const task = { id: `id-${text}`, text, done: false };
  return store.update((state) => {
    state.tasks.unshift(task);
  });
};

let a;
let b;
beforeEach(async () => {
  saved.clear();
  full = false;
  a = await tab(`a${Math.random()}`);
  b = await tab(`b${Math.random()}`);
});

test('two tabs changing at the same moment both keep their change', async () => {
  // Same tick: each tab changes its own copy, neither has seen the other's change.
  const results = await Promise.all([addTask(a, 'task A'), addTask(b, 'task B')]);
  assert.deepEqual(results, [true, true]);
  assert.deepEqual(storedTasks().sort(), ['task A', 'task B']);
  // The storage event then shows the other tab's change; its own stays.
  a.reloadFromStorage();
  assert.deepEqual(
    a
      .getState()
      .tasks.map((task) => task.text)
      .sort(),
    ['task A', 'task B'],
  );
});

test('unrelated fields changed at the same moment are all kept', async () => {
  await Promise.all([
    a.update((state) => {
      state.notes = 'from A';
    }),
    b.update((state) => {
      state.theme = 'mocha';
    }),
    addTask(b, 'task B'),
  ]);
  const state = JSON.parse(saved.get(KEY));
  assert.deepEqual([state.notes, state.theme, state.tasks.length], ['from A', 'mocha', 1]);
});

test('a failed save is reported, kept in the tab and saved by the next attempt', async () => {
  full = true;
  assert.equal(await addTask(a, 'draft'), false);
  assert.equal(a.hasUnsavedChanges(), true);
  assert.deepEqual(
    a.getState().tasks.map((task) => task.text),
    ['draft'],
  ); // not lost from memory
  assert.equal(saved.get(KEY).includes('draft'), false);
  full = false;
  assert.equal(await a.retrySave(), true);
  assert.equal(a.hasUnsavedChanges(), false);
  assert.deepEqual(storedTasks(), ['draft']);
});

test('a failed replacement with rollback leaves the previous state, in memory and saved', async () => {
  await addTask(a, 'keep me');
  const before = saved.get(KEY);
  full = true;
  const next = { ...a.getState(), tasks: [], notes: 'restored' };
  assert.equal(await a.replaceState(next), false);
  assert.equal(saved.get(KEY), before);
  assert.deepEqual(
    a.getState().tasks.map((task) => task.text),
    ['keep me'],
  );
  assert.equal(a.hasUnsavedChanges(), false); // nothing left queued
});

test('a successful replacement wins over the saved state', async () => {
  await addTask(b, 'old');
  const next = { ...a.getState(), tasks: [], notes: 'restored' };
  assert.equal(await a.replaceState(next), true);
  const state = JSON.parse(saved.get(KEY));
  assert.deepEqual([state.tasks, state.notes], [[], 'restored']);
});
