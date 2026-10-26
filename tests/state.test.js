import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LEGACY_STORAGE_KEY, LIMITS, STORAGE_KEY } from '../js/config.js';
import { createDefaultState, loadState, normalizeState, serialize } from '../js/state.js';

function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

describe('normalizeState', () => {
  test('empty input gives the defaults', () => {
    const state = normalizeState(null);
    assert.equal(state.theme, 'tokyo');
    assert.equal(state.links.length, 6);
    assert.ok(state.links.every((link) => typeof link.id === 'string'));
    assert.deepEqual(state.timer, {
      mode: 'focus',
      running: false,
      remaining: 1500,
      total: 1500,
      endAt: null,
    });
  });

  test('one bad link or task does not reset everything', () => {
    const state = normalizeState({
      theme: 'mocha',
      links: [null, { name: 'Ok', url: 'https://ok.dev' }, { name: 'Bad', url: 'javascript:alert(1)' }, 7],
      tasks: [null, { text: 'Scrivere test' }, { text: '   ' }, 'string'],
    });
    assert.equal(state.theme, 'mocha');
    assert.deepEqual(
      state.links.map((link) => link.name),
      ['Ok'],
    );
    assert.deepEqual(
      state.tasks.map((task) => task.text),
      ['Scrivere test'],
    );
  });

  test('missing or duplicated ids get fresh unique ids', () => {
    const state = normalizeState({
      tasks: [{ text: 'a' }, { text: 'b' }, { id: 1, text: 'c' }, { id: 1, text: 'd' }],
    });
    const ids = state.tasks.map((task) => task.id);
    assert.equal(new Set(ids).size, 4);
    assert.equal(ids[2], '1');
  });

  test('values are clamped and unknown keys are dropped', () => {
    const state = normalizeState({ shade: 400, preset: '50', engine: 'bing', junk: true, theme: 'x' });
    assert.equal(state.shade, 75);
    assert.equal(state.preset, 50);
    assert.equal(state.engine, 'google');
    assert.equal(state.theme, 'tokyo');
    assert.equal('junk' in state, false);
  });

  test('shade 0 is kept', () => {
    assert.equal(normalizeState({ shade: 0 }).shade, 0);
  });

  test('blur defaults to 0 and is clamped', () => {
    assert.equal(normalizeState({}).blur, 0);
    assert.equal(normalizeState({ blur: 12.4 }).blur, 12);
    assert.equal(normalizeState({ blur: 999 }).blur, 24);
    assert.equal(normalizeState({ blur: -3 }).blur, 0);
    assert.equal(normalizeState({ blur: 'x' }).blur, 0);
  });

  test('name, notes and panel tab are validated', () => {
    const state = normalizeState({
      name: `  ${'x'.repeat(40)}  `,
      notes: 'n'.repeat(20000),
      panelTab: 'evil',
    });
    assert.equal(state.name.length, 24);
    assert.equal(state.notes.length, 10000);
    assert.equal(state.panelTab, 'tasks');
    assert.equal(normalizeState({ panelTab: 'notes' }).panelTab, 'notes');
    assert.equal(normalizeState({}).mouseEffects, false);
    assert.equal(normalizeState({ schema: 4, parallax: true }).mouseEffects, false);
    assert.equal(normalizeState({ schema: 5, mouseEffects: true }).mouseEffects, true);
    assert.equal('parallax' in normalizeState({ parallax: true }), false);
  });

  test('auto accent must be a hex color with a key', () => {
    assert.deepEqual(normalizeState({ autoAccent: { key: 'city', color: '#AABBCC' } }).autoAccent, {
      key: 'city',
      color: '#aabbcc',
    });
    assert.equal(normalizeState({ autoAccent: { key: 'city', color: 'red; x' } }).autoAccent, null);
    assert.equal(normalizeState({ autoAccent: 'nope' }).autoAccent, null);
    assert.equal(normalizeState({ theme: 'auto' }).theme, 'auto');
  });

  test('focus history is validated and seeded from older data', () => {
    const stats = normalizeState({
      stats: {
        total: 5,
        today: 2,
        day: '2026-10-25',
        history: { '2026-10-20': 3, nope: 4, '2026-10-21': -1 },
      },
    }).stats;
    assert.deepEqual(stats.history, { '2026-10-20': 3, '2026-10-25': 2 });
    const legacy = normalizeState({ completedSessions: 3 }).stats;
    assert.deepEqual(legacy.history, {});
  });

  test('lists are capped', () => {
    const links = Array.from({ length: 50 }, (_, i) => ({ name: `L${i}`, url: `https://l${i}.dev` }));
    const tasks = Array.from({ length: 300 }, (_, i) => ({ text: `T${i}` }));
    const state = normalizeState({ links, tasks });
    assert.equal(state.links.length, LIMITS.links);
    assert.equal(state.tasks.length, LIMITS.tasks);
  });

  test('v2 completedSessions becomes stats.total', () => {
    assert.equal(normalizeState({ completedSessions: 12 }).stats.total, 12);
  });

  test('a running timer needs a valid endAt', () => {
    assert.equal(normalizeState({ timer: { running: true } }).timer.running, false);
    const timer = normalizeState({ timer: { mode: 'break', running: true, endAt: 123 } }).timer;
    assert.equal(timer.running, true);
    assert.equal(timer.total, 300);
  });

  test('normalization is idempotent, so a saved state is not rewritten on every load', () => {
    const once = normalizeState({ tasks: [{ text: 'x' }], links: [{ name: 'A', url: 'https://a.dev' }] });
    assert.equal(serialize(normalizeState(JSON.parse(serialize(once)))), serialize(once));
  });
});

describe('loadState', () => {
  test('falls back to the v1 key', () => {
    const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify({ theme: 'matrix' }) });
    const loaded = loadState(storage);
    assert.equal(loaded.legacy, true);
    assert.equal(loaded.state.theme, 'matrix');
  });

  test('prefers the current key', () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({ theme: 'mocha' }),
      [LEGACY_STORAGE_KEY]: JSON.stringify({ theme: 'matrix' }),
    });
    assert.equal(loadState(storage).state.theme, 'mocha');
  });

  test('corrupted JSON is reported instead of thrown', () => {
    const loaded = loadState(memoryStorage({ [STORAGE_KEY]: '{oops' }));
    assert.equal(loaded.corrupt, true);
    assert.deepEqual(loaded.state.tasks, createDefaultState().tasks);
  });

  test('blocked storage still returns defaults', () => {
    const storage = {
      getItem() {
        throw new Error('blocked');
      },
    };
    assert.equal(loadState(storage).state.theme, 'tokyo');
  });
});
