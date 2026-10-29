// The public name is Azlune (Atrio until 3.3.0). What a user sees carries it; the identifiers that stored data, open
// tabs and backups rely on keep their former names, so the rename moves nothing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { STORAGE_KEY } from '../js/config.js';
import { STRINGS } from '../js/i18n.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('the manifest, the package and the page carry the name Azlune', () => {
  const manifest = json('manifest.json');
  assert.equal(manifest.name, 'Azlune — Developer New Tab');
  assert.equal(manifest.short_name, 'Azlune');
  assert.ok(manifest.short_name.length <= 12, 'short_name is shown where 12 characters fit');
  assert.equal(json('package.json').name, 'azlune');
  assert.match(read('index.html'), /<title>Azlune<\/title>/);
});

test('no interface text or Store summary names the former name', () => {
  for (const language of ['en', 'it']) {
    for (const [key, value] of Object.entries(STRINGS[language])) {
      for (const text of typeof value === 'string' ? [value] : Object.values(value)) {
        assert.doesNotMatch(text, /atrio/i, `${language}: ${key}`);
      }
    }
    assert.doesNotMatch(
      json(`_locales/${language}/messages.json`).appDescription.message,
      /atrio/i,
      language,
    );
  }
});

test('the identifiers stored data and backups rely on keep their names', () => {
  assert.equal(STORAGE_KEY, 'workspace.newtab.v2');
  assert.match(read('js/wallpaper.js'), /const DB_NAME = 'workspace-wallpaper';/);
  assert.match(read('js/store.js'), /const LOCK = 'atrio-state';/);
  // New backups keep the format id that every version, Atrio's included, reads.
  assert.match(read('js/settings.js'), /app: 'atrio'/);
  assert.match(read('js/settings.js'), /\['atrio', 'workspace'\]\.includes\(payload\?\.app\)/);
});
