// End-to-end checks in a real headless Chrome: `npm run test:e2e` (set CHROME_PATH if Chrome is not found).
// Layout checks assume the default fonts of the machine; they were written on Windows.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './harness.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const STATE = `JSON.parse(localStorage.getItem('workspace.newtab.v2'))`;
const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`✔ ${name}${detail ? ` — ${detail}` : ''} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`✖ ${name}\n    ${error.message.split('\n').join('\n    ')}`);
  }
}

const browser = await launch(ROOT);
const a = await browser.openPage();

// Snippets evaluated inside the page.
const settings = (code) =>
  `(() => { const d = document.getElementById('settings'); d.showModal(); ${code}; d.close(); })()`;
const labels = (selector) =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].map((n) => n.textContent)`;
const blur = () => a.eval('document.activeElement.blur()');
const clearSearch = `(() => { const i = document.getElementById('search-input'); i.value = ''; i.dispatchEvent(new Event('input')); i.blur(); })()`;
const pageScroll = 'document.documentElement.scrollHeight - innerHeight';

try {
  await check('first render', async () => {
    const info = await a.eval(`({
      links: document.querySelectorAll('#links .shortcut').length,
      engines: document.querySelectorAll('#search-engine option').length,
      tips: document.querySelectorAll('#search-tips code').length,
      clock: document.getElementById('clock').textContent,
      saved: localStorage.getItem('workspace.newtab.v2') !== null,
    })`);
    assert.deepEqual(
      { ...info, clock: info.clock !== '--:--' },
      { links: 6, engines: 3, tips: 19, clock: true, saved: true },
    );
    assert.ok((await a.eval(pageScroll)) <= 0, 'the page scrolls at 1440×900');
  });

  await check('search hints', async () => {
    const hints = await a.eval(`(() => {
      const input = document.getElementById('search-input');
      const out = {};
      for (const value of ['npm zod', 'console.log', 'localhost:3000', 'chrome://extensions', 'so css grid', 'yt']) {
        input.value = value;
        input.dispatchEvent(new Event('input'));
        const hint = document.getElementById('search-hint');
        out[value] = hint.hidden ? '' : hint.textContent;
      }
      input.value = '';
      input.dispatchEvent(new Event('input'));
      return out;
    })()`);
    assert.deepEqual(hints, {
      'npm zod': '→ npm',
      'console.log': '',
      'localhost:3000': '↗ apri sito',
      'chrome://extensions': '↗ pagina Chrome',
      'so css grid': '→ Stack Overflow',
      yt: '↗ YouTube',
    });
  });

  await check('tasks: add, toggle, clear done, undo', async () => {
    const r = await a.eval(`(() => {
      const input = document.getElementById('task-input');
      for (const text of ['Primo', 'Secondo']) { input.value = text; document.getElementById('task-form').requestSubmit(); }
      const rows = () => ${labels('#task-list .task-label')}.join();
      const added = rows();
      document.querySelector('#task-list [data-action=toggle]').click();
      const counter = document.getElementById('task-counter').textContent;
      document.getElementById('clear-done').click();
      const cleared = rows();
      document.querySelector('#toast .toast-action').click();
      return { added, counter, cleared, undone: rows() };
    })()`);
    assert.deepEqual(r, {
      added: 'Secondo,Primo',
      counter: '1 / 2',
      cleared: 'Primo',
      undone: 'Secondo,Primo',
    });
  });

  await check('keyboard shortcuts T, S, Esc, /', async () => {
    await blur();
    await a.press('t');
    const task = await a.eval('document.activeElement.id');
    await a.press('Escape');
    await a.press('s');
    const open = await a.eval(`document.getElementById('settings').open`);
    await sleep(300);
    await a.press('Escape');
    await sleep(300);
    const closed = !(await a.eval(`document.getElementById('settings').open`));
    await a.press('/');
    const search = await a.eval('document.activeElement.id');
    await a.press('Escape');
    assert.deepEqual(
      { task, open, closed, search },
      { task: 'task-input', open: true, closed: true, search: 'search-input' },
    );
  });

  await check('timer: start and pause with P, countdown in the tab title', async () => {
    await blur();
    await a.press('p');
    await sleep(1200);
    const running = await a.eval(`({ title: document.title, stored: ${STATE}.timer.running })`);
    await a.press('p');
    const paused = await a.eval(
      `({ title: document.title, button: document.getElementById('timer-toggle').textContent })`,
    );
    await a.click('#timer-reset');
    assert.ok(running.stored && /^24:5\d · Focus$/.test(running.title), JSON.stringify(running));
    assert.deepEqual(paused, { title: 'Nuova scheda', button: 'Riprendi' });
  });

  await check('timer: a finished session readies the break and counts the day', async () => {
    await a.eval(`(() => {
      const s = ${STATE};
      s.timer = { mode: 'focus', running: true, remaining: 1500, total: 1500, endAt: Date.now() + 1200 };
      localStorage.setItem('workspace.newtab.v2', JSON.stringify(s));
    })()`);
    await a.goto();
    await sleep(1800);
    const r = await a.eval(`({
      mode: ${STATE}.timer.mode,
      count: document.getElementById('focus-count').textContent,
      timer: document.getElementById('timer').textContent,
      celebrate: document.getElementById('focus-panel').classList.contains('celebrate'),
    })`);
    assert.deepEqual(r, { mode: 'break', count: '1 oggi', timer: '05:00', celebrate: true });
  });

  await check('timer: a new preset does not cut a started session', async () => {
    const r = await a.eval(`(() => {
      document.getElementById('timer-toggle').click();
      document.getElementById('settings').showModal();
      document.querySelector('[data-preset="50"]').click();
      const during = ${STATE};
      document.getElementById('timer-reset').click();
      const reset = ${STATE}.timer.total;
      document.querySelector('[data-preset="25"]').click();
      document.getElementById('settings').close();
      return { preset: during.preset, total: during.timer.total, running: during.timer.running, reset };
    })()`);
    assert.deepEqual(r, { preset: 50, total: 300, running: true, reset: 600 });
  });

  await check('themes recolor the whole interface', async () => {
    const colors = new Set();
    for (const theme of ['mocha', 'matrix', 'tokyo']) {
      await a.eval(settings(`document.querySelector('[data-theme-choice="${theme}"]').click()`));
      colors.add(await a.eval(`getComputedStyle(document.querySelector('.link-icon')).borderColor`));
    }
    assert.equal(colors.size, 3);
  });

  await check('links: edit, move, remove with undo, URL without scheme', async () => {
    const r = await a.eval(`(() => {
      const names = () => ${labels('#links .link-name')}.slice(0, 2).join();
      document.getElementById('settings').showModal();
      document.querySelector('#settings-links [data-action=edit]').click();
      document.getElementById('link-name').value = 'GitHub Pro';
      document.getElementById('link-form').requestSubmit();
      const edited = names();
      document.querySelector('#settings-links [data-action=down]').click();
      const moved = names();
      document.querySelector('#settings-links [data-action=remove]').click();
      const toastInDialog = document.getElementById('toast').parentElement.id;
      document.querySelector('#toast .toast-action').click();
      const undone = names();
      document.getElementById('link-name').value = 'Local';
      document.getElementById('link-url').value = 'localhost:5173';
      document.getElementById('link-form').requestSubmit();
      document.getElementById('settings').close();
      return { edited, moved, toastInDialog, undone, last: ${STATE}.links.at(-1).url };
    })()`);
    assert.deepEqual(r, {
      edited: 'GitHub Pro,ChatGPT',
      moved: 'ChatGPT,GitHub Pro',
      toastInDialog: 'settings',
      undone: 'ChatGPT,GitHub Pro',
      last: 'http://localhost:5173/',
    });
  });

  await check('wallpaper upload is downscaled to WebP and survives reload', async () => {
    const r = await a.eval(`(async () => {
      const canvas = new OffscreenCanvas(4000, 3000);
      const context = canvas.getContext('2d');
      const gradient = context.createLinearGradient(0, 0, 4000, 3000);
      gradient.addColorStop(0, '#203060');
      gradient.addColorStop(1, '#f0a040');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 4000, 3000);
      const png = await canvas.convertToBlob({ type: 'image/png' });
      const transfer = new DataTransfer();
      transfer.items.add(new File([png], 'big.png', { type: 'image/png' }));
      const input = document.getElementById('wallpaper-upload');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      for (let i = 0; i < 50 && !document.documentElement.hasAttribute('data-wallpaper-ready'); i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const db = await new Promise((resolve) => { const q = indexedDB.open('workspace-wallpaper', 1); q.onsuccess = () => resolve(q.result); });
      const blob = await new Promise((resolve) => { const q = db.transaction('images').objectStore('images').get('selected'); q.onsuccess = () => resolve(q.result); });
      const bitmap = await createImageBitmap(blob);
      return { type: blob.type, smaller: bitmap.width < 4000, ready: document.documentElement.hasAttribute('data-wallpaper-ready') };
    })()`);
    assert.deepEqual(r, { type: 'image/webp', smaller: true, ready: true });
    await a.goto();
    const boot = await a.eval(`({
      wallpaper: document.documentElement.dataset.wallpaper,
      ready: document.documentElement.hasAttribute('data-wallpaper-ready'),
      blob: getComputedStyle(document.documentElement).getPropertyValue('--wallpaper').includes('blob:'),
    })`);
    assert.deepEqual(boot, { wallpaper: 'custom', ready: true, blob: true });
  });

  await check('backup: export, reset, import (wallpaper included)', async () => {
    const r = await a.eval(`(async () => {
      let href;
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { if (this.download) href = this.href; else click.call(this); };
      document.getElementById('export-data').click();
      for (let i = 0; i < 50 && !href; i++) await new Promise((resolve) => setTimeout(resolve, 100));
      HTMLAnchorElement.prototype.click = click;
      const text = await (await fetch(href)).text();
      const payload = JSON.parse(text);
      window.confirm = () => true;
      document.getElementById('settings').showModal();
      document.getElementById('reset-data').click();
      await new Promise((resolve) => setTimeout(resolve, 400));
      const afterReset = document.querySelectorAll('#task-list li').length;
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], 'backup.json', { type: 'application/json' }));
      const input = document.getElementById('import-file');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      for (let i = 0; i < 50 && !document.querySelector('#task-list li'); i++) await new Promise((resolve) => setTimeout(resolve, 100));
      await new Promise((resolve) => setTimeout(resolve, 600));
      document.getElementById('settings').close();
      const s = ${STATE};
      return { app: payload.app, image: Boolean(payload.wallpaperImage), timer: 'timer' in payload.state, afterReset, tasks: s.tasks.length, wallpaper: s.wallpaper };
    })()`);
    assert.deepEqual(r, {
      app: 'atrio',
      image: true,
      timer: false,
      afterReset: 0,
      tasks: 2,
      wallpaper: 'custom',
    });
  });

  await check('several open tabs never overwrite each other', async () => {
    const b = await browser.openPage();
    await a.eval(
      `(() => { const i = document.getElementById('task-input'); i.value = 'Da scheda A'; document.getElementById('task-form').requestSubmit(); })()`,
    );
    await sleep(300);
    const seenInB = await b.eval(`${labels('#task-list .task-label')}.includes('Da scheda A')`);
    await b.eval(`document.getElementById('timer-toggle').click()`);
    await sleep(300);
    const kept = await a.eval(`${STATE}.tasks.some((task) => task.text === 'Da scheda A')`);
    const timerInA = await a.eval(`document.getElementById('timer-state').textContent`);
    await b.eval(`document.getElementById('timer-reset').click()`);
    await b.close();
    assert.deepEqual({ seenInB, kept, timerInA }, { seenInB: true, kept: true, timerInA: 'In corso' });
  });

  await check('corrupted storage is backed up, not lost', async () => {
    await a.eval(`localStorage.setItem('workspace.newtab.v2', '{broken json')`);
    await a.goto();
    const r = await a.eval(`({
      backup: localStorage.getItem('workspace.newtab.v2.corrupt'),
      links: document.querySelectorAll('#links .shortcut').length,
    })`);
    assert.deepEqual(r, { backup: '{broken json', links: 6 });
  });

  await check('settings button in the corner opens the drawer', async () => {
    await a.click('#open-settings');
    await sleep(300);
    const open = await a.eval(`document.getElementById('settings').open`);
    await a.click('#close-settings');
    await sleep(300);
    assert.ok(open);
  });

  await check('wallpaper blur: live preview, saved, applied before paint, off at 0', async () => {
    const set = (value) =>
      a.eval(
        settings(`const r = document.getElementById('blur-range'); r.value = '${value}';
        r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'))`),
      );
    const read = `({ filter: getComputedStyle(document.querySelector('.wallpaper')).filter, stored: ${STATE}.blur })`;
    await set(14);
    const after = await a.eval(read);
    await a.goto();
    const reloaded = await a.eval(read);
    await set(0);
    const zero = await a.eval(read);
    assert.deepEqual(
      { after, reloaded, zero },
      {
        after: { filter: 'blur(14px)', stored: 14 },
        reloaded: { filter: 'blur(14px)', stored: 14 },
        zero: { filter: 'none', stored: 0 },
      },
    );
  });

  await check('palette: links and commands while typing, ↓ and Esc', async () => {
    await blur();
    await a.press('/');
    await a.type('git');
    const rows = await a.eval(labels('#search-results .result-label'));
    await a.press('ArrowDown');
    const active = await a.eval(
      `document.getElementById('search-input').getAttribute('aria-activedescendant')`,
    );
    await a.press('Escape');
    const afterEsc = await a.eval(
      `({ open: !document.getElementById('search-results').hidden, value: document.getElementById('search-input').value })`,
    );
    await a.eval(clearSearch);
    assert.ok(rows[0] === 'git' && rows.includes('GitHub'), JSON.stringify(rows));
    assert.deepEqual({ active, afterEsc }, { active: 'result-1', afterEsc: { open: false, value: 'git' } });
  });

  await check('palette: ">" runs commands, Ctrl+Shift+P opens it', async () => {
    await blur();
    await a.press('>');
    const count = await a.eval(`document.querySelectorAll('#search-results .result').length`);
    await a.type('moch');
    const first = await a.eval(`${labels('#search-results .result-label')}[0]`);
    await a.press('Enter');
    const theme = await a.eval('document.documentElement.dataset.theme');
    await a.press('p', { ctrl: true, shift: true });
    const opened = await a.eval(`document.getElementById('search-input').value`);
    await a.type('tokyo');
    await a.press('Enter');
    assert.ok(count >= 10, `${count} commands`);
    assert.deepEqual({ first, theme, opened }, { first: 'Tema: Mocha', theme: 'mocha', opened: '>' });
  });

  await check('palette: "+ text" adds a task', async () => {
    await blur();
    await a.press('/');
    await a.type('+ rivedere la PR #42');
    await a.press('Enter');
    assert.equal(await a.eval(`${labels('#task-list .task-label')}[0]`), 'rivedere la PR #42');
  });

  await check('focus heatmap and streak', async () => {
    await a.eval(`(() => {
      const s = ${STATE};
      const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return key(d); };
      s.stats.history = { [ago(1)]: 2, [ago(2)]: 4, [ago(3)]: 7, [ago(9)]: 1, [ago(30)]: 3 };
      s.timer = { mode: 'focus', running: true, remaining: 1500, total: 1500, endAt: Date.now() + 1500 };
      localStorage.setItem('workspace.newtab.v2', JSON.stringify(s));
    })()`);
    await a.goto();
    await sleep(1600);
    const r = await a.eval(`({
      cells: document.querySelectorAll('#heatmap .cell').length,
      today: document.querySelector('#heatmap .cell.today').classList.contains('l1'),
      strongest: document.querySelectorAll('#heatmap .cell.l4').length,
      streak: document.getElementById('streak').textContent,
    })`);
    assert.deepEqual(r, { cells: 140, today: true, strongest: 1, streak: 'serie: 4 giorni' });
  });

  await check('"Dallo sfondo" theme extracts the accent and applies it before paint', async () => {
    await a.eval(
      `(() => { document.getElementById('settings').showModal(); document.querySelector('[data-theme-choice="auto"]').click(); })()`,
    );
    let accent = null;
    for (let i = 0; i < 30 && !accent; i++) {
      await sleep(100);
      accent = await a.eval(`${STATE}.autoAccent`);
    }
    await a.eval(`document.getElementById('settings').close()`);
    await a.goto();
    const boot = await a.eval(`document.documentElement.style.getPropertyValue('--accent')`);
    await a.eval(settings(`document.querySelector('[data-theme-choice="tokyo"]').click()`));
    const reset = await a.eval(`document.documentElement.style.getPropertyValue('--accent')`);
    assert.ok(accent?.key === 'workstation' && /^#[0-9a-f]{6}$/.test(accent.color), JSON.stringify(accent));
    assert.deepEqual({ boot, reset }, { boot: accent.color, reset: '' });
  });

  await check('notes: N opens them, autosave, survive reload', async () => {
    await blur();
    await a.press('n');
    const focused = await a.eval('document.activeElement.id');
    await a.type('npm run dev -- --port 5173');
    await sleep(700);
    const saved = await a.eval(
      `({ notes: ${STATE}.notes, status: document.getElementById('notes-status').textContent })`,
    );
    assert.ok((await a.eval(pageScroll)) <= 0, 'the page scrolls with the notes open');
    await a.goto();
    const reloaded = await a.eval(`document.getElementById('notes-input').value`);
    await blur();
    await a.press('t');
    const back = await a.eval(
      `({ id: document.activeElement.id, notesHidden: document.getElementById('notes-pane').hidden })`,
    );
    assert.deepEqual(
      { focused, saved, reloaded, back },
      {
        focused: 'notes-input',
        saved: { notes: 'npm run dev -- --port 5173', status: 'salvate' },
        reloaded: 'npm run dev -- --port 5173',
        back: { id: 'task-input', notesHidden: true },
      },
    );
  });

  await check('greeting uses the name', async () => {
    const text = await a.eval(`(() => {
      document.getElementById('settings').showModal();
      const input = document.getElementById('name-input');
      input.value = 'Alex';
      input.dispatchEvent(new Event('input'));
      document.getElementById('settings').close();
      return document.getElementById('greeting').textContent;
    })()`);
    assert.match(text, /^(Buongiorno|Buon pomeriggio|Buonasera|Buonanotte), Alex\.$/);
  });

  await check('mouse effects: off by default, then spotlight and parallax when turned on', async () => {
    await a.eval(clearSearch);
    const firstCard = `(() => { const r = document.querySelector('#links .shortcut').getBoundingClientRect(); return { x: r.x + 30, y: r.y + 20 }; })()`;
    const read = `(() => {
      const c = document.querySelector('#links .shortcut');
      return {
        lit: c.classList.contains('lit'),
        mx: c.querySelector('.glow-ring')?.style.getPropertyValue('--mx') ?? null,
        parallax: document.querySelector('.wallpaper').style.transform.startsWith('translate3d('),
        lift: getComputedStyle(c).transform !== 'none',
      };
    })()`;
    const wiggle = async () => {
      const { x, y } = await a.eval(firstCard);
      await a.move(x, y);
      await a.move(x + 5, y + 2);
      await sleep(250);
    };
    const stored = await a.eval(`${STATE}.mouseEffects`);
    await wiggle();
    const off = await a.eval(read);
    await a.eval(settings(`document.getElementById('mouse-effects-toggle').click()`)); // on
    await wiggle();
    const on = await a.eval(read);
    await a.eval(settings(`document.getElementById('mouse-effects-toggle').click()`)); // off again
    const offAgain = await a.eval(read);
    assert.equal(stored, false);
    assert.deepEqual(off, { lit: false, mx: null, parallax: false, lift: false });
    assert.deepEqual(on, { lit: true, mx: '35px', parallax: true, lift: true });
    assert.equal(offAgain.parallax || offAgain.lit, false);
  });

  await check('developer tools in the palette: results, hint, Enter copies', async () => {
    await a.eval(
      `window.__copied = []; navigator.clipboard.writeText = async (text) => { window.__copied.push(text); }`,
    );
    const rowsFor = async (text) => {
      await a.eval(clearSearch);
      await blur(); // closing the settings gives focus back to the last field used (the task input)
      await a.press('/');
      await a.type(text);
      return a.eval(`({
        rows: ${labels('#search-results .result-label')},
        hint: document.getElementById('search-hint').textContent,
        swatch: Boolean(document.querySelector('#search-results .swatch-icon')),
        title: document.querySelector('#search-results .result-label')?.title,
      })`);
    };
    const calc = await rowsFor('= 2^10');
    await a.press('Enter');
    const afterEnter = await a.eval(`({
      copied: window.__copied.at(-1),
      open: !document.getElementById('search-results').hidden,
      toast: document.getElementById('toast').textContent,
    })`);
    const color = await rowsFor('#7aa2f7');
    const uuid = await rowsFor('uuid');
    const auto = await rowsFor('1024*3');
    const search = await rowsFor('react hooks');
    const jwt = await rowsFor(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    );
    const hash = await rowsFor('sha256 abc');
    await a.press('Escape');
    await a.eval(clearSearch);
    assert.deepEqual(
      { jwt: jwt.rows[0], jwtTitle: jwt.title, jwtHint: jwt.hint, hash: hash.rows[0], hashHint: hash.hint },
      {
        jwt: '{"sub":"1234567890","name":"John Doe","iat":1516239022}',
        jwtTitle: '{"sub":"1234567890","name":"John Doe","iat":1516239022}',
        jwtHint: '⧉ JWT',
        hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        hashHint: '⧉ SHA-256',
      },
    );
    assert.deepEqual(calc, {
      rows: ['1024', '0x400', '0b10000000000', '= 2^10'],
      hint: '⧉ Calcolatrice',
      swatch: false,
      title: '1024',
    });
    assert.deepEqual(afterEnter, { copied: '1024', open: true, toast: 'Copiato: 1024' });
    assert.deepEqual(color.rows.slice(0, 2), ['#7aa2f7', 'rgb(122, 162, 247)']);
    assert.ok(color.swatch);
    assert.match(uuid.rows[0], /^[0-9a-f-]{36}$/);
    assert.equal(auto.rows[0], '3072');
    assert.equal(search.hint, '');
  });

  await check('more developer tools: json, case, http', async () => {
    const firstRow = async (text) => {
      await a.eval(clearSearch);
      await blur();
      await a.press('/');
      await a.type(text);
      return a.eval(`({
        label: document.querySelector('#search-results .result-label')?.textContent,
        hint: document.getElementById('search-hint').textContent,
      })`);
    };
    const results = {
      json: await firstRow('{"a":1,"b":[2,3]}'),
      jsonError: await firstRow('json {"a":1,}'),
      case: await firstRow('case user profile id'),
      http: await firstRow('http 404'),
    };
    await a.press('Escape');
    await a.eval(clearSearch);
    assert.deepEqual(results, {
      json: { label: '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}', hint: '⧉ JSON' },
      jsonError: { label: 'JSON non valido al carattere 8, vicino a “{"a":1,}”', hint: '⧉ JSON' },
      case: { label: 'userProfileId', hint: '⧉ Stile dei nomi' },
      http: { label: '404 Not Found', hint: '⧉ Codici HTTP' },
    });
  });

  await check('search engine lives in the settings', async () => {
    const inSettings = await a.eval(`Boolean(document.querySelector('#settings #search-engine'))`);
    await a.eval(
      settings(
        `const s = document.getElementById('search-engine'); s.value = 'ddg'; s.dispatchEvent(new Event('change'))`,
      ),
    );
    await blur();
    await a.press('/');
    await a.type('git'); // also matches the GitHub link, so the list opens
    const detail = await a.eval(
      `document.querySelector('#search-results .result-detail')?.textContent ?? null`,
    );
    await a.press('Escape');
    await a.eval(clearSearch);
    const engine = await a.eval(`${STATE}.engine`);
    await a.eval(
      settings(
        `const s = document.getElementById('search-engine'); s.value = 'google'; s.dispatchEvent(new Event('change'))`,
      ),
    );
    assert.deepEqual(
      { inSettings, engine, detail },
      { inSettings: true, engine: 'ddg', detail: 'Cerca su DuckDuckGo' },
    );
  });

  const apps = `(() => {
    const panel = document.getElementById('apps-panel');
    return {
      open: panel.matches(':popover-open'),
      favorites: [...document.querySelectorAll('#apps-favorites .app')].map((n) => n.dataset.id),
      others: document.querySelectorAll('#apps-others .app').length,
      focused: document.activeElement.dataset.id ?? document.activeElement.id,
    };
  })()`;

  await check('Google apps: G opens the launcher, icons render, Esc closes', async () => {
    await a.goto();
    await blur();
    await a.press('g');
    await sleep(250);
    const opened = await a.eval(apps);
    const icons = await a.eval(`({
      empty: [...document.querySelectorAll('#apps-panel .app-icon')].filter((s) => !s.getBBox().width).length,
      day: document.querySelector('#apps-panel [data-id="calendar"] text').textContent,
      fits: (() => { const p = document.getElementById('apps-panel'); return p.scrollHeight <= p.clientHeight; })(),
    })`);
    await a.press('Escape');
    await sleep(250);
    const closed = !(await a.eval(`document.getElementById('apps-panel').matches(':popover-open')`));
    assert.deepEqual(
      { ...opened, favorites: opened.favorites.length, ...icons, closed },
      {
        open: true,
        favorites: 9,
        others: 15,
        focused: 'account',
        empty: 0,
        day: String(new Date().getDate()),
        fits: true,
        closed: true,
      },
    );
  });

  await check('Google apps: edit favorites, drag and keyboard reorder, account', async () => {
    await a.click('#apps-button');
    await sleep(250);
    await a.click('#apps-edit');
    await a.eval(`document.querySelector('#apps-others [data-id="youtube"]').click()`);
    await a.eval(`document.querySelector('#apps-favorites [data-id="account"]').click()`);
    await a.eval(`document.querySelector('#apps-favorites [data-id="youtube"]').focus()`);
    await a.press('ArrowLeft', { ctrl: true });
    await a.eval(`(() => {
      const grid = document.getElementById('apps-favorites');
      const gmail = grid.querySelector('[data-id="gmail"]');
      const drive = grid.querySelector('[data-id="drive"]');
      const rect = drive.getBoundingClientRect();
      const dataTransfer = new DataTransfer();
      gmail.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
      drive.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer, clientX: rect.right - 5, clientY: rect.top + 10 }));
      drive.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
      gmail.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
    })()`);
    await a.click('#apps-edit');
    await a.click('#account-picks [data-account="1"]');
    const href = await a.eval(`document.querySelector('#apps-favorites [data-id="gmail"]').href`);
    const stored = await a.eval(`${STATE}.apps`);
    await a.press('Escape');
    assert.deepEqual(stored.favorites, [
      'drive',
      'gmail',
      'classroom',
      'docs',
      'gemini',
      'sheets',
      'slides',
      'youtube',
      'calendar',
    ]);
    assert.equal(stored.account, 1);
    assert.equal(href, 'https://mail.google.com/mail/?authuser=1');
  });

  await check('Google apps: found by the palette, button can be hidden', async () => {
    await blur();
    await a.press('/');
    await a.type('calendario');
    const rows = await a.eval(
      `[...document.querySelectorAll('#search-results .result')].map((r) => r.querySelector('.result-label').textContent + '|' + r.querySelector('.result-detail').textContent)`,
    );
    await a.press('Escape');
    await a.eval(clearSearch);
    await a.eval(settings(`document.getElementById('apps-toggle').click()`));
    await a.goto();
    const hidden = await a.eval(`getComputedStyle(document.getElementById('apps-button')).display`);
    await a.press('g');
    const stillClosed = !(await a.eval(`document.getElementById('apps-panel').matches(':popover-open')`));
    await a.eval(settings(`document.getElementById('apps-toggle').click()`));
    const back = await a.eval(`getComputedStyle(document.getElementById('apps-button')).display`);
    assert.ok(rows.includes('Calendar|Google'), JSON.stringify(rows));
    assert.deepEqual({ hidden, stillClosed, back }, { hidden: 'none', stillClosed: true, back: 'grid' });
  });

  await check('reduced motion keeps the mouse effects off even when enabled', async () => {
    await a.eval(settings(`document.getElementById('mouse-effects-toggle').click()`)); // effects on
    await a.reducedMotion(true);
    await a.goto();
    const { x, y } = await a.eval(
      `(() => { const r = document.querySelector('#links .shortcut').getBoundingClientRect(); return { x: r.x + 30, y: r.y + 20 }; })()`,
    );
    await a.move(x, y);
    await a.move(x + 5, y + 2);
    const r = await a.eval(`({
      transform: document.querySelector('.wallpaper').style.transform,
      lit: document.querySelectorAll('.glow.lit').length,
      lift: getComputedStyle(document.querySelector('#links .shortcut')).transform,
    })`);
    await a.reducedMotion(false);
    await a.eval(settings(`document.getElementById('mouse-effects-toggle').click()`)); // back off
    assert.deepEqual(r, { transform: '', lit: 0, lift: 'none' });
  });

  await check('personal search prefixes: add, use, reserved names, remove', async () => {
    const submit = async (key, url, name = '') => {
      await a.eval(
        settings(`
          document.getElementById('prefix-key').value = ${JSON.stringify(key)};
          document.getElementById('prefix-name').value = ${JSON.stringify(name)};
          document.getElementById('prefix-url').value = ${JSON.stringify(url)};
          document.getElementById('prefix-form').requestSubmit()`),
      );
      return a.eval(`document.getElementById('toast').textContent`);
    };
    const hintFor = async (text) => {
      await a.eval(clearSearch);
      await blur();
      await a.press('/');
      await a.type(text);
      return a.eval(`document.getElementById('search-hint').textContent`);
    };
    const added = await submit('Jira', 'acme.atlassian.net/browse/%s', 'Jira');
    const reserved = await submit('gh', 'https://example.com/%s');
    const badUrl = await submit('host', 'https://%s.example.com/');
    const saved = await a.eval(`${STATE}.prefixes`);
    const search = await hintFor('jira ABC-12');
    const alone = await hintFor('jira');
    await a.eval(clearSearch);
    await a.eval(
      settings(
        `document.querySelector('#settings-prefixes [data-key="jira"] [data-action="remove"]').click()`,
      ),
    );
    const after = await a.eval(
      `({ saved: ${STATE}.prefixes.length, rows: document.querySelectorAll('#settings-prefixes .settings-link').length })`,
    );
    assert.deepEqual(
      { added, reserved, badUrl, saved, search, alone, after },
      {
        added: 'Prefisso “jira” aggiunto.',
        reserved: '“gh” è già usato da Atrio: scegli un altro prefisso.',
        badUrl: 'Indirizzo non valido: serve un URL http o https con %s dove va il testo, fuori dal dominio.',
        saved: [{ key: 'jira', name: 'Jira', url: 'https://acme.atlassian.net/browse/%s' }],
        search: '→ Jira',
        alone: '↗ Jira',
        after: { saved: 0, rows: 0 },
      },
    );
  });

  await check('search: the × clears the box and keeps the focus', async () => {
    await blur();
    const read = () =>
      a.eval(`({
        clear: !document.getElementById('search-clear').hidden,
        key: !document.getElementById('search-key').hidden,
        value: document.getElementById('search-input').value,
        focused: document.activeElement.id,
        open: !document.getElementById('search-results').hidden,
      })`);
    const empty = await read();
    await a.press('/');
    await a.type('>tema');
    const typed = await read();
    await a.click('#search-clear');
    const cleared = await read();
    await a.eval(clearSearch);
    assert.deepEqual(
      { empty, typed, cleared },
      {
        empty: { clear: false, key: true, value: '', focused: '', open: false },
        typed: { clear: true, key: false, value: '>tema', focused: 'search-input', open: true },
        cleared: { clear: false, key: true, value: '', focused: 'search-input', open: false },
      },
    );
  });

  await check('online suggestions: off by default, then from the engine, never for prefixes', async () => {
    // The engine is faked: the test must not depend on the network.
    await a.eval(`
      window.__requests = [];
      window.fetch = async (url, options) => {
        window.__requests.push({ url: String(url), credentials: options?.credentials });
        return new Response(JSON.stringify(['rea', ['Rea', 'react', 'react hooks', 'readme']]));
      };`);
    const rowsFor = async (text) => {
      await a.eval(clearSearch);
      await blur();
      await a.press('/');
      await a.type(text);
      await sleep(450); // past the pause in typing
      return a.eval(labels('#search-results .result-label'));
    };
    const off = await rowsFor('rea');
    const requestsOff = await a.eval('window.__requests.length');
    await a.eval(settings(`document.getElementById('suggest-toggle').click()`));
    const on = await rowsFor('rea');
    const prefixed = await rowsFor('yt rea');
    const requests = await a.eval('window.__requests');
    await a.eval(clearSearch);
    await a.eval(settings(`document.getElementById('suggest-toggle').click()`)); // back off
    assert.deepEqual(
      {
        off: off.includes('react hooks'),
        requestsOff,
        on: on.slice(0, 4),
        requests: requests.length,
        url: requests[0]?.url,
        credentials: requests[0]?.credentials,
        prefixed: prefixed.includes('react hooks'),
      },
      {
        off: false,
        requestsOff: 0,
        on: ['rea', 'react', 'react hooks', 'readme'],
        requests: 1,
        url: 'https://suggestqueries.google.com/complete/search?client=chrome&ie=utf-8&oe=utf-8&hl=it&q=rea',
        credentials: 'omit',
        prefixed: false,
      },
    );
  });

  await check('recent searches: remembered, offered on an empty box, Shift+Delete forgets', async () => {
    // A personal prefix pointing back to this page runs a real search without leaving the test server.
    const origin = await a.eval('location.origin');
    await a.eval(
      settings(`
        document.getElementById('prefix-key').value = 'loc';
        document.getElementById('prefix-url').value = ${JSON.stringify(`${origin}/index.html?q=%s`)};
        document.getElementById('prefix-form').requestSubmit()`),
    );
    await blur();
    await a.press('/');
    await a.type('loc hello world');
    await a.press('Enter');
    await sleep(1500); // the "search" reloads this page
    const saved = await a.eval(`({ recent: ${STATE}.recent, url: location.search })`);
    const read = () =>
      a.eval(`({
        open: !document.getElementById('search-results').hidden,
        rows: ${labels('#search-results .result-label')},
        active: document.querySelectorAll('#search-results .result.active').length,
      })`);
    await blur();
    await a.press('/');
    const empty = await read();
    await a.press('Enter'); // nothing preselected: nothing runs
    const stillHere = await a.eval('location.search');
    await a.type('hel');
    const typed = await read();
    await a.press('ArrowDown');
    await a.press('Delete', { shift: true });
    const after = await a.eval(`${STATE}.recent.length`);
    await a.eval(clearSearch);
    await a.eval(
      settings(
        `document.querySelector('#settings-prefixes [data-key="loc"] [data-action="remove"]').click()`,
      ),
    );
    assert.deepEqual(
      { saved, empty, stillHere, typed: typed.rows.slice(0, 2), after },
      {
        saved: { recent: ['loc hello world'], url: '?q=hello%20world' },
        empty: { open: true, rows: ['loc hello world'], active: 0 },
        stillHere: '?q=hello%20world',
        typed: ['hel', 'loc hello world'],
        after: 0,
      },
    );
  });

  await check('language: English from settings, every text translated, back to Italian', async () => {
    const before = await a.eval(`document.documentElement.lang`);
    await a.eval(
      settings(
        `const s = document.getElementById('language-select'); s.value = 'en'; s.dispatchEvent(new Event('change'))`,
      ),
    );
    await sleep(800); // the page reloads
    const read = () =>
      a.eval(`({
        lang: document.documentElement.lang,
        placeholder: document.getElementById('search-input').placeholder,
        greeting: document.getElementById('greeting').textContent,
        timer: document.getElementById('timer-toggle').textContent,
        account: document.querySelector('.account-pick').textContent,
        missing: [...document.querySelectorAll('[data-i18n]')].filter((n) => n.textContent === n.dataset.i18n).length,
        visible: getComputedStyle(document.querySelector('.page')).visibility,
      })`);
    const english = await read();
    // A reset goes back to the browser language (Italian here) and must reload the page too.
    await a.eval(`window.confirm = () => true; ${settings(`document.getElementById('reset-data').click()`)}`);
    await sleep(800);
    const auto = await read();
    assert.equal(before, 'it');
    assert.deepEqual(
      { ...english, greeting: /^Good /.test(english.greeting) },
      {
        lang: 'en',
        placeholder: 'Search or type a URL',
        greeting: true,
        timer: 'Start',
        account: '1st',
        missing: 0,
        visible: 'visible',
      },
    );
    assert.deepEqual(
      { lang: auto.lang, placeholder: auto.placeholder, account: auto.account, missing: auto.missing },
      { lang: 'it', placeholder: 'Cerca o inserisci un URL', account: '1°', missing: 0 },
    );
  });

  await check('narrow window (420 px): no horizontal scroll', async () => {
    await a.resize(420, 860);
    await sleep(300);
    const r = await a.eval(
      `({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })`,
    );
    await a.resize(1440, 900);
    assert.ok(r.scroll <= r.client, JSON.stringify(r));
  });
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (browser.problems.length) console.log(`\nConsole errors or warnings:\n${browser.problems.join('\n')}`);
process.exitCode = failed.length || browser.problems.length ? 1 : 0;
