// Minimal Chrome DevTools Protocol harness, zero dependencies (Node 22+: global fetch and WebSocket).
// launch() serves the extension folder over HTTP and drives a headless Chrome with a throwaway
// profile: the page runs outside the extension, so chrome.* APIs are absent and degrade gracefully.
// launchExtension() loads the extension itself, for what only it has (APIs, CSP, service worker).
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const env = process.env;
  const candidates =
    {
      win32: [
        `${env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
        `${env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
        `${env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
        `${env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
      ],
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ],
    }[process.platform] ?? [];
  const found = candidates.find((file) => existsSync(file));
  if (found) return found;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      return execFileSync('which', [name], { encoding: 'utf8' }).trim();
    } catch {
      // Try the next name.
    }
  }
  throw new Error('Chrome not found: set the CHROME_PATH environment variable.');
}

function serve(root) {
  const server = http.createServer(async (request, response) => {
    const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://local').pathname));
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

// Chrome writes the port it picked into <profile>/DevToolsActivePort.
async function waitForDevTools(profile) {
  for (let i = 0; i < 100; i++) {
    try {
      const [port, wsPath] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
      if (port && wsPath) return `ws://127.0.0.1:${port}${wsPath}`;
    } catch {
      // Not written yet.
    }
    await sleep(100);
  }
  throw new Error('Chrome did not start (no DevToolsActivePort).');
}

// The protocol over any transport: `write` sends a message, receive() takes one in.
function protocol(write) {
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  const problems = [];

  function receive(data) {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    // Every uncaught exception, console.error/warn and failed request counts as a problem.
    const { method, params } = message;
    if (method === 'Runtime.exceptionThrown') {
      problems.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    } else if (method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(params.type)) {
      problems.push(
        `console.${params.type}: ${params.args.map((arg) => arg.value ?? arg.description).join(' ')}`,
      );
    } else if (method === 'Log.entryAdded' && ['error', 'warning'].includes(params.entry.level)) {
      problems.push(`${params.entry.text} ${params.entry.url ?? ''}`.trim());
    }
    for (const listener of listeners) listener(message);
  }

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      write(JSON.stringify({ id, method, params, sessionId }));
    });
  return { send, listeners, problems, receive };
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const cdp = protocol((text) => socket.send(text));
  socket.addEventListener('message', ({ data }) => cdp.receive(data));
  return { ...cdp, close: () => socket.close() };
}

// --remote-debugging-pipe: messages go in on file descriptor 3 and out on 4, each ended by a NUL.
function connectPipe(child) {
  const [, , , input, output] = child.stdio;
  const cdp = protocol((text) => input.write(`${text}\0`));
  let buffer = '';
  output.setEncoding('utf8');
  output.on('data', (chunk) => {
    buffer += chunk;
    for (let end = buffer.indexOf('\0'); end >= 0; end = buffer.indexOf('\0')) {
      const message = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      cdp.receive(message);
    }
  });
  return { ...cdp, close: () => input.end() };
}

// Keys used by the tests: [code, windowsVirtualKeyCode, text].
const KEYS = {
  Escape: ['Escape', 27],
  Enter: ['Enter', 13, '\r'],
  ArrowDown: ['ArrowDown', 40],
  ArrowUp: ['ArrowUp', 38],
  ArrowLeft: ['ArrowLeft', 37],
  ArrowRight: ['ArrowRight', 39],
  Delete: ['Delete', 46],
  '/': ['Slash', 191, '/'],
  '>': ['IntlBackslash', 226, '>'],
};
const MODIFIERS = { alt: 1, ctrl: 2, meta: 4, shift: 8 };

async function openPage(cdp, url, { width, height }) {
  const { send, listeners } = cdp;
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  for (const domain of ['Runtime', 'Log', 'Page']) await send(`${domain}.enable`, {}, sessionId);
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await send('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId);
  const call = (method, params) => send(method, params, sessionId);
  // Documents leaving the test server (searches, sites) are recorded and aborted before any request.
  const navigations = [];
  listeners.add((message) => {
    if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return;
    navigations.push(message.params.request.url);
    send(
      'Fetch.failRequest',
      { requestId: message.params.requestId, errorReason: 'Aborted' },
      sessionId,
    ).catch(() => {});
  });

  const page = {
    targetId,
    call,
    navigations,
    /** From now on, navigations to http(s) sites are recorded in `navigations` and never sent. */
    async trackNavigations() {
      await call('Fetch.enable', { patterns: [{ urlPattern: 'https://*', resourceType: 'Document' }] });
    },
    async eval(expression) {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      }
      return result.result.value;
    },
    async goto(target = url) {
      const loaded = new Promise((resolve) => {
        const onLoad = (message) => {
          if (message.sessionId !== sessionId || message.method !== 'Page.loadEventFired') return;
          listeners.delete(onLoad);
          resolve();
        };
        listeners.add(onLoad);
      });
      await call('Page.navigate', { url: target });
      await loaded;
      await sleep(300);
    },
    /** Trusted key press, e.g. press('Escape'), press('g'), press('p', { ctrl: true, shift: true }). */
    async press(key, modifiers = {}) {
      const [code, vk, text] = KEYS[key] ?? [`Key${key.toUpperCase()}`, key.toUpperCase().charCodeAt(0), key];
      const mask = Object.entries(modifiers).reduce((sum, [name, on]) => sum + (on ? MODIFIERS[name] : 0), 0);
      const base = { key, code, windowsVirtualKeyCode: vk, modifiers: mask };
      await call('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: mask & 2 ? undefined : text });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
      await sleep(120);
    },
    async type(text) {
      await call('Input.insertText', { text });
      await sleep(150);
    },
    async move(x, y) {
      await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await sleep(120);
    },
    async click(selector) {
      const { x, y } = await page.eval(`(() => {
        const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })()`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
      await sleep(150);
    },
    resize: (w, h) =>
      call('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: false,
      }),
    reducedMotion: (on) =>
      call('Emulation.setEmulatedMedia', {
        features: on ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [],
      }),
    async screenshot(options = { format: 'png' }) {
      return Buffer.from((await call('Page.captureScreenshot', options)).data, 'base64');
    },
    close: () => send('Target.closeTarget', { targetId }),
  };
  await page.goto();
  return page;
}

/** Starts the static server and headless Chrome; call close() when done. */
/** `lang` is the browser language, which the page's "auto" language follows. */
export async function launch(root, { width = 1440, height = 900, lang = 'it-IT' } = {}) {
  const server = await serve(root);
  const profile = await mkdtemp(path.join(tmpdir(), 'atrio-e2e-'));
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      `--lang=${lang}`,
      `--accept-lang=${lang}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const cdp = await connect(await waitForDevTools(profile));
  return {
    problems: cdp.problems,
    openPage: (file = 'index.html') => openPage(cdp, `${server.url}/${file}`, { width, height }),
    async close() {
      cdp.close();
      chrome.kill();
      server.close();
      await sleep(500);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/**
 * Loads the extension itself, unpacked, in headless Chrome or Edge: chrome.* APIs, the manifest's CSP
 * and the service worker are the real ones. Branded Chrome ignores --load-extension; it accepts
 * Extensions.loadUnpacked on a DevTools pipe with --enable-unsafe-extension-debugging.
 */
export async function launchExtension(root, { width = 1440, height = 900, lang = 'it-IT' } = {}) {
  const profile = await mkdtemp(path.join(tmpdir(), 'atrio-extension-'));
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new',
      '--remote-debugging-pipe',
      '--enable-unsafe-extension-debugging',
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      `--lang=${lang}`,
      `--accept-lang=${lang}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  );
  const cdp = connectPipe(chrome);
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.resolve(root) });
  return {
    id,
    send: cdp.send,
    listeners: cdp.listeners,
    problems: cdp.problems,
    openPage: (file = 'index.html') => openPage(cdp, `chrome-extension://${id}/${file}`, { width, height }),
    async close() {
      cdp.close();
      chrome.kill();
      await sleep(500);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}
