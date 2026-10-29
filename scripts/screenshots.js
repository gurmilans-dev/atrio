// Regenerates the screenshots with demo data.
//   npm run screenshots              README images in docs/, 1536 × 960 WebP
//   npm run screenshots -- --store   Chrome Web Store set in docs/store/<version>/: five 1280 × 800 JPEG
//                                    screenshots (no alpha) and the 440 × 280 small promo tile
// Names after the options write only those images, e.g. npm run screenshots -- --store 3-minimal-classic.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from '../tests/e2e/harness.js';

const STORE = process.argv.includes('--store');
const ONLY = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = new URL(STORE ? `../docs/store/${version}/` : '../docs/', import.meta.url);
// The Store set shows the same 1536 × 960 layout as the README, scaled to the Store's 1280 × 800.
const [WIDTH, HEIGHT] = [1536, 960];
const FORMAT = STORE
  ? { format: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1280 / WIDTH } }
  : { format: 'webp', quality: 85 };
const EXTENSION = STORE ? 'jpg' : 'webp';
const KEY = 'workspace.newtab.v2';

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// A believable 20-week focus history: busier on weekdays, deterministic.
function demoHistory() {
  const history = {};
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let ago = 1; ago < 140; ago++) {
    const date = new Date();
    date.setDate(date.getDate() - ago);
    const weekend = [0, 6].includes(date.getDay());
    const count = Math.floor(random() * (weekend ? 2.2 : 5.5));
    // The last week is unbroken, so the streak counter has something to show.
    if (count || ago < 7) history[dayKey(date)] = Math.max(count, 1);
  }
  return history;
}

function demoState() {
  const today = dayKey(new Date());
  const history = { ...demoHistory(), [today]: 3 };
  return {
    tasks: [
      { id: 'demo-1', text: 'Review PR #128', done: false },
      { id: 'demo-2', text: 'Prepare Friday’s demo', done: true },
    ],
    notes: 'npm run dev -- --port 5173\ngit rebase origin/main\n\nTODO: try the /v2/users endpoint',
    stats: { total: Object.values(history).reduce((sum, n) => sum + n, 0), today: 3, day: today, history },
    timer: {
      mode: 'focus',
      running: true,
      remaining: 1500,
      total: 1500,
      endAt: Date.now() + (18 * 60 + 42) * 1000,
    },
  };
}

// A token made up for the picture: decoded by the search box like any JWT, it holds nothing real.
function demoToken() {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: 'demo-user', name: 'Demo User', role: 'developer', iat: now - 600, exp: now + 3000 };
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.demo-signature`;
}

// The Chrome Web Store set: Developer and Minimal, Classic and Glass, the developer tools, the
// appearance settings. The Google apps launcher is turned off (Settings → Page), so the pictures show
// Azlune's own features.
async function storeSet(page, shot) {
  const set = (patch) =>
    page.eval(`(() => {
      const s = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));
      Object.assign(s, ${JSON.stringify({ theme: 'tokyo', panelTab: 'tasks', apps: { visible: false }, ...patch })});
      localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(s));
    })()`);

  await set({ layout: 'developer', visualStyle: 'classic', wallpaper: 'workstation' });
  await page.goto();
  await shot('1-developer-classic');

  await set({ layout: 'developer', visualStyle: 'glass', wallpaper: 'liquid-glass' });
  await page.goto();
  await page.press('/');
  await page.type(demoToken());
  await shot('2-developer-glass-tools');

  await set({ layout: 'minimal', visualStyle: 'classic', wallpaper: 'city' });
  await page.goto();
  await shot('3-minimal-classic');

  await set({ layout: 'minimal', visualStyle: 'glass', theme: 'mocha', wallpaper: 'sunrise-lake' });
  await page.goto();
  await shot('4-minimal-glass');

  await set({ layout: 'developer', visualStyle: 'classic', wallpaper: 'deep-space' });
  await page.goto();
  await page.click('#open-settings');
  await page.eval(`(() => {
    document.getElementById('style-picks').scrollIntoView({ block: 'start' });
    document.activeElement.blur();
  })()`);
  await shot('5-appearance');
}

// The browser language is English, so the page's automatic language is too.
const browser = await launch(ROOT, { width: WIDTH, height: HEIGHT, lang: 'en-US' });
try {
  const page = await browser.openPage();
  const shot = async (name) => {
    if (ONLY.length && !ONLY.includes(name)) return;
    await sleep(400);
    const file = new URL(`${name}.${EXTENSION}`, OUT);
    await writeFile(file, await page.screenshot(FORMAT));
    console.log(fileURLToPath(file));
  };
  await mkdir(OUT, { recursive: true });
  await page.eval(
    `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(demoState()))})`,
  );
  await page.goto();

  if (STORE) {
    await storeSet(page, shot);
    // The small promo tile, from its own page at the Store's size.
    if (!ONLY.length || ONLY.includes('promo-440x280')) {
      const tile = await browser.openPage('scripts/promo-tile.html');
      await tile.resize(440, 280);
      await sleep(400);
      const file = new URL('promo-440x280.png', OUT);
      await writeFile(file, await tile.screenshot({ format: 'png' }));
      console.log(fileURLToPath(file));
    }
  } else {
    await readmeSet(page, shot);
  }
} finally {
  await browser.close();
}

// The README images: the full workspace, the palette, the launcher, a theme, Minimal and Glass.
async function readmeSet(page, shot) {
  await shot('home');

  await page.press('/');
  await page.type('= 0xff * 4 + 2^10');
  await shot('palette');
  await page.press('Escape');
  await page.eval(`(() => {
    const input = document.getElementById('search-input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.blur();
  })()`);

  await page.click('#apps-button');
  await shot('apps');
  await page.press('Escape');

  await page.eval(`(() => {
    const s = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));
    Object.assign(s, { theme: 'mocha', wallpaper: 'city', panelTab: 'notes' });
    localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(s));
  })()`);
  await page.goto();
  await shot('mocha');

  // Minimal mode, with the default theme and wallpaper.
  await page.eval(`(() => {
    const s = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));
    Object.assign(s, { layout: 'minimal', theme: 'tokyo', wallpaper: 'city', panelTab: 'tasks' });
    localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(s));
  })()`);
  await page.goto();
  await shot('minimal');

  // The Glass style, in Developer, on one of the bundled wallpapers.
  await page.eval(`(() => {
    const s = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));
    Object.assign(s, { layout: 'developer', visualStyle: 'glass', theme: 'tokyo', wallpaper: 'liquid-glass' });
    localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(s));
  })()`);
  await page.goto();
  await shot('glass');
}
