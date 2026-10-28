import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LAYOUTS, LIMITS, STORAGE_KEY, THEMES, VISUAL_STYLES, WALLPAPERS } from '../js/config.js';
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
    assert.equal(state.engine, 'chrome');
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

  test('auto accents: one hex color per wallpaper, the single one of older saves kept', () => {
    assert.deepEqual(normalizeState({ autoAccent: { key: 'city', color: '#AABBCC' } }).autoAccents, {
      city: '#aabbcc',
    });
    const accents = { city: '#112233', 'custom:img-1': '#445566', bad: 'red; x' };
    assert.deepEqual(normalizeState({ autoAccents: accents }).autoAccents, {
      city: '#112233',
      'custom:img-1': '#445566',
    });
    assert.deepEqual(normalizeState({ autoAccents: 'nope', autoAccent: 'nope' }).autoAccents, {});
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, '#000000']));
    const kept = Object.keys(normalizeState({ autoAccents: many }).autoAccents);
    assert.deepEqual([kept.length, kept[0], kept.at(-1)], [LIMITS.accents, 'k14', 'k29']); // the latest ones
    assert.equal(normalizeState({ theme: 'auto' }).theme, 'auto');
  });

  test('own wallpapers: valid unique ids, a selection among them, a known rotation', () => {
    const state = normalizeState({
      customImages: ['selected', 'img-1', 'img-1', 'bad id!', 7, 'img-2'],
      customImage: 'img-9',
      rotation: 'hourly',
    });
    assert.deepEqual(state.customImages, ['selected', 'img-1', 'img-2']);
    assert.equal(state.customImage, 'selected');
    assert.equal(state.rotation, 'off');
    const chosen = normalizeState({ customImages: ['a', 'b'], customImage: 'b', rotation: 'daily' });
    assert.deepEqual([chosen.customImage, chosen.rotation], ['b', 'daily']);
    // The "every new tab" rotation of 3.2.0 is gone: its saves rotate daily.
    assert.equal(normalizeState({ customImages: ['a', 'b'], rotation: 'tab' }).rotation, 'daily');
    // The start of the rotation: any whole number (days count up); none in older saves.
    assert.equal(chosen.rotationShift, 0);
    assert.equal(normalizeState({ rotationShift: -20388 }).rotationShift, -20388);
    for (const bad of ['x', null, Infinity, {}]) {
      assert.equal(normalizeState({ rotationShift: bad }).rotationShift, 0);
    }
    const ids = Array.from({ length: 12 }, (_, i) => `img-${i}`);
    assert.equal(normalizeState({ customImages: ids }).customImages.length, LIMITS.wallpapers);
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
    assert.deepEqual(normalizeState({}).stats.history, {});
  });

  test('lists are capped', () => {
    const links = Array.from({ length: 50 }, (_, i) => ({ name: `L${i}`, url: `https://l${i}.dev` }));
    const tasks = Array.from({ length: 300 }, (_, i) => ({ text: `T${i}` }));
    const state = normalizeState({ links, tasks });
    assert.equal(state.links.length, LIMITS.links);
    assert.equal(state.tasks.length, LIMITS.tasks);
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

test('custom CSS is a string, capped', () => {
  assert.equal(normalizeState({}).customCSS, '');
  assert.equal(normalizeState({ customCSS: 42 }).customCSS, '');
  assert.equal(normalizeState({ customCSS: 'x'.repeat(30000) }).customCSS.length, LIMITS.css);
});

test("search engine: Chrome's by default; the old implicit Google default migrates, explicit choices stay", () => {
  assert.equal(normalizeState({}).engine, 'chrome');
  assert.equal(normalizeState({ schema: 5, engine: 'google' }).engine, 'chrome');
  assert.equal(normalizeState({ engine: 'google' }).engine, 'chrome'); // no schema: an old save
  assert.equal(normalizeState({ schema: 5, engine: 'ddg' }).engine, 'ddg');
  assert.equal(normalizeState({ schema: 6, engine: 'google' }).engine, 'google'); // chosen after the change
  assert.equal(normalizeState({ schema: 6, engine: 'bing' }).engine, 'chrome');
});

describe('visible parts of the page', () => {
  test('everything shown by default; only booleans count', () => {
    assert.deepEqual(normalizeState({}).show, {
      greeting: true,
      clock: true,
      date: true,
      links: true,
      focus: true,
      heatmap: true,
      tasks: true,
    });
    const { show } = normalizeState({ show: { focus: false, tasks: 'no', junk: false } });
    assert.equal(show.focus, false);
    assert.equal(show.tasks, true);
    assert.equal('junk' in show, false);
    assert.equal(normalizeState({ show: 'x' }).show.clock, true);
  });
});

describe('interface mode', () => {
  test('Developer by default and for saves from before the modes; Minimal kept; anything else Developer', () => {
    assert.equal(createDefaultState().layout, 'developer');
    assert.equal(normalizeState({ links: [], theme: 'mocha' }).layout, 'developer');
    assert.equal(normalizeState({ layout: 'minimal' }).layout, 'minimal');
    for (const layout of ['Minimal', 'focus', 42, null, ['minimal']]) {
      assert.equal(normalizeState({ layout }).layout, 'developer', String(layout));
    }
  });

  test('the mode is independent: switching it changes nothing else', () => {
    const saved = normalizeState({
      theme: 'light',
      show: { tasks: false, heatmap: false },
      tasks: [{ id: 'a', text: 'kept', done: true }],
      notes: 'kept too',
    });
    const minimal = normalizeState({ ...saved, layout: 'minimal' });
    assert.deepEqual({ ...minimal, layout: saved.layout }, saved);
    assert.deepEqual(normalizeState({ ...minimal, layout: 'developer' }), saved);
  });
});

describe('visual style', () => {
  test('Classic by default and for saves from before the styles; Glass kept; anything else Classic', () => {
    assert.equal(createDefaultState().visualStyle, 'classic');
    assert.equal(normalizeState({ layout: 'minimal', theme: 'light' }).visualStyle, 'classic');
    assert.equal(normalizeState({ visualStyle: 'glass' }).visualStyle, 'glass');
    for (const visualStyle of ['Glass', 'glassy', 'minimal', 1, null, ['glass']]) {
      assert.equal(normalizeState({ visualStyle }).visualStyle, 'classic', String(visualStyle));
    }
  });

  test('switching it changes nothing else, both ways', () => {
    const saved = normalizeState({
      layout: 'minimal',
      theme: 'mocha',
      wallpaper: 'warm-sand',
      show: { heatmap: false },
      tasks: [{ id: 'a', text: 'kept', done: false }],
      notes: 'kept too',
    });
    const glass = normalizeState({ ...saved, visualStyle: 'glass' });
    assert.deepEqual({ ...glass, visualStyle: saved.visualStyle }, saved);
    assert.deepEqual(normalizeState({ ...glass, visualStyle: 'classic' }), saved);
  });

  test('layout, style, theme and wallpaper are independent: every combination is kept as saved', () => {
    for (const layout of LAYOUTS) {
      for (const visualStyle of VISUAL_STYLES) {
        for (const theme of Object.keys(THEMES)) {
          for (const wallpaper of WALLPAPERS) {
            const state = normalizeState({ layout, visualStyle, theme, wallpaper });
            assert.deepEqual(
              [state.layout, state.visualStyle, state.theme, state.wallpaper],
              [layout, visualStyle, theme, wallpaper],
            );
          }
        }
      }
    }
  });
});

describe('built-in wallpapers', () => {
  test('the four new ones are known; earlier choices and the default are unchanged', () => {
    assert.deepEqual(WALLPAPERS, [
      'workstation',
      'city',
      'deep-space',
      'warm-sand',
      'sunrise-lake',
      'liquid-glass',
    ]);
    assert.equal(createDefaultState().wallpaper, 'workstation');
    assert.equal(normalizeState({ wallpaper: 'city' }).wallpaper, 'city');
    assert.equal(normalizeState({ wallpaper: 'custom', customImages: ['a'] }).wallpaper, 'custom');
    for (const wallpaper of ['deep space', 'Deep-Space', 'deep-space.webp', '../city', 'ocean']) {
      assert.equal(normalizeState({ wallpaper }).wallpaper, 'workstation', wallpaper);
    }
    // Their accents for the automatic theme are kept by id, like the others'.
    assert.deepEqual(normalizeState({ autoAccents: { 'liquid-glass': '#8395ed' } }).autoAccents, {
      'liquid-glass': '#8395ed',
    });
  });
});

describe('clock options', () => {
  test('24-hour without seconds by default; booleans only', () => {
    assert.deepEqual(normalizeState({}).clock, { hour12: false, seconds: false });
    assert.deepEqual(normalizeState({ clock: { hour12: true, seconds: 'yes' } }).clock, {
      hour12: true,
      seconds: false,
    });
  });
});

describe('search prefixes', () => {
  test('valid prefixes are kept, the rest dropped', () => {
    const { prefixes } = normalizeState({
      prefixes: [
        { key: ' Jira ', name: 'Jira', url: 'https://acme.atlassian.net/browse/%s' },
        { key: 'docs', url: 'https://www.example.com/search?q=%s' },
        { key: 'jira', url: 'https://other.dev/%s' }, // duplicate
        { key: 'gh', url: 'https://example.com/%s' }, // built-in prefix
        { key: 'uuid', url: 'https://example.com/%s' }, // palette tool
        { key: 'two words', url: 'https://example.com/%s' },
        { key: 'nourl', url: 'https://example.com/' },
        { key: 'host', url: 'https://%s.example.com/' },
        'junk',
      ],
    });
    assert.deepEqual(prefixes, [
      { key: 'jira', name: 'Jira', url: 'https://acme.atlassian.net/browse/%s' },
      { key: 'docs', name: 'example.com', url: 'https://www.example.com/search?q=%s' },
    ]);
  });

  test('defaults to none and is capped', () => {
    assert.deepEqual(normalizeState({}).prefixes, []);
    const many = Array.from({ length: 30 }, (_, i) => ({ key: `p${i}`, url: `https://p.dev/${i}/%s` }));
    assert.equal(normalizeState({ prefixes: many }).prefixes.length, LIMITS.prefixes);
  });
});

describe('loadState', () => {
  test('reads the saved state', () => {
    const loaded = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ theme: 'mocha' }) }));
    assert.equal(loaded.state.theme, 'mocha');
    assert.equal(loaded.corrupt, false);
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
