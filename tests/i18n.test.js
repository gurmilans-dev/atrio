import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import { GOOGLE_APPS, appName } from '../js/google-apps.js';
import { STRINGS, needsReload, ordinal, resolveLanguage, setLanguage, t } from '../js/i18n.js';
import { normalizeState } from '../js/state.js';

const placeholders = (entry) =>
  (typeof entry === 'object' ? Object.values(entry) : [entry])
    .flatMap((text) => text.match(/\{\w+\}/g) ?? [])
    .sort()
    .filter((name, index, list) => list.indexOf(name) === index);

afterEach(() => setLanguage('en'));

describe('dictionaries', () => {
  test('Italian and English have the same keys', () => {
    assert.deepEqual(Object.keys(STRINGS.it).sort(), Object.keys(STRINGS.en).sort());
  });

  test('every translation keeps the same placeholders and plural forms', () => {
    for (const key of Object.keys(STRINGS.en)) {
      assert.deepEqual(placeholders(STRINGS.it[key]), placeholders(STRINGS.en[key]), key);
      assert.equal(typeof STRINGS.it[key], typeof STRINGS.en[key], key);
    }
  });

  test('every key used by index.html exists', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const keys = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(keys.length > 50);
    for (const key of keys) assert.ok(key in STRINGS.en, key);
  });
});

describe('t', () => {
  test('interpolates and picks the plural form', () => {
    setLanguage('it');
    assert.equal(t('links.max', { n: 30 }), 'Massimo 30 collegamenti.');
    assert.equal(t('heatmap.sessions', { n: 1 }), '1 sessione');
    assert.equal(t('heatmap.sessions', { n: 4 }), '4 sessioni');
    setLanguage('en');
    assert.equal(t('heatmap.sessions', { n: 0 }), '0 sessions');
    assert.equal(t('greeting.named', { greeting: 'Good morning', name: 'Alex' }), 'Good morning, Alex.');
  });

  test('unknown keys and missing parameters stay visible', () => {
    assert.equal(t('nope.missing'), 'nope.missing');
    assert.equal(t('links.max'), 'At most {n} links.');
  });
});

describe('language choice', () => {
  test('"auto" follows the browser, Italian only for it-*', () => {
    assert.equal(resolveLanguage('auto', 'it-IT'), 'it');
    assert.equal(resolveLanguage('auto', 'it-CH'), 'it');
    assert.equal(resolveLanguage('auto', 'en-US'), 'en');
    assert.equal(resolveLanguage('auto', 'de-DE'), 'en');
    assert.equal(resolveLanguage('it', 'en-US'), 'it');
    assert.equal(resolveLanguage('en', 'it-IT'), 'en');
  });

  test('a reload is needed only when the resolved language changes', () => {
    setLanguage('en');
    assert.equal(needsReload('en'), false);
    assert.equal(needsReload('it'), true);
  });

  test('the saved choice is validated', () => {
    assert.equal(normalizeState({}).lang, 'auto');
    assert.equal(normalizeState({ lang: 'en' }).lang, 'en');
    assert.equal(normalizeState({ lang: 'fr' }).lang, 'auto');
  });
});

test('ordinals', () => {
  setLanguage('it');
  assert.equal(ordinal(2), '2°');
  setLanguage('en');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), [
    '1st',
    '2nd',
    '3rd',
    '4th',
    '11th',
    '12th',
    '13th',
    '21st',
    '22nd',
    '101st',
  ]);
});

test('Google app names follow the language', () => {
  const translate = GOOGLE_APPS.find((app) => app.id === 'translate');
  assert.equal(appName(translate, 'en'), 'Translate');
  assert.equal(appName(translate, 'it'), 'Traduttore');
  const gmail = GOOGLE_APPS.find((app) => app.id === 'gmail');
  assert.equal(appName(gmail, 'it'), 'Gmail');
});

test('the extension descriptions fit the Chrome Web Store limit (132 characters)', () => {
  for (const lang of ['en', 'it']) {
    const file = new URL(`../_locales/${lang}/messages.json`, import.meta.url);
    const { message } = JSON.parse(readFileSync(file, 'utf8')).appDescription;
    assert.ok(message.length <= 132, `${lang}: ${message.length} characters`);
  }
});
