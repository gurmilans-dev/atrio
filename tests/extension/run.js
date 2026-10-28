// Smoke checks in the real extension, loaded unpacked in headless Chrome or Edge: `npm run test:extension`
// (set CHROME_PATH to pick the browser). What the HTTP suite in tests/e2e cannot see: the manifest and
// its permissions, Chrome's Search API, the content security policy, alarms and the service worker.
// They also guard the fixes of docs/CHROME_WEB_STORE_FIX_SUMMARY.md that live there (ATR-01, 04, 09, 10).
import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WALLPAPERS } from '../../js/config.js';
import { launchExtension, sleep } from '../e2e/harness.js';

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

// Records every request it gets: nothing in the page may reach it.
const hits = [];
const server = http.createServer((request, response) => {
  hits.push(request.url);
  response.writeHead(204);
  response.end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const BEACON = `http://127.0.0.1:${server.address().port}`;

const ext = await launchExtension(ROOT);
const page = await ext.openPage();
// Saving is asynchronous (js/store.js): each step first waits for the changes already made.
const evaluate = page.eval.bind(page);
page.eval = async (expression) => {
  await evaluate(`import('./js/store.js').then((store) => store.flush())`);
  return evaluate(expression);
};
const search = async (text) => {
  await page.eval(`(() => {
    const input = document.getElementById('search-input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.focus();
  })()`);
  await page.type(text);
  await sleep(300);
};

try {
  await check('manifest: permissions, optional hosts and content security policy as declared', async () => {
    const r = await page.eval(`(async () => {
      const manifest = chrome.runtime.getManifest();
      return {
        permissions: manifest.permissions.sort(),
        hosts: manifest.host_permissions ?? [],
        optional: manifest.optional_host_permissions,
        csp: manifest.content_security_policy.extension_pages,
        granted: (await chrome.permissions.getAll()).origins,
        searchAPI: typeof chrome.search.query,
        ready: document.documentElement.hasAttribute('data-ready'),
      };
    })()`);
    assert.deepEqual(
      { ...r, csp: undefined },
      {
        permissions: ['alarms', 'favicon', 'notifications', 'search'],
        hosts: [],
        optional: ['https://suggestqueries.google.com/*', 'https://duckduckgo.com/*'],
        csp: undefined,
        granted: [],
        searchAPI: 'function',
        ready: true,
      },
    );
    for (const directive of [
      "script-src 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "media-src 'none'",
      "connect-src 'self' data: https://suggestqueries.google.com https://duckduckgo.com",
    ]) {
      assert.ok(r.csp.includes(directive), `CSP without ${directive}: ${r.csp}`);
    }
  });

  await page.trackNavigations(); // searches are recorded and aborted, never sent

  await check(
    "a plain search goes through Chrome's Search API, to the browser's own provider (ATR-01)",
    async () => {
      const engine = await page.eval(`${STATE}.engine`);
      // Spy on the API the page calls (the same chrome object as js/platform.js).
      await page.eval(`(() => {
      window.searchCalls = [];
      const query = chrome.search.query.bind(chrome.search);
      chrome.search.query = (options) => (window.searchCalls.push(options), query(options));
    })()`);
      await search('atrio extension smoke');
      await page.press('Enter');
      await sleep(1500);
      const calls = await evaluate('window.searchCalls');
      const sent = page.navigations.splice(0);
      await page.goto();
      assert.equal(engine, 'chrome');
      assert.deepEqual(calls, [{ text: 'atrio extension smoke', disposition: 'CURRENT_TAB' }]);
      assert.equal(sent.length, 1, JSON.stringify(sent));
      assert.match(sent[0], /atrio(\+|%20)extension(\+|%20)smoke/);
      return new URL(sent[0]).hostname;
    },
  );

  await check(
    'a JWT is never searched by accident: Esc then Enter brings its rows back (ATR-04)',
    async () => {
      const token = 'eyJhbGciOiJub25lIn0.eyJzZWNyZXQiOiJub3QtYS1yZWFsLXRva2VuIn0.signature';
      await search(token);
      await page.press('Escape');
      await page.press('Enter');
      await sleep(800);
      const accidental = page.navigations.splice(0);
      const rows = await page.eval(`!document.getElementById('search-results').hidden`);
      await page.press('Enter', { shift: true }); // the explicit way to search it
      await sleep(1500);
      const explicit = page.navigations.splice(0);
      await page.goto();
      assert.deepEqual(accidental, []);
      assert.equal(rows, true);
      assert.equal(explicit.length, 1, JSON.stringify(explicit));
    },
  );

  await check(
    'custom CSS cannot make the page contact a server; favicons and own wallpapers still load (ATR-10)',
    async () => {
      await page.eval(`localStorage.setItem('workspace.newtab.v2', JSON.stringify({
      ...${STATE}, links: [{ id: 'l1', name: 'GitHub', url: 'https://github.com/' }],
    }))`);
      await page.goto();
      const r = await page.eval(`(async () => {
      const blocked = [];
      document.addEventListener('securitypolicyviolation', (e) => blocked.push(e.effectiveDirective));
      const css = '.page { background-image: url(${BEACON}/background) } .clock { cursor: url(${BEACON}/cursor), auto }' +
        ' .greeting { border: 4px solid; border-image: url(${BEACON}/border) 4 } .layout { mask-image: url(${BEACON}/mask) }';
      const dialog = document.getElementById('settings');
      dialog.showModal();
      document.getElementById('css-input').value = css;
      document.getElementById('css-apply').click();
      dialog.close();
      await fetch('${BEACON}/fetch').catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const favicon = document.querySelector('img[src*="/_favicon/"]');

      // An own wallpaper from a backup: data: decoded with fetch, kept in IndexedDB, shown as blob:.
      const canvas = new OffscreenCanvas(64, 40);
      const context = canvas.getContext('2d');
      context.fillStyle = '#3366cc';
      context.fillRect(0, 0, 64, 40);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const image = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
      const backup = { app: 'atrio', state: { links: [], wallpaper: 'custom', customImages: ['w'], theme: 'auto' }, wallpaperImages: [{ id: 'w', image }] };
      window.confirm = () => true;
      const transfer = new DataTransfer();
      transfer.items.add(new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }));
      const input = document.getElementById('import-file');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      const toast = document.getElementById('toast');
      for (let i = 0; i < 60 && toast.textContent !== 'Backup importato.'; i++) await new Promise((resolve) => setTimeout(resolve, 50));
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        blocked: blocked.sort(),
        favicon: Boolean(favicon?.complete && favicon.naturalWidth > 0),
        toast: toast.textContent,
        wallpaper: getComputedStyle(document.querySelector('.wallpaper')).backgroundImage.startsWith('url("blob:'),
        accent: Object.keys(${STATE}.autoAccents).includes('custom:' + ${STATE}.customImages[0]),
      };
    })()`);
      assert.deepEqual(hits, []);
      assert.deepEqual(r, {
        blocked: ['connect-src', 'img-src', 'img-src', 'img-src', 'img-src'],
        favicon: true,
        toast: 'Backup importato.',
        wallpaper: true,
        accent: true,
      });
    },
  );

  await check(
    'the bundled wallpapers load from the package under its CSP; Glass and a new wallpaper apply before the first paint',
    async () => {
      await page.eval(`localStorage.setItem('workspace.newtab.v2', JSON.stringify({
      ...${STATE}, wallpaper: 'liquid-glass', visualStyle: 'glass', customCSS: '',
    }))`);
      const { identifier } = await page.call('Page.addScriptToEvaluateOnNewDocument', {
        source: `document.addEventListener('readystatechange', () => {
        if (document.readyState !== 'interactive') return;
        const root = document.documentElement;
        window.atBoot = { style: root.dataset.style, wallpaper: root.dataset.wallpaper, modules: root.hasAttribute('data-ready') };
      });`,
      });
      await page.goto();
      await page.call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      const r = await page.eval(`(async () => {
      const blocked = [];
      document.addEventListener('securitypolicyviolation', (e) => blocked.push(e.blockedURI));
      const sizes = await Promise.all(${JSON.stringify(WALLPAPERS)}.map(async (id) => {
        const image = new Image();
        image.src = 'assets/' + id + '.webp';
        await image.decode().catch(() => {});
        return [id, image.naturalWidth];
      }));
      return {
        atBoot: window.atBoot,
        blocked,
        sizes: Object.fromEntries(sizes),
        shown: getComputedStyle(document.querySelector('.wallpaper')).backgroundImage.endsWith('/assets/liquid-glass.webp")'),
        blur: getComputedStyle(document.querySelector('.search'), '::before').backdropFilter.startsWith('blur('),
      };
    })()`);
      assert.deepEqual(r, {
        atBoot: { style: 'glass', wallpaper: 'liquid-glass', modules: false },
        blocked: [],
        sizes: Object.fromEntries(WALLPAPERS.map((id) => [id, 1672])),
        shown: true,
        blur: true,
      });
    },
  );

  await check(
    'pausing right after starting, or muting, leaves no alarm; a session has its own (ATR-09)',
    async () => {
      const read = () =>
        page.eval(`(async () => ({
        alarms: (await chrome.alarms.getAll()).map((alarm) => alarm.name),
        running: ${STATE}.timer.running,
        notify: ${STATE}.notify,
      }))()`);
      const setNotify = (on) =>
        `(() => { const box = document.getElementById('notify-toggle'); box.checked = ${on}; box.dispatchEvent(new Event('change')); })()`;
      await page.eval('chrome.alarms.clearAll()');
      // Two clicks in one task: start, then pause.
      await page.eval(
        `(() => { const button = document.getElementById('timer-toggle'); button.click(); button.click(); })()`,
      );
      await sleep(500);
      const paused = await read();
      // Start, then notifications off, in one task.
      await page.eval(`(() => { document.getElementById('timer-toggle').click(); ${setNotify(false)}; })()`);
      await sleep(500);
      const muted = await read();
      await page.eval(setNotify(true));
      await sleep(500);
      const session = await read();
      const scheduled = await page.eval(
        `chrome.alarms.getAll().then(([alarm]) => alarm && Math.abs(alarm.scheduledTime - ${STATE}.timer.endAt) < 1000)`,
      );
      await page.eval(`document.getElementById('timer-reset').click()`);
      await sleep(500);
      const reset = await read();
      assert.deepEqual(paused, { alarms: [], running: false, notify: true });
      assert.deepEqual(muted, { alarms: [], running: true, notify: false });
      assert.deepEqual(session, { alarms: ['timer:focus:it'], running: true, notify: true });
      assert.equal(scheduled, true);
      assert.deepEqual(reset, { alarms: [], running: false, notify: true });
    },
  );

  await check('the service worker turns a timer alarm into a notification', async () => {
    const shown = await page.eval(`(async () => {
      await chrome.notifications.clear('atrio-timer');
      await chrome.alarms.create('timer:focus:it', { when: Date.now() + 200 });
      for (let i = 0; i < 100; i++) {
        const all = await chrome.notifications.getAll();
        if (all['atrio-timer']) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    })()`);
    await page.eval(`chrome.notifications.clear('atrio-timer')`);
    assert.equal(shown, true);
  });
} finally {
  await ext.close();
  server.close();
}

// The violations caused on purpose by the CSP check are expected; anything else is a problem.
const problems = ext.problems.filter((problem) => !problem.includes(BEACON));
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (problems.length) console.log(`\nConsole errors or warnings:\n${problems.join('\n')}`);
process.exitCode = failed.length || problems.length ? 1 : 0;
