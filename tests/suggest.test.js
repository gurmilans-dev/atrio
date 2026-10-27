import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { ENGINES } from '../js/config.js';
import { SUGGEST_ORIGINS, SUGGEST_SOURCES, hasSuggestions, parseSuggestions } from '../js/suggest.js';

describe('parseSuggestions', () => {
  test('Google and DuckDuckGo answers', () => {
    const google = ['come centrare', ['come centrare un div', 'come centrare su word'], [''], [], { x: 1 }];
    assert.deepEqual(parseSuggestions(google, 'come centrare'), [
      'come centrare un div',
      'come centrare su word',
    ]);
    const ddg = ['città', ['città vicino a me', 'città del capo']];
    assert.deepEqual(parseSuggestions(ddg, 'città'), ['città vicino a me', 'città del capo']);
  });

  test('drops the typed text, duplicates, non-strings; caps the count', () => {
    const data = [
      'rea',
      ['Rea', 'react', 'React', 42, null, '  ', 'readme', 'reason', 'redux', 'remix', 'regex'],
    ];
    assert.deepEqual(parseSuggestions(data, ' rea '), ['react', 'readme', 'reason', 'redux', 'remix']);
    assert.deepEqual(parseSuggestions(data, 'rea', 2), ['react', 'readme']);
  });

  test('anything else gives nothing', () => {
    for (const junk of [null, 'x', {}, [], ['q'], ['q', 'not a list']]) {
      assert.deepEqual(parseSuggestions(junk, 'q'), []);
    }
  });
});

describe('sources', () => {
  test('the query is encoded, Google answers in UTF-8 and the interface language', () => {
    assert.equal(
      SUGGEST_SOURCES.google.url('a&b è', 'it'),
      'https://suggestqueries.google.com/complete/search?client=chrome&ie=utf-8&oe=utf-8&hl=it&q=a%26b%20%C3%A8',
    );
    assert.equal(SUGGEST_SOURCES.ddg.url('a&b'), 'https://duckduckgo.com/ac/?type=list&q=a%26b');
  });

  test('every source belongs to an engine and is an optional permission of the manifest', () => {
    const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    assert.deepEqual([...manifest.optional_host_permissions].sort(), [...SUGGEST_ORIGINS].sort());
    assert.equal(manifest.host_permissions, undefined);
    for (const engine of Object.keys(SUGGEST_SOURCES)) assert.ok(engine in ENGINES, engine);
    for (const [engine, source] of Object.entries(SUGGEST_SOURCES)) {
      assert.equal(new URL(source.url('x', 'en')).origin, source.origin.replace('/*', ''), engine);
    }
  });

  test('GitHub has no suggestions, own keys only', () => {
    assert.equal(hasSuggestions('google'), true);
    assert.equal(hasSuggestions('github'), false);
    assert.equal(hasSuggestions('constructor'), false);
  });
});
