// Regenerates the README screenshots in docs/ with demo data: npm run screenshots
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from '../tests/e2e/harness.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = new URL('../docs/', import.meta.url);
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

// The browser language is English, so the page's automatic language is too.
const browser = await launch(ROOT, { width: 1536, height: 960, lang: 'en-US' });
try {
  const page = await browser.openPage();
  const shot = async (name) => {
    await sleep(400);
    await writeFile(new URL(name, OUT), await page.screenshot({ format: 'webp', quality: 85 }));
    console.log(`docs/${name}`);
  };
  await mkdir(OUT, { recursive: true });
  await page.eval(
    `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(demoState()))})`,
  );
  await page.goto();

  await shot('home.webp');

  await page.press('/');
  await page.type('= 0xff * 4 + 2^10');
  await shot('palette.webp');
  await page.press('Escape');
  await page.eval(`(() => {
    const input = document.getElementById('search-input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.blur();
  })()`);

  await page.click('#apps-button');
  await shot('apps.webp');
  await page.press('Escape');

  await page.click('#open-settings');
  await shot('settings.webp');
  await page.press('Escape');

  await page.eval(`(() => {
    const s = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));
    Object.assign(s, { theme: 'mocha', wallpaper: 'city', panelTab: 'notes' });
    localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(s));
  })()`);
  await page.goto();
  await shot('mocha.webp');
} finally {
  await browser.close();
}
