import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEFAULT_APP_FAVORITES, GOOGLE_APPS, appURL } from '../js/google-apps.js';
import { normalizeState, serialize } from '../js/state.js';

const byId = (id) => GOOGLE_APPS.find((app) => app.id === id);

describe('google apps catalog', () => {
  test('ids are unique, urls are https, every app has an icon', () => {
    assert.equal(new Set(GOOGLE_APPS.map((app) => app.id)).size, GOOGLE_APPS.length);
    for (const app of GOOGLE_APPS) {
      assert.equal(new URL(app.url).protocol, 'https:', app.id);
      assert.ok(Array.isArray(app.icon) && app.icon.length > 0, app.id);
      assert.ok(app.name && app.keywords, app.id);
    }
  });

  test("icons are generic symbols in the theme's color: a tile and a glyph, no colors of their own", () => {
    for (const app of GOOGLE_APPS) {
      assert.deepEqual([app.icon[0][1].class, app.icon[1][1].class], ['app-tile', 'app-glyph'], app.id);
      assert.doesNotMatch(JSON.stringify(app.icon), /#[0-9a-f]{3,8}\b|rgb|hsl|gradient|fill|stroke/i, app.id);
    }
  });

  test('default favorites exist in the catalog', () => {
    assert.ok(DEFAULT_APP_FAVORITES.every((id) => byId(id)));
  });

  test('authuser is added only for the second account onwards', () => {
    assert.equal(appURL(byId('gmail'), 0), 'https://mail.google.com/mail/');
    assert.equal(appURL(byId('gmail'), 1), 'https://mail.google.com/mail/?authuser=1');
    assert.equal(appURL(byId('gemini'), 2), 'https://gemini.google.com/app?authuser=2');
  });
});

describe('apps state', () => {
  test('defaults', () => {
    assert.deepEqual(normalizeState({}).apps, {
      visible: true,
      favorites: DEFAULT_APP_FAVORITES,
      account: 0,
    });
  });

  test('unknown and duplicated favorites are dropped, order is kept', () => {
    const apps = normalizeState({
      apps: { favorites: ['drive', 'nope', 'gmail', 'drive'], account: 42 },
    }).apps;
    assert.deepEqual(apps, { visible: true, favorites: ['drive', 'gmail'], account: 9 });
  });

  test('an empty favorites list stays empty, visibility can be turned off', () => {
    const apps = normalizeState({ apps: { favorites: [], visible: false } }).apps;
    assert.deepEqual(apps.favorites, []);
    assert.equal(apps.visible, false);
  });

  test('round trip is stable', () => {
    const once = normalizeState({ apps: { favorites: ['maps', 'docs'], account: 1 } });
    assert.equal(serialize(normalizeState(JSON.parse(serialize(once)))), serialize(once));
  });
});
