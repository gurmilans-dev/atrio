import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LIMITS } from '../js/config.js';
import { addRecent, matchRecent, normalizeRecent } from '../js/recent.js';
import { normalizeState, serialize } from '../js/state.js';

describe('addRecent', () => {
  test('newest first, an older copy moves up instead of repeating', () => {
    let list = addRecent([], 'react hooks');
    list = addRecent(list, 'rust traits');
    list = addRecent(list, '  React Hooks ');
    assert.deepEqual(list, ['React Hooks', 'rust traits']);
  });

  test('empty text is ignored, long text and long lists are capped', () => {
    assert.deepEqual(addRecent(['a'], '   '), ['a']);
    assert.equal(addRecent([], 'x'.repeat(500))[0].length, LIMITS.recentText);
    let list = [];
    for (let i = 0; i < 50; i++) list = addRecent(list, `query ${i}`);
    assert.equal(list.length, LIMITS.recent);
    assert.equal(list[0], 'query 49');
  });
});

describe('matchRecent', () => {
  const list = ['rust traits', 'react hooks', 'loc hello', 'Città metropolitana'];

  test('nothing typed: the latest ones', () => {
    assert.deepEqual(matchRecent(list, '  ', 2), ['rust traits', 'react hooks']);
  });

  test('typed text: those containing it, newest first, never the same text', () => {
    assert.deepEqual(matchRecent(list, 'r', 5), ['rust traits', 'react hooks', 'Città metropolitana']);
    assert.deepEqual(matchRecent(list, 'hel', 5), ['loc hello']);
    assert.deepEqual(matchRecent(list, 'citta', 5), ['Città metropolitana']);
    assert.deepEqual(matchRecent(list, 'RUST TRAITS', 5), []);
    assert.deepEqual(matchRecent(list, 'rsts', 5), []); // no scattered-letter matches
  });
});

describe('saved recent searches', () => {
  test('strings only, duplicates collapsed keeping the newest, idempotent', () => {
    const recent = normalizeRecent(['b', 1, null, 'A', 'a', '', 'c']);
    assert.deepEqual(recent, ['b', 'A', 'c']);
    assert.deepEqual(normalizeRecent(recent), recent);
    assert.deepEqual(normalizeRecent('nope'), []);
  });

  test('on by default; turned off, nothing is kept', () => {
    assert.equal(normalizeState({}).rememberSearches, true);
    assert.deepEqual(normalizeState({ recent: ['x'] }).recent, ['x']);
    assert.deepEqual(normalizeState({ rememberSearches: false, recent: ['x'] }).recent, []);
    const once = normalizeState({ recent: ['a', 'b'] });
    assert.equal(serialize(normalizeState(JSON.parse(serialize(once)))), serialize(once));
  });
});
