// Renders the extension PNG icons (16/32/48/128) from assets/icons/icon.svg with headless Chrome,
// on a transparent background. The SVG is the single source of the logo and doubles as the favicon.
// Usage: npm run icons (set CHROME_PATH if Chrome is not found)
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launch } from '../tests/e2e/harness.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SIZES = [16, 32, 48, 128];

const browser = await launch(ROOT, { width: 128, height: 128 });
try {
  const page = await browser.openPage('assets/icons/icon.svg');
  await page.call('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const size of SIZES) {
    await page.resize(size, size);
    await page.goto();
    const file = new URL(`../assets/icons/icon-${size}.png`, import.meta.url);
    await writeFile(file, await page.screenshot({ format: 'png' }));
    console.log(`assets/icons/icon-${size}.png`);
  }
} finally {
  await browser.close();
}
