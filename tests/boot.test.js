// Runs js/boot.js (a classic script) against a fake page, to check what it applies before the
// first paint, and that it picks the same rotating wallpaper as js/rotation.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { checkCSS, scopeCSS } from '../js/custom-css.js';
import { localDay, shownImage } from '../js/rotation.js';

const source = readFileSync(new URL('../js/boot.js', import.meta.url), 'utf8');
const KEY = 'workspace.newtab.v2';

// Stands in for Chrome's CSS parser: the text parses to the rules a test gives.
const rule = (name, cssRules = [], cssText = '') => ({ constructor: { name }, cssRules, cssText });
const scoped = (...rules) => [rule('CSSScopeRule', rules)];
const parsesTo = (cssRules) =>
  class {
    replaceSync(text) {
      this.text = text;
      this.cssRules = cssRules;
    }
  };

function boot(saved, storage = {}, parsed = scoped(rule('CSSStyleRule'))) {
  const store = new Map(Object.entries({ [KEY]: JSON.stringify(saved), ...storage }));
  const properties = {};
  const head = [];
  const root = {
    dataset: {},
    attributes: [],
    style: { setProperty: (name, value) => (properties[name] = value) },
    setAttribute(name) {
      this.attributes.push(name);
    },
  };
  vm.runInNewContext(source, {
    document: {
      documentElement: root,
      head: { append: (node) => head.push(node) },
      createElement: () => ({}),
    },
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    },
    CSSStyleSheet: parsesTo(parsed),
  });
  return { root, properties, store, head };
}

const rotating = (rotation) => ({
  theme: 'auto',
  wallpaper: 'custom',
  customImages: ['a', 'b', 'c'],
  customImage: 'a',
  rotation,
  autoAccents: { 'custom:a': '#111111', 'custom:b': '#222222', 'custom:c': '#333333' },
});

test('theme, wallpaper, hidden parts and blur are applied', () => {
  const { root, properties } = boot({
    theme: 'mocha',
    wallpaper: 'city',
    blur: 6,
    show: { focus: false, tasks: true },
  });
  assert.equal(root.dataset.theme, 'mocha');
  assert.equal(root.dataset.wallpaper, 'city');
  assert.equal(properties['--wallpaper'], 'url("assets/city.webp")');
  assert.equal(properties['--wallpaper-filter'], 'blur(6px)');
  assert.deepEqual(root.attributes, ['data-hide-focus']);
});

test('the accent of the image shown, with the same daily choice as js/rotation.js', () => {
  const state = rotating('daily');
  const expected = shownImage(state, { day: localDay(Date.now()), counter: 0 });
  assert.equal(boot(state).properties['--accent'], state.autoAccents[`custom:${expected}`]);
});

test('"every new tab" counts tabs apart from the state, as js/appearance.js reads it', () => {
  const state = rotating('tab');
  const { root, properties, store } = boot(state, { [`${KEY}.rotation`]: '4' });
  assert.equal(root.dataset.rotation, '5');
  assert.equal(store.get(`${KEY}.rotation`), '5');
  const expected = shownImage(state, { day: 0, counter: 5 });
  assert.equal(properties['--accent'], state.autoAccents[`custom:${expected}`]);
  assert.equal(JSON.parse(store.get(KEY)).customImage, 'a'); // the shared state is not touched
});

test('custom CSS is applied with the same @scope as js/custom-css.js', () => {
  const css = '.clock { color: red }';
  const { head } = boot({ customCSS: css });
  assert.deepEqual(head, [{ id: 'custom-css', textContent: scopeCSS(css) }]);
  assert.deepEqual(boot({ customCSS: '   ' }).head, []);
});

test('custom CSS that would reach the settings is left out before the first paint, as the settings refuse it', () => {
  const css = '.clock { color: red }';
  const cases = {
    'nested rules, @media, @layer, @keyframes': [
      scoped(
        rule('CSSStyleRule', [rule('CSSNestedDeclarations')]),
        rule('CSSMediaRule', [rule('CSSStyleRule')]),
        rule('CSSLayerStatementRule'),
        rule('CSSKeyframesRule', [rule('CSSKeyframeRule')]),
      ),
      { rules: 4 },
    ],
    'a stray brace': [[...scoped(rule('CSSStyleRule')), rule('CSSStyleRule')], { error: 'braces' }],
    '@property inside @media': [
      scoped(rule('CSSMediaRule', [rule('CSSPropertyRule', [], '@property --text { }')])),
      { error: 'global', rule: '@property' },
    ],
    '@font-face': [
      scoped(rule('CSSFontFaceRule', [], '@font-face { }')),
      { error: 'global', rule: '@font-face' },
    ],
    'an at-rule not known here': [
      scoped(rule('CSSFunctionRule', [], '@function --x() { }')),
      { error: 'global', rule: '@function' },
    ],
  };
  for (const [name, [parsed, expected]] of Object.entries(cases)) {
    globalThis.CSSStyleSheet = parsesTo(parsed);
    try {
      assert.deepEqual(checkCSS(css), expected, name);
    } finally {
      delete globalThis.CSSStyleSheet;
    }
    assert.equal(boot({ customCSS: css }, {}, parsed).head.length, expected.error ? 0 : 1, name);
  }
});

test('custom theme accent; an empty save changes nothing', () => {
  assert.equal(
    boot({ theme: 'custom', customAccent: { color: '#ea67af' } }).properties['--accent'],
    '#ea67af',
  );
  const { root, properties } = boot({});
  assert.deepEqual([root.dataset, properties, root.attributes], [{}, {}, []]);
});
