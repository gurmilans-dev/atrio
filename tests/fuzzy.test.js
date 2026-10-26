import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fuzzyScore } from '../js/fuzzy.js';

describe('fuzzyScore', () => {
  test('prefix beats word start beats substring beats letters in order', () => {
    const prefix = fuzzyScore('git', 'GitHub github.com');
    const wordStart = fuzzyScore('docs', 'MDN Docs');
    const substring = fuzzyScore('hub', 'GitHub');
    const letters = fuzzyScore('gh', 'GitHub');
    assert.ok(prefix > wordStart && wordStart > substring && substring > letters && letters > 0);
  });

  test('no match is -1, empty query matches everything', () => {
    assert.equal(fuzzyScore('xyz', 'GitHub'), -1);
    assert.equal(fuzzyScore('', 'GitHub'), 0);
  });

  test('accents and case are ignored', () => {
    assert.ok(fuzzyScore('citta', 'Sfondo: Città') > 0);
    assert.ok(fuzzyScore('MOCHA', 'Tema: Mocha') > 0);
  });

  test('subsequence matching can be turned off', () => {
    assert.equal(fuzzyScore('tmr', 'Avvia il timer', { subsequence: false }), -1);
    assert.ok(fuzzyScore('tmr', 'Avvia il timer') > 0);
  });
});
