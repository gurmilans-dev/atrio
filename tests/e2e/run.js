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
// Saving is asynchronous (js/store.js commits under a cross-tab lock): before each step the checks
// wait for the changes already made to be saved, with the page's own store.
function settled(page) {
  const evaluate = page.eval.bind(page);
  page.eval = async (expression) => {
    await evaluate(`import('./js/store.js').then((store) => store.flush()).catch(() => {})`);
    return evaluate(expression);
  };
  return page;
}
const a = settled(await browser.openPage());

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
      { links: 6, engines: 4, tips: 19, clock: true, saved: true },
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
    // Separate steps: each read of the saved state waits for the clicks before it to be saved.
    await a.eval(`(() => {
      document.getElementById('timer-toggle').click();
      document.getElementById('settings').showModal();
      document.querySelector('[data-preset="50"]').click();
    })()`);
    const during = await a.eval(STATE);
    await a.eval(`document.getElementById('timer-reset').click()`);
    const reset = await a.eval(`${STATE}.timer.total`);
    await a.eval(`(() => {
      document.querySelector('[data-preset="25"]').click();
      document.getElementById('settings').close();
    })()`);
    const r = { preset: during.preset, total: during.timer.total, running: during.timer.running, reset };
    assert.deepEqual(r, { preset: 50, total: 300, running: true, reset: 600 });
  });

  await check('themes recolor the whole interface', async () => {
    const colors = new Set();
    for (const theme of ['mocha', 'matrix', 'light', 'tokyo']) {
      await a.eval(settings(`document.querySelector('[data-theme-choice="${theme}"]').click()`));
      colors.add(await a.eval(`getComputedStyle(document.querySelector('.link-icon')).borderColor`));
    }
    assert.equal(colors.size, 4);
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
      return { edited, moved, toastInDialog, undone };
    })()`);
    r.last = await a.eval(`${STATE}.links.at(-1).url`);
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
      const id = ${STATE}.customImages[0];
      const blob = await new Promise((resolve) => { const q = db.transaction('images').objectStore('images').get(id); q.onsuccess = () => resolve(q.result); });
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
      return { app: payload.app, images: payload.wallpaperImages?.length, timer: 'timer' in payload.state, afterReset, tasks: s.tasks.length, wallpaper: s.wallpaper, own: s.customImages.length };
    })()`);
    assert.deepEqual(r, {
      app: 'atrio',
      images: 1,
      timer: false,
      afterReset: 0,
      tasks: 2,
      wallpaper: 'custom',
      own: 1,
    });
  });

  // Reads the saved state, the stored image ids and the toast, as they are in the page.
  const snapshot = `(async () => {
    const db = await new Promise((resolve) => { const q = indexedDB.open('workspace-wallpaper', 1); q.onsuccess = () => resolve(q.result); });
    const ids = await new Promise((resolve) => { const q = db.transaction('images').objectStore('images').getAllKeys(); q.onsuccess = () => resolve(q.result.sort()); });
    db.close();
    return { saved: localStorage.getItem('workspace.newtab.v2'), ids, toast: document.getElementById('toast').textContent };
  })()`;

  await check('a restore that cannot be saved (storage really full) keeps data and images', async () => {
    const before = await a.eval(snapshot);
    const after = await a.eval(`(async () => {
      const canvas = new OffscreenCanvas(64, 40);
      canvas.getContext('2d').fillRect(0, 0, 64, 40);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const image = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
      const backup = {
        app: 'atrio',
        state: { links: [], tasks: [{ text: 'from the backup' }], notes: 'n'.repeat(10000), wallpaper: 'custom', customImages: ['img-new'] },
        wallpaperImages: [{ id: 'img-new', image }],
      };
      // Fill localStorage for real, chunk by chunk, until it refuses.
      const fillers = [];
      for (const size of [1 << 20, 1 << 16, 1 << 12, 1 << 8, 16]) {
        for (;;) {
          try { localStorage.setItem('filler-' + fillers.length, 'x'.repeat(size)); fillers.push('filler-' + fillers.length); } catch { break; }
        }
      }
      window.confirm = () => true;
      const transfer = new DataTransfer();
      transfer.items.add(new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }));
      const input = document.getElementById('import-file');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      const toast = document.getElementById('toast');
      for (let i = 0; i < 100 && !toast.textContent.startsWith('Backup non importato'); i++) await new Promise((r) => setTimeout(r, 50));
      const result = await ${snapshot};
      for (const key of fillers) localStorage.removeItem(key);
      return result;
    })()`);
    assert.equal(after.saved, before.saved); // the previous state, untouched
    assert.deepEqual(after.ids, before.ids); // previous images kept, the backup's removed
    assert.equal(
      after.toast,
      'Backup non importato: lo spazio di archiviazione è pieno o bloccato. I tuoi dati sono rimasti com’erano.',
    );
    assert.ok(before.ids.length > 0);
  });

  await check('a reset that cannot be saved deletes nothing', async () => {
    const before = await a.eval(snapshot);
    const after = await a.eval(`(async () => {
      // A controlled write error on the state key only.
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'workspace.newtab.v2') throw new DOMException('blocked', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
      window.confirm = () => true;
      document.getElementById('settings').showModal();
      document.getElementById('reset-data').click();
      const toast = document.getElementById('toast');
      for (let i = 0; i < 100 && !toast.textContent.startsWith('Ripristino non riuscito'); i++) await new Promise((r) => setTimeout(r, 50));
      Storage.prototype.setItem = setItem;
      document.getElementById('settings').close();
      return ${snapshot};
    })()`);
    await a.goto();
    const reloaded = await a.eval(`${STATE}.tasks.length`);
    assert.equal(after.saved, before.saved);
    assert.deepEqual(after.ids, before.ids);
    assert.equal(
      after.toast,
      'Ripristino non riuscito: lo spazio di archiviazione è bloccato. Non è stato cancellato nulla.',
    );
    assert.equal(reloaded, JSON.parse(before.saved).tasks.length);
  });

  await check('several open tabs never overwrite each other', async () => {
    const b = settled(await browser.openPage());
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
      accent = await a.eval(`${STATE}.autoAccents.workstation ?? null`);
    }
    await a.eval(`document.getElementById('settings').close()`);
    await a.goto();
    const boot = await a.eval(`document.documentElement.style.getPropertyValue('--accent')`);
    await a.eval(settings(`document.querySelector('[data-theme-choice="tokyo"]').click()`));
    const reset = await a.eval(`document.documentElement.style.getPropertyValue('--accent')`);
    assert.match(String(accent), /^#[0-9a-f]{6}$/);
    assert.deepEqual({ boot, reset }, { boot: accent, reset: '' });
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

  await check('notes that storage cannot hold (really full) say so, keep the draft, save later', async () => {
    const r = await a.eval(`(async () => {
      const store = await import('./js/store.js');
      const area = document.getElementById('notes-input');
      const saved = () => JSON.parse(localStorage.getItem('workspace.newtab.v2')).notes;
      const status = () => ({
        text: document.getElementById('notes-status').textContent,
        retry: !document.getElementById('notes-retry').hidden,
      });
      const until = async (text) => {
        for (let i = 0; i < 100 && status().text !== text; i++) await new Promise((r) => setTimeout(r, 50));
        return status();
      };
      const fillers = [];
      const fill = () => {
        for (const size of [1 << 20, 1 << 16, 1 << 12, 1 << 8, 16]) {
          for (;;) {
            try { localStorage.setItem('filler-' + fillers.length, 'x'.repeat(size)); fillers.push('filler-' + fillers.length); } catch { break; }
          }
        }
      };
      const free = () => { for (const key of fillers.splice(0)) localStorage.removeItem(key); };
      const type = (text) => { area.value = text; area.dispatchEvent(new Event('input')); };
      const before = saved();
      document.getElementById('tab-notes').click();
      await store.flush();
      area.focus(); // typing, as a person would

      fill();
      type('n'.repeat(8000));
      const failed = await until('non salvate');
      const kept = { saved: saved(), draft: area.value.length };
      free();
      document.getElementById('notes-retry').click();
      const retried = { ...(await until('salvate')), saved: saved().length };

      // Longer, so not saved again; then saved along with another change of the page.
      fill();
      type('n'.repeat(9999) + 'y');
      const again = await until('non salvate');
      free();
      await store.update(() => {});
      const along = { ...status(), saved: saved().endsWith('y') };

      type(before);
      area.blur();
      await until('salvate');
      document.getElementById('tab-tasks').click();
      return { before, failed, kept, retried, again, along, restored: saved() };
    })()`);
    assert.deepEqual(
      { ...r, before: undefined },
      {
        before: undefined,
        failed: { text: 'non salvate', retry: true },
        kept: { saved: r.before, draft: 8000 },
        retried: { text: 'salvate', retry: false, saved: 8000 },
        again: { text: 'non salvate', retry: true },
        along: { text: 'salvate', retry: false, saved: true },
        restored: r.before,
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

  await check('more developer tools: json, case, http, cron', async () => {
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
      cron: await firstRow('*/15 9-18 * * 1-5'),
    };
    await a.press('Escape');
    await a.eval(clearSearch);
    assert.deepEqual(results, {
      json: { label: '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}', hint: '⧉ JSON' },
      jsonError: { label: 'JSON non valido al carattere 8, vicino a “{"a":1,}”', hint: '⧉ JSON' },
      case: { label: 'userProfileId', hint: '⧉ Stile dei nomi' },
      http: { label: '404 Not Found', hint: '⧉ Codici HTTP' },
      cron: { label: 'Ogni 15 minuti, ore 9–18, di lunedì–venerdì', hint: '⧉ Cron' },
    });
  });

  await check('local tools never become web searches by accident (Esc, the → button, blur)', async () => {
    await a.trackNavigations();
    const token = 'eyJhbGciOiJub25lIn0.eyJzZWNyZXQiOiJub3QtYS1yZWFsLXRva2VuIn0.signature';
    const inputs = [token, 'json {"api_key":"x"}', '{"api_key":"x"}', 'b64 segreto', '= 2+2'];
    const reopened = [];
    for (const text of inputs) {
      await a.eval(clearSearch);
      await blur();
      await a.press('/');
      await a.type(text);
      await a.press('Escape'); // closes the list, keeps the text
      await a.press('Enter');
      reopened.push(await a.eval(`!document.getElementById('search-results').hidden`));
      await a.press('Escape');
      await a.click('.go'); // the box loses focus on mousedown, then the form submits
      await a.eval(`document.getElementById('search-input').blur()`);
      await a.eval(`document.getElementById('search-form').requestSubmit()`);
    }
    const accidental = a.navigations.splice(0);
    // Shift+Enter is an explicit search: it goes out, but a token is never remembered.
    await a.eval(clearSearch);
    await blur();
    await a.press('/');
    await a.type(token);
    await a.press('Enter', { shift: true });
    await sleep(400);
    const forced = a.navigations.splice(0);
    await a.goto();
    const recent = await a.eval(`${STATE}.recent`);
    // A plain search still goes out with Enter (with no list open, Esc would leave the field).
    await blur();
    await a.press('/');
    await a.type('react hooks');
    await a.press('Enter');
    await sleep(400);
    const plain = a.navigations.splice(0);
    await a.goto();
    await a.eval(settings(`document.getElementById('clear-recent').click()`)); // leave no trace for later checks
    assert.deepEqual(accidental, []);
    assert.deepEqual(reopened, [true, true, true, true, true]);
    assert.equal(forced.length, 1);
    assert.ok(forced[0].includes(encodeURIComponent(token)), forced[0]);
    assert.ok(!recent.some((item) => inputs.includes(item)), JSON.stringify(recent));
    assert.equal(plain.length, 1);
    assert.ok(plain[0].includes('react%20hooks'), plain[0]);
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
        `const s = document.getElementById('search-engine'); s.value = 'chrome'; s.dispatchEvent(new Event('change'))`,
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
    const chooseEngine = (engine) =>
      a.eval(
        settings(
          `const s = document.getElementById('search-engine'); s.value = '${engine}'; s.dispatchEvent(new Event('change'))`,
        ),
      );
    // With Chrome's own engine (the default) the switch is off limits: Atrio does not know its provider.
    const disabledForChrome = await a.eval(`document.getElementById('suggest-toggle').disabled`);
    await chooseEngine('google');
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
    await chooseEngine('chrome');
    assert.deepEqual(
      {
        off: off.includes('react hooks'),
        requestsOff,
        on: on.slice(0, 4),
        requests: requests.length,
        url: requests[0]?.url,
        credentials: requests[0]?.credentials,
        prefixed: prefixed.includes('react hooks'),
        disabledForChrome,
      },
      {
        off: false,
        requestsOff: 0,
        on: ['rea', 'react', 'react hooks', 'readme'],
        requests: 1,
        url: 'https://suggestqueries.google.com/complete/search?client=chrome&ie=utf-8&oe=utf-8&hl=it&q=rea',
        credentials: 'omit',
        prefixed: false,
        disabledForChrome: true,
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

  await check('custom timer durations: chosen, clamped, used by both modes', async () => {
    const read = () =>
      a.eval(`({
        timer: document.getElementById('timer').textContent,
        caption: document.getElementById('preset-caption').textContent,
        fields: document.getElementById('custom-preset').hidden ? null : [
          document.getElementById('custom-focus').value,
          document.getElementById('custom-break').value,
        ],
      })`);
    const setMinutes = (key, value) =>
      a.eval(
        settings(`
          const input = document.getElementById('custom-${key}');
          input.value = '${value}';
          input.dispatchEvent(new Event('change'));`),
      );
    await a.eval(`document.getElementById('focus-mode').click()`); // earlier checks may leave the break ready
    await a.eval(settings(`document.querySelector('[data-preset="custom"]').click()`));
    const chosen = await read();
    await setMinutes('focus', 90);
    await setMinutes('break', 15);
    const set = await read();
    await setMinutes('focus', 999);
    const clamped = await read();
    await a.eval(`document.getElementById('break-mode').click()`);
    const breakMode = await read();
    await a.eval(`document.getElementById('focus-mode').click()`);
    await a.eval(settings(`document.querySelector('[data-preset="25"]').click()`));
    const back = await read();
    assert.deepEqual(
      { chosen, set, clamped, breakMode, back },
      {
        chosen: { timer: '45:00', caption: '45 / 10', fields: ['45', '10'] },
        set: { timer: '90:00', caption: '90 / 15', fields: ['90', '15'] },
        clamped: { timer: '180:00', caption: '180 / 15', fields: ['180', '15'] },
        breakMode: { timer: '15:00', caption: '180 / 15', fields: ['180', '15'] },
        back: { timer: '25:00', caption: '25 / 5', fields: null },
      },
    );
  });

  await check('own wallpapers: several images, rotation per tab and per day, removal', async () => {
    const upload = (color) =>
      a.eval(`(async () => {
        const before = ${STATE}.customImages.length;
        const canvas = new OffscreenCanvas(320, 200);
        const context = canvas.getContext('2d');
        context.fillStyle = '${color}';
        context.fillRect(0, 0, 320, 200);
        const png = await canvas.convertToBlob({ type: 'image/png' });
        const transfer = new DataTransfer();
        transfer.items.add(new File([png], 'image.png', { type: 'image/png' }));
        const input = document.getElementById('wallpaper-upload');
        input.files = transfer.files;
        input.dispatchEvent(new Event('change'));
        for (let i = 0; i < 50 && ${STATE}.customImages.length === before; i++) await new Promise((r) => setTimeout(r, 100));
      })()`);
    const read = () =>
      a.eval(`({
        images: ${STATE}.customImages,
        shown: document.documentElement.dataset.customImage,
        counter: Number(document.documentElement.dataset.rotation) || 0,
        tiles: document.querySelectorAll('#wallpaper-picks [data-image]').length,
        rotationEnabled: !document.getElementById('rotation-select').disabled,
      })`);
    const setRotation = (value) =>
      a.eval(
        settings(`
          const select = document.getElementById('rotation-select');
          select.value = '${value}';
          select.dispatchEvent(new Event('change'));`),
      );
    await upload('#c0392b');
    await upload('#27ae60');
    const three = await read();
    await setRotation('tab');
    await a.goto();
    const firstTab = await read();
    await a.goto();
    const secondTab = await read();
    await setRotation('daily');
    await a.goto();
    const daily = await read();
    const day = await a.eval('Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000)');
    await setRotation('off');
    await a.eval(settings(`document.querySelector('#wallpaper-picks [data-image]').click()`));
    await a.eval(settings(`document.getElementById('remove-wallpaper').click()`));
    await sleep(300);
    const removed = await read();
    await a.eval(settings(`document.querySelector('[data-wallpaper="workstation"]').click()`));
    const at = (images, step) => images[step % images.length];
    assert.equal(three.images.length, 3);
    assert.deepEqual([three.tiles, three.rotationEnabled], [3, true]);
    assert.equal(secondTab.counter, firstTab.counter + 1);
    assert.equal(firstTab.shown, at(three.images, firstTab.counter));
    assert.equal(secondTab.shown, at(three.images, secondTab.counter));
    assert.notEqual(secondTab.shown, firstTab.shown); // every new tab shows the next image
    assert.equal(daily.shown, at(three.images, day));
    assert.deepEqual([removed.images.length, removed.tiles], [2, 2]);
    assert.ok(!removed.images.includes(three.images[0]));
  });

  await check('custom CSS: applied before paint, never to the settings, a stray brace refused', async () => {
    const applyCSS = (css) =>
      a.eval(
        settings(`
          document.getElementById('css-input').value = ${JSON.stringify(css)};
          document.getElementById('css-apply').click();`),
      );
    const read = () =>
      a.eval(`(() => {
        const dialog = document.getElementById('settings');
        dialog.showModal();
        const result = {
          clock: getComputedStyle(document.getElementById('clock')).color,
          body: getComputedStyle(document.body).display,
          settings: getComputedStyle(dialog).display !== 'none',
          saved: ${STATE}.customCSS,
          status: document.getElementById('css-status').textContent,
          toast: document.getElementById('toast').textContent,
        };
        dialog.close();
        return result;
      })()`);
    const hostile = '.clock { color: rgb(255, 0, 0) } #settings { display: none } body { display: none }';
    await applyCSS(hostile);
    const applied = await read();
    await applyCSS('.clock { color: rgb(0, 0, 255) } } .page { display: none }');
    const refused = await read();
    await a.goto();
    const beforeModules = await a.eval(
      `document.getElementById('custom-css')?.textContent.includes('rgb(255, 0, 0)')`,
    );
    const reloaded = await read();
    await a.eval(settings(`document.getElementById('css-clear').click()`));
    const cleared = await read();
    assert.deepEqual(
      [applied.clock, applied.body, applied.settings, applied.status],
      ['rgb(255, 0, 0)', 'block', true, '3 regole attive.'],
    );
    assert.deepEqual(
      [refused.saved, refused.clock, refused.toast],
      [hostile, 'rgb(255, 0, 0)', 'C’è una parentesi graffa chiusa di troppo: il CSS non è applicato.'],
    );
    assert.deepEqual([beforeModules, reloaded.clock, reloaded.settings], [true, 'rgb(255, 0, 0)', true]);
    assert.notEqual(cleared.clock, 'rgb(255, 0, 0)');
    assert.deepEqual([cleared.saved, cleared.status], ['', 'Nessuna regola attiva.']);
  });

  await check(
    'custom CSS never hides the settings or their button (:scope, overlays, global at-rules, boot)',
    async () => {
      const applyCSS = (css) =>
        a.eval(
          settings(`
          document.getElementById('css-input').value = ${JSON.stringify(css)};
          document.getElementById('css-apply').click();`),
        );
      const read = () =>
        a.eval(`(() => {
        const fab = document.getElementById('open-settings');
        const box = fab.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        const dialog = document.getElementById('settings');
        dialog.showModal();
        const drawer = dialog.getBoundingClientRect();
        const result = {
          area: getComputedStyle(document.querySelector('.customizable')).display,
          body: getComputedStyle(document.body).display,
          fabOnTop: hit === fab || fab.contains(hit),
          drawer: drawer.width > 300 && drawer.height > 300,
          title: getComputedStyle(document.getElementById('settings-title')).color !== 'rgba(0, 0, 0, 0)',
          saved: ${STATE}.customCSS,
          status: document.getElementById('css-status').textContent,
          toast: document.getElementById('toast').textContent,
        };
        dialog.close();
        return result;
      })()`);
      const opensByClick = async () => {
        await a.click('#open-settings');
        const open = await a.eval(`document.getElementById('settings').open`);
        await a.eval(`document.getElementById('settings').close()`);
        return open;
      };

      // The audit's case: the scope root itself.
      await applyCSS(':scope { display: none !important }');
      const hidden = { ...(await read()), click: await opensByClick() };
      // The whole page pulled over the button.
      const overlay =
        ':scope { position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; background: red !important }' +
        ' .page::after { content: ""; position: fixed; inset: 0; z-index: 2147483647 }';
      await applyCSS(overlay);
      const covered = { ...(await read()), click: await opensByClick() };
      // A global at-rule, even nested: refused, the previous CSS stays.
      await applyCSS(
        '@media all { @property --text { syntax: "<color>"; inherits: false; initial-value: transparent } } .clock { color: red }',
      );
      const property = await read();

      // Before the first paint (boot.js), with what a backup can bring: the style it adds, if any.
      const { identifier } = await a.call('Page.addScriptToEvaluateOnNewDocument', {
        source: `window.bootCSS = [];
        new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) if (node.id === 'custom-css') window.bootCSS.push(node.textContent);
          }
        }).observe(document, { childList: true, subtree: true });`,
      });
      const bootWith = async (css) => {
        await a.eval(`(() => {
        const saved = ${STATE};
        saved.customCSS = ${JSON.stringify(css)};
        localStorage.setItem('workspace.newtab.v2', JSON.stringify(saved));
      })()`);
        await a.goto();
        return a.eval('({ boot: window.bootCSS })');
      };
      const bootValid = await bootWith('.clock { color: rgb(1, 2, 3) }');
      const bootFont = await bootWith(
        '@font-face { font-family: Inter; src: url(data:font/woff2;base64,AAAA) } .clock { color: red }',
      );
      const bootFontState = await read();
      await a.call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      await a.goto();
      await a.eval(settings(`document.getElementById('css-clear').click()`));

      const reachable = { body: 'block', fabOnTop: true, drawer: true, title: true, click: true };
      assert.deepEqual(
        { ...hidden, saved: undefined, toast: undefined },
        { ...reachable, area: 'none', saved: undefined, status: '1 regola attiva.', toast: undefined },
      );
      assert.deepEqual(
        { ...covered, saved: undefined, toast: undefined, area: undefined },
        { ...reachable, area: undefined, saved: undefined, status: '2 regole attive.', toast: undefined },
      );
      assert.deepEqual(
        [property.saved, property.title, property.toast],
        [overlay, true, '@property varrebbe anche per le impostazioni: il CSS non è applicato.'],
      );
      assert.deepEqual(bootValid.boot, ['@scope (.customizable) {\n.clock { color: rgb(1, 2, 3) }\n}']);
      assert.deepEqual(bootFont.boot, []); // nor added later by js/appearance.js
      assert.deepEqual(
        [bootFontState.status, bootFontState.title, bootFontState.fabOnTop],
        ['@font-face varrebbe anche per le impostazioni: il CSS non è applicato.', true, true],
      );
    },
  );

  await check('clock options: 12-hour with AM/PM, seconds ticking, date hidden', async () => {
    const read = () =>
      a.eval(`({
        text: document.getElementById('clock').textContent,
        seconds: document.querySelector('.clock-seconds').hidden ? null : document.querySelector('.clock-seconds').textContent,
        period: document.querySelector('.clock-period').hidden ? null : document.querySelector('.clock-period').textContent,
        date: getComputedStyle(document.getElementById('date-label')).display,
      })`);
    const before = await read();
    await a.eval(
      settings(`
        const format = document.getElementById('clock-format');
        format.value = '12';
        format.dispatchEvent(new Event('change'));
        document.getElementById('seconds-toggle').click();
        document.querySelector('[data-show="date"]').click();`),
    );
    const first = await read();
    await sleep(1100);
    const second = await read();
    await a.eval(
      settings(`
        const format = document.getElementById('clock-format');
        format.value = '24';
        format.dispatchEvent(new Event('change'));
        document.getElementById('seconds-toggle').click();
        document.querySelector('[data-show="date"]').click();`),
    );
    const restored = await read();
    const hour = new Date().getHours();
    assert.match(before.text, /^\d{2}:\d{2}$/);
    assert.deepEqual([before.seconds, before.period, before.date], [null, null, 'block']);
    assert.match(first.text, /^\d{1,2}:\d{2}:\d{2}(AM|PM)$/);
    assert.match(first.seconds, /^:\d{2}$/);
    assert.equal(first.period, hour < 12 ? 'AM' : 'PM');
    assert.equal(first.date, 'none');
    assert.notEqual(second.seconds, first.seconds); // ticks every second
    assert.deepEqual([restored.seconds, restored.period, restored.date], [null, null, 'block']);
    assert.match(restored.text, /^\d{2}:\d{2}$/);
  });

  await check('custom accent: picked, made readable, live preview, applied before paint', async () => {
    const before = await a.eval(`document.getElementById('accent-row').hidden`);
    await a.eval(settings(`document.querySelector('[data-theme-choice="custom"]').click()`));
    const rowShown = await a.eval(`!document.getElementById('accent-row').hidden`);
    const accent = () =>
      a.eval(`getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`);
    await a.eval(
      settings(`
        const input = document.getElementById('accent-input');
        input.value = '#003366';
        input.dispatchEvent(new Event('input'));`),
    );
    const preview = await accent();
    const savedBeforeChange = await a.eval(`${STATE}.customAccent.picked`);
    await a.eval(settings(`document.getElementById('accent-input').dispatchEvent(new Event('change'))`));
    const saved = await a.eval(`${STATE}.customAccent`);
    await a.goto();
    const afterReload = await a.eval(`({
      theme: document.documentElement.dataset.theme,
      inline: document.documentElement.style.getPropertyValue('--accent'),
    })`);
    await a.eval(settings(`document.querySelector('[data-theme-choice="tokyo"]').click()`));
    const back = await accent();
    assert.deepEqual(
      { before, rowShown, preview, savedBeforeChange, saved, afterReload, back },
      {
        before: true,
        rowShown: true,
        preview: saved.color,
        savedBeforeChange: '#7aa2f7',
        saved: { picked: '#003366', color: saved.color },
        afterReload: { theme: 'custom', inline: saved.color },
        back: '#7aa2f7',
      },
    );
    assert.notEqual(saved.color, '#003366'); // too dark for the dark theme: lifted
  });

  await check(
    'page parts: hidden from the settings, one column, inactive shortcuts, before paint',
    async () => {
      const toggle = (section) =>
        a.eval(settings(`document.querySelector('[data-show="${section}"]').click()`));
      for (const section of ['focus', 'tasks', 'greeting']) await toggle(section);
      const read = () =>
        a.eval(`({
        side: getComputedStyle(document.querySelector('.side')).display,
        columns: getComputedStyle(document.querySelector('.layout')).gridTemplateColumns.split(' ').length,
        greeting: getComputedStyle(document.getElementById('greeting')).display,
        clock: getComputedStyle(document.getElementById('clock')).display,
        heatmapSwitch: document.querySelector('[data-show="heatmap"]').disabled,
      })`);
      const hidden = await read();
      await blur();
      await a.press('t');
      const focusedAfterT = await a.eval('document.activeElement.id');
      await a.press('>');
      const commands = await a.eval(labels('#search-results .result-label'));
      await a.press('Escape');
      await a.eval(clearSearch);
      // boot.js must apply it before the modules run: read the attributes as soon as the page starts.
      await a.goto();
      const afterReload = await a.eval(
        `['focus', 'tasks', 'greeting'].map((section) => document.documentElement.hasAttribute('data-hide-' + section))`,
      );
      for (const section of ['focus', 'tasks', 'greeting']) await toggle(section);
      const restored = await read();
      assert.deepEqual(
        {
          hidden,
          focusedAfterT,
          timerCommand: commands.some((label) => /timer/i.test(label)),
          newTask: commands.includes('Nuova attività'),
          settings: commands.includes('Impostazioni'),
          afterReload,
          restored,
        },
        {
          hidden: { side: 'none', columns: 1, greeting: 'none', clock: 'block', heatmapSwitch: true },
          focusedAfterT: '',
          timerCommand: false,
          newTask: false,
          settings: true,
          afterReload: [true, true, true],
          restored: { side: 'grid', columns: 2, greeting: 'block', clock: 'block', heatmapSwitch: false },
        },
      );
    },
  );

  await check('two documents adding a task in the same JavaScript task both keep it', async () => {
    const r = await a.eval(`(async () => {
      // Two more Atrio documents on the same origin: same storage, same locks, separate copies.
      const frames = await Promise.all(['A', 'B'].map(() => new Promise((resolve) => {
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position: fixed; left: -2000px; width: 900px; height: 700px';
        frame.onload = () => resolve(frame);
        frame.src = 'index.html';
        document.body.append(frame);
      })));
      // One task: each document changes its copy before it can see the other's write.
      frames.forEach((frame, index) => {
        const doc = frame.contentDocument;
        doc.getElementById('task-input').value = 'concurrent ' + 'AB'[index];
        doc.getElementById('task-form').requestSubmit();
      });
      await Promise.all(frames.map((frame) => frame.contentWindow.eval("import('./js/store.js').then((s) => s.flush())")));
      const saved = JSON.parse(localStorage.getItem('workspace.newtab.v2')).tasks.map((task) => task.text);
      frames.forEach((frame) => frame.remove());
      return saved;
    })()`);
    await a.goto();
    const shown = await a.eval(labels('#task-list .task-label'));
    for (const text of ['concurrent A', 'concurrent B']) {
      assert.ok(r.includes(text), `${text} not saved: ${JSON.stringify(r)}`);
      assert.ok(shown.includes(text), `${text} not shown after reload: ${JSON.stringify(shown)}`);
    }
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

  // ---------- Interface modes ----------
  const beforeModes = await a.eval(`localStorage.getItem('workspace.newtab.v2')`);
  const setLayout = async (layout) => {
    await a.eval(settings(`document.querySelector('input[name=layout][value=${layout}]').click()`));
  };

  await check(
    'interface mode: Developer by default, Minimal from the settings, applied before the first paint',
    async () => {
      const before = await a.eval(
        `({ saved: ${STATE}.layout, root: document.documentElement.dataset.layout })`,
      );
      await setLayout('minimal');
      const switched = await a.eval(
        `({ saved: ${STATE}.layout, root: document.documentElement.dataset.layout })`,
      );
      // What boot.js applied, before the modules run (readyState "interactive" comes first).
      const { identifier } = await a.call('Page.addScriptToEvaluateOnNewDocument', {
        source: `document.addEventListener('readystatechange', () => {
        if (document.readyState !== 'interactive') return;
        window.atBoot = {
          layout: document.documentElement.dataset.layout,
          side: getComputedStyle(document.querySelector('.side')).display,
          modules: document.documentElement.hasAttribute('data-ready'),
        };
      });`,
      });
      await a.goto();
      const atBoot = await a.eval('window.atBoot');
      await a.call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      const reloaded = await a.eval(
        `({ root: document.documentElement.dataset.layout, checked: document.querySelector('input[name=layout]:checked').value })`,
      );
      assert.deepEqual(
        { before, switched, atBoot, reloaded },
        {
          before: { saved: 'developer', root: 'developer' },
          switched: { saved: 'minimal', root: 'minimal' },
          atBoot: { layout: 'minimal', side: 'none', modules: false },
          reloaded: { root: 'minimal', checked: 'minimal' },
        },
      );
    },
  );

  await check(
    'Minimal: clock, date, search and links as icons, in this order; the panels hidden, their data kept',
    async () => {
      const r = await a.eval(`(() => {
      const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
      const box = (selector) => document.querySelector(selector).getBoundingClientRect();
      const first = document.querySelector('#links .shortcut');
      const clock = box('#clock');
      return {
        hidden: ['.side', '.greeting', '.links-header', '.search-tips'].map(display),
        order: [box('#clock').bottom <= box('#date-label').top, box('#date-label').bottom <= box('.search').top, box('.search').bottom <= box('#links').top],
        centered: Math.abs(clock.left + clock.width / 2 - innerWidth / 2) < 2,
        tile: Math.round(first.getBoundingClientRect().width),
        label: first.getAttribute('aria-label') === first.querySelector('.link-name').textContent,
        tooltip: getComputedStyle(first, '::after').content === JSON.stringify(first.querySelector('.link-name').textContent),
        title: first.hasAttribute('title'),
        info: getComputedStyle(first.querySelector('.link-info')).display,
        tasks: ${STATE}.tasks.length === document.querySelectorAll('#task-list li').length,
      };
    })()`);
      assert.deepEqual(r, {
        hidden: ['none', 'none', 'none', 'none'],
        order: [true, true, true],
        centered: true,
        tile: 52,
        label: true,
        tooltip: true,
        title: false,
        info: 'none',
        tasks: true,
      });
    },
  );

  await check(
    'Minimal: past eight links a "+n" tile opens the others, by mouse and keyboard; 1-9 still work',
    async () => {
      await a.eval(`import('./js/store.js').then((store) => store.update((state) => {
      state.links = Array.from({ length: 12 }, (_, i) => ({ id: 'mode-' + i, name: 'Sito ' + (i + 1), url: 'https://sito' + (i + 1) + '.example/' }));
    }))`);
      const shown = await a.eval(`({
      tiles: document.querySelectorAll('#links a.shortcut').length,
      more: document.querySelector('.link-more').textContent,
      label: document.querySelector('.link-more').getAttribute('aria-label'),
      rest: [...document.querySelectorAll('#links-more .more-name')].map((name) => name.textContent),
    })`);
      await a.click('.link-more');
      const opened = await a.eval(`document.getElementById('links-more').matches(':popover-open')`);
      await a.call('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
      await a.call('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
      const tabbed = await a.eval(
        `document.activeElement.closest('#links-more')?.querySelector('a') === document.activeElement`,
      );
      await a.press('Escape');
      const closed = await a.eval(
        `({ open: document.getElementById('links-more').matches(':popover-open'), focus: document.activeElement.classList.contains('link-more') })`,
      );
      await blur();
      await a.press('9');
      await sleep(300);
      const ninth = a.navigations.splice(0);
      await a.goto();
      assert.deepEqual(
        { shown, opened, tabbed, closed, ninth },
        {
          shown: {
            tiles: 8,
            more: '+4',
            label: 'Altri 4 collegamenti',
            rest: ['Sito 9', 'Sito 10', 'Sito 11', 'Sito 12'],
          },
          opened: true,
          tabbed: true,
          closed: { open: false, focus: true },
          ninth: ['https://sito9.example/'],
        },
      );
    },
  );

  await check(
    'Minimal: T, N and P open their panel over the page, Esc closes it; tasks and notes carry over to Developer',
    async () => {
      const read = () =>
        a.eval(`({
        sheet: document.documentElement.dataset.sheet ?? null,
        focus: document.activeElement.id || document.activeElement.tagName,
        visible: [...document.querySelectorAll('.side > .panel')].filter((panel) => panel.checkVisibility()).length,
      })`);
      await blur();
      await a.press('t');
      const tasks = await read();
      await a.type('Da Minimal');
      await a.press('Enter');
      await a.press('Escape');
      const closed = await read();
      await a.press('n');
      const notes = await read();
      await a.press('Escape');
      await a.press('p');
      const timer = { ...(await read()), running: await a.eval(`${STATE}.timer.running`) };
      await a.press('p');
      await a.click('#clock'); // a click elsewhere closes it too
      const clicked = await read();
      await setLayout('developer');
      const developer = await a.eval(`({
      task: ${labels('#task-list .task-label')}.includes('Da Minimal'),
      panels: [...document.querySelectorAll('.side > .panel')].filter((panel) => panel.checkVisibility()).length,
      running: ${STATE}.timer.running,
    })`);
      await a.eval(`import('./js/store.js').then((store) => store.update((state) => {
      state.tasks = state.tasks.filter((task) => task.text !== 'Da Minimal');
    }))`);
      await setLayout('minimal');
      assert.deepEqual(
        { tasks, closed, notes, timer, clicked, developer },
        {
          tasks: { sheet: 'tasks', focus: 'task-input', visible: 1 },
          closed: { sheet: null, focus: 'BODY', visible: 0 },
          notes: { sheet: 'tasks', focus: 'notes-input', visible: 1 },
          timer: { sheet: 'focus', focus: 'timer-toggle', visible: 1, running: true },
          clicked: { sheet: null, focus: 'BODY', visible: 0 },
          developer: { task: true, panels: 2, running: false },
        },
      );
    },
  );

  await check('Minimal: the search behaves as in Developer, and its list fits the window', async () => {
    await blur();
    await a.press('>');
    await a.type('modalità');
    await sleep(200);
    const command = await a.eval(
      `document.querySelector('#search-results .result.active .result-label')?.textContent`,
    );
    await a.eval(clearSearch);
    const token = 'eyJhbGciOiJub25lIn0.eyJzZWNyZXQiOiJub3QtYS1yZWFsLXRva2VuIn0.signature';
    await blur();
    await a.press('/');
    await a.type(token);
    await a.press('Escape');
    await a.press('Enter');
    const accidental = a.navigations.splice(0);
    const reopened = await a.eval(`!document.getElementById('search-results').hidden`);
    await a.press('Enter', { shift: true });
    await sleep(400);
    const forced = a.navigations.splice(0);
    await a.goto();
    await a.resize(1280, 720);
    await sleep(300);
    await blur();
    await a.press('>');
    await sleep(200);
    const fits = await a.eval(
      `document.getElementById('search-results').getBoundingClientRect().bottom <= innerHeight && document.documentElement.scrollHeight <= innerHeight`,
    );
    await a.press('Escape');
    await a.resize(1440, 900);
    assert.deepEqual(
      { command, accidental, reopened, forced: forced.length, fits },
      { command: 'Modalità: Developer', accidental: [], reopened: true, forced: 1, fits: true },
    );
  });

  await check(
    'Minimal: other tabs follow, backups carry it, themes recolor it, custom CSS cannot lock the settings',
    async () => {
      const b = settled(await browser.openPage());
      const inB = [await b.eval(`document.documentElement.dataset.layout`)];
      await setLayout('developer');
      await sleep(200);
      inB.push(await b.eval(`document.documentElement.dataset.layout`));
      await setLayout('minimal');
      await sleep(200);
      inB.push(await b.eval(`document.documentElement.dataset.layout`));
      await b.close();
      const exported = await a.eval(`(async () => {
      let href;
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { if (this.download) href = this.href; else click.call(this); };
      document.getElementById('export-data').click();
      for (let i = 0; i < 50 && !href; i++) await new Promise((resolve) => setTimeout(resolve, 100));
      HTMLAnchorElement.prototype.click = click;
      return JSON.parse(await (await fetch(href)).text()).state.layout;
    })()`);
      const colors = {};
      for (const theme of ['light', 'mocha', 'tokyo']) {
        await a.eval(
          `import('./js/store.js').then((store) => store.update((state) => { state.theme = '${theme}'; }))`,
        );
        colors[theme] = await a.eval(`getComputedStyle(document.getElementById('clock')).color`);
      }
      await a.eval(
        settings(`
        document.getElementById('css-input').value = ':scope { display: none !important }';
        document.getElementById('css-apply').click();`),
      );
      const reach = await a.eval(`(() => {
        const gear = document.getElementById('open-settings').getBoundingClientRect();
        const hit = document.elementFromPoint(gear.x + gear.width / 2, gear.y + gear.height / 2);
        return hit?.closest('#open-settings') !== null;
      })()`);
      await a.click('#open-settings');
      const settingsOpen = await a.eval(`document.getElementById('settings').open`);
      await a.eval(
        `document.getElementById('css-clear').click(); document.getElementById('settings').close()`,
      );
      assert.deepEqual(
        { inB, exported, colors, reach, settingsOpen },
        {
          inB: ['minimal', 'developer', 'minimal'],
          exported: 'minimal',
          colors: { light: 'rgb(20, 25, 39)', mocha: 'rgb(205, 214, 244)', tokyo: 'rgb(237, 242, 255)' },
          reach: true,
          settingsOpen: true,
        },
      );
    },
  );

  await check(
    'Minimal at 1920, 1366, 1280 × 720, 768 and 420 px: no overlap, no scroll, settings in reach',
    async () => {
      const problems = [];
      for (const [width, height] of [
        [1920, 1080],
        [1366, 768],
        [1280, 720],
        [768, 1024],
        [420, 860],
      ]) {
        await a.resize(width, height);
        await sleep(250);
        const r = await a.eval(`(() => {
        const box = (selector) => document.querySelector(selector).getBoundingClientRect();
        const gear = box('#open-settings');
        const hit = document.elementFromPoint(gear.x + gear.width / 2, gear.y + gear.height / 2);
        const tiles = [...document.querySelectorAll('#links > *')].map((tile) => tile.getBoundingClientRect());
        return {
          stacked: box('#clock').bottom <= box('#date-label').top && box('#date-label').bottom <= box('.search').top && box('.search').bottom <= box('#links').top,
          inside: tiles.every((tile) => tile.left >= 0 && tile.right <= innerWidth),
          scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          scrollY: document.documentElement.scrollHeight > innerHeight,
          gear: hit?.closest('#open-settings') !== null,
        };
      })()`);
        if (!r.stacked || !r.inside || r.scrollX || r.scrollY || !r.gear) {
          problems.push({ width, height, ...r });
        }
      }
      await a.resize(1440, 900);
      assert.deepEqual(problems, []);
    },
  );

  await a.eval(`localStorage.setItem('workspace.newtab.v2', ${JSON.stringify(beforeModes)})`);
  await a.goto();

  // ---------- Visual styles and wallpapers ----------
  const beforeStyles = await a.eval(`localStorage.getItem('workspace.newtab.v2')`);
  const setStyle = async (style) => {
    await a.eval(settings(`document.querySelector('input[name=visual-style][value=${style}]').click()`));
  };
  const setState = (code) =>
    a.eval(`import('./js/store.js').then((store) => store.update((state) => { ${code} }))`);
  // Blur and corner of a panel, a link card and the search box's glass layer.
  const surfaces = `(() => {
    const look = (selector, pseudo) => {
      const style = getComputedStyle(document.querySelector(selector), pseudo);
      return [style.backdropFilter, style.borderTopLeftRadius];
    };
    return { panel: look('.focus-panel'), link: look('#links .shortcut'), search: look('.search', '::before') };
  })()`;
  await setState(
    `state.layout = 'developer'; state.theme = 'tokyo'; state.show.focus = true; state.show.links = true;`,
  );

  await check(
    'visual style: Classic by default, Glass from the settings, applied before the first paint',
    async () => {
      const read = `({ saved: ${STATE}.visualStyle, root: document.documentElement.dataset.style, checked: document.querySelector('input[name=visual-style]:checked').value })`;
      const before = await a.eval(read);
      const classic = await a.eval(surfaces);
      await setStyle('glass');
      const switched = await a.eval(read);
      const glass = await a.eval(surfaces);
      // What boot.js applied, before the modules run.
      const { identifier } = await a.call('Page.addScriptToEvaluateOnNewDocument', {
        source: `document.addEventListener('readystatechange', () => {
        if (document.readyState !== 'interactive') return;
        window.atBoot = {
          style: document.documentElement.dataset.style,
          blur: getComputedStyle(document.querySelector('.focus-panel')).backdropFilter.startsWith('blur('),
          modules: document.documentElement.hasAttribute('data-ready'),
        };
      });`,
      });
      await a.goto();
      const atBoot = await a.eval('window.atBoot');
      await a.call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      const reloaded = await a.eval(read);
      assert.deepEqual(
        { before, switched, atBoot, reloaded },
        {
          before: { saved: 'classic', root: 'classic', checked: 'classic' },
          switched: { saved: 'glass', root: 'glass', checked: 'glass' },
          atBoot: { style: 'glass', blur: true, modules: false },
          reloaded: { saved: 'glass', root: 'glass', checked: 'glass' },
        },
      );
      // Classic draws as before: no blur, the original corners. Glass blurs, with softer ones.
      assert.deepEqual(classic, { panel: ['none', '14px'], link: ['none', '11px'], search: ['none', '0px'] });
      assert.deepEqual(
        Object.values(glass).map(([filter, radius]) => [filter.startsWith('blur('), radius]),
        [
          [true, '20px'],
          [true, '18px'],
          [true, '18px'],
        ],
      );
    },
  );

  await check(
    'visual style: other tabs follow, backups carry it, an older backup opens in Classic; nothing else changes',
    async () => {
      const b = settled(await browser.openPage());
      const inB = [await b.eval(`document.documentElement.dataset.style`)];
      await setStyle('classic');
      await sleep(200);
      inB.push(await b.eval(`document.documentElement.dataset.style`));
      await setStyle('glass');
      await sleep(200);
      inB.push(await b.eval(`document.documentElement.dataset.style`));
      await b.close();
      const rest = `(() => { const s = ${STATE}; delete s.visualStyle; return JSON.stringify(s); })()`;
      const before = await a.eval(rest);
      for (const style of ['classic', 'glass', 'classic', 'glass']) await setStyle(style);
      const unchanged = (await a.eval(rest)) === before;
      const exported = await a.eval(`(async () => {
      let href;
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { if (this.download) href = this.href; else click.call(this); };
      document.getElementById('export-data').click();
      for (let i = 0; i < 50 && !href; i++) await new Promise((resolve) => setTimeout(resolve, 100));
      HTMLAnchorElement.prototype.click = click;
      return JSON.parse(await (await fetch(href)).text()).state;
    })()`);
      // A backup from before the styles: no visualStyle, its own mode, theme and (new) wallpaper.
      const old = {
        ...exported,
        layout: 'minimal',
        theme: 'light',
        wallpaper: 'sunrise-lake',
        customImages: [],
      };
      delete old.visualStyle;
      const restored = await a.eval(`(async () => {
      window.confirm = () => true;
      const transfer = new DataTransfer();
      transfer.items.add(new File([${JSON.stringify(JSON.stringify({ app: 'atrio', state: old }))}], 'old.json', { type: 'application/json' }));
      const input = document.getElementById('import-file');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      for (let i = 0; i < 50 && ${STATE}.layout !== 'minimal'; i++) await new Promise((resolve) => setTimeout(resolve, 100));
      const s = ${STATE};
      const root = document.documentElement.dataset;
      return { saved: [s.visualStyle, s.layout, s.theme, s.wallpaper], root: [root.style, root.layout, root.theme, root.wallpaper] };
    })()`);
      assert.deepEqual(
        { inB, unchanged, exported: exported.visualStyle, restored },
        {
          inB: ['glass', 'classic', 'glass'],
          unchanged: true,
          exported: 'glass',
          restored: {
            saved: ['classic', 'minimal', 'light', 'sunrise-lake'],
            root: ['classic', 'minimal', 'light', 'sunrise-lake'],
          },
        },
      );
    },
  );

  await check(
    'the four new wallpapers: in the picker with their names, applied before the first paint, an accent for the automatic theme',
    async () => {
      const picker = await a.eval(`(async () => {
      const dialog = document.getElementById('settings');
      dialog.showModal();
      document.getElementById('wallpaper-picks').scrollIntoView();
      const images = [...document.querySelectorAll('#wallpaper-picks [data-wallpaper] img')];
      for (let i = 0; i < 50 && !images.every((image) => image.complete && image.naturalWidth); i++) await new Promise((resolve) => setTimeout(resolve, 100));
      const picks = [...document.querySelectorAll('#wallpaper-picks [data-wallpaper]')].map((pick) => [pick.dataset.wallpaper, pick.querySelector('.pick-label').textContent, pick.querySelector('img').naturalWidth]);
      document.querySelector('#wallpaper-picks [data-wallpaper="deep-space"]').click();
      const pressed = document.querySelector('#wallpaper-picks [data-wallpaper="deep-space"]').getAttribute('aria-pressed');
      dialog.close();
      return { picks, pressed };
    })()`);
      const { identifier } = await a.call('Page.addScriptToEvaluateOnNewDocument', {
        source: `document.addEventListener('readystatechange', () => {
        if (document.readyState !== 'interactive') return;
        window.atBoot = {
          wallpaper: document.documentElement.dataset.wallpaper,
          image: document.documentElement.style.getPropertyValue('--wallpaper'),
          modules: document.documentElement.hasAttribute('data-ready'),
        };
      });`,
      });
      await a.goto();
      const atBoot = await a.eval('window.atBoot');
      await a.call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      // The automatic theme: an accent computed from the image, saved for the next tabs.
      await setState(`state.theme = 'auto'; state.wallpaper = 'liquid-glass';`);
      const accent = await a.eval(`(async () => {
      for (let i = 0; i < 50 && !${STATE}.autoAccents['liquid-glass']; i++) await new Promise((resolve) => setTimeout(resolve, 100));
      return { saved: ${STATE}.autoAccents['liquid-glass'], applied: document.documentElement.style.getPropertyValue('--accent') };
    })()`);
      assert.deepEqual(picker, {
        picks: [
          ['workstation', 'Postazione', 1672],
          ['city', 'Città', 1672],
          ['deep-space', 'Spazio profondo', 1672],
          ['warm-sand', 'Sabbia calda', 1672],
          ['sunrise-lake', 'Lago all’alba', 1672],
          ['liquid-glass', 'Vetro liquido', 1672],
        ],
        pressed: 'true',
      });
      assert.deepEqual(atBoot, {
        wallpaper: 'deep-space',
        image: 'url("assets/deep-space.webp")',
        modules: false,
      });
      assert.match(accent.saved, /^#[0-9a-f]{6}$/);
      assert.equal(accent.applied, accent.saved);
    },
  );

  await check(
    'Glass in Developer and Minimal at 1920, 1366, 1280 × 720, 768 and 420 px: in order, settings in reach, even with custom CSS',
    async () => {
      await setState(`state.visualStyle = 'glass'; state.theme = 'tokyo'; state.wallpaper = 'warm-sand';`);
      const problems = [];
      for (const layout of ['developer', 'minimal']) {
        await setState(`state.layout = '${layout}';`);
        for (const [width, height] of [
          [1920, 1080],
          [1366, 768],
          [1280, 720],
          [768, 1024],
          [420, 860],
        ]) {
          await a.resize(width, height);
          await sleep(250);
          const r = await a.eval(`(() => {
          const box = (selector) => document.querySelector(selector).getBoundingClientRect();
          const gear = box('#open-settings');
          const hit = document.elementFromPoint(gear.x + gear.width / 2, gear.y + gear.height / 2);
          return {
            stacked: box('#clock').bottom <= box('.search').top && box('.search').bottom <= box('#links').top,
            scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            scrollY: ${layout === 'minimal'} && document.documentElement.scrollHeight > innerHeight,
            gear: hit?.closest('#open-settings') !== null,
          };
        })()`);
          if (!r.stacked || r.scrollX || r.scrollY || !r.gear) problems.push({ layout, width, height, ...r });
        }
      }
      await a.resize(1440, 900);
      await a.eval(
        settings(`
        document.getElementById('css-input').value = ':scope { display: none !important }';
        document.getElementById('css-apply').click();`),
      );
      const reach = await a.eval(`(() => {
        const gear = document.getElementById('open-settings').getBoundingClientRect();
        const hit = document.elementFromPoint(gear.x + gear.width / 2, gear.y + gear.height / 2);
        return hit?.closest('#open-settings') !== null;
      })()`);
      await a.click('#open-settings');
      const settingsOpen = await a.eval(`document.getElementById('settings').open`);
      await a.eval(
        `document.getElementById('css-clear').click(); document.getElementById('settings').close()`,
      );
      assert.deepEqual({ problems, reach, settingsOpen }, { problems: [], reach: true, settingsOpen: true });
    },
  );

  await check('less transparency or more contrast: Glass keeps Classic’s fills, without blur', async () => {
    await setState(`state.layout = 'developer'; state.visualStyle = 'classic';`);
    const look = `(() => { const s = getComputedStyle(document.querySelector('.focus-panel')); return [s.backgroundColor, s.backdropFilter]; })()`;
    const classic = await a.eval(look);
    await setState(`state.visualStyle = 'glass';`);
    const read = {};
    for (const [name, value] of [
      ['prefers-reduced-transparency', 'reduce'],
      ['prefers-contrast', 'more'],
    ]) {
      await a.call('Emulation.setEmulatedMedia', { features: [{ name, value }] });
      read[name] = await a.eval(look);
    }
    await a.call('Emulation.setEmulatedMedia', { features: [] });
    const glass = await a.eval(look);
    assert.deepEqual(read, {
      'prefers-reduced-transparency': [classic[0], 'none'],
      'prefers-contrast': [classic[0], 'none'],
    });
    assert.ok(glass[0] !== classic[0] && glass[1].startsWith('blur('), JSON.stringify(glass));
  });

  await a.eval(`localStorage.setItem('workspace.newtab.v2', ${JSON.stringify(beforeStyles)})`);
  await a.goto();

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
