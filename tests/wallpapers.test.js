// The built-in wallpapers are files of the extension: each id in WALLPAPERS has its image in assets/,
// a real WebP shaped like a screen, and a name in both languages.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { WALLPAPERS, wallpaperSrc } from '../js/config.js';
import { STRINGS } from '../js/i18n.js';

// Width and height of a lossy WebP ("VP8 " chunk): the key frame header follows the start code.
function webpSize(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 16), 'WEBPVP8 ');
  assert.deepEqual([...bytes.subarray(23, 26)], [0x9d, 0x01, 0x2a]);
  return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
}

// Workstation and City are 1672 × 941, the four added later 1600 × 900: all 16:9 and wide enough to cover a
// full-HD screen without much upscaling.
test('every built-in wallpaper is a 16:9 WebP in assets/, at least 1600 px wide and light to ship', () => {
  for (const id of WALLPAPERS) {
    const bytes = readFileSync(new URL(`../${wallpaperSrc(id)}`, import.meta.url));
    const [width, height] = webpSize(bytes);
    assert.ok(width >= 1600, `${id}: ${width} px wide`);
    assert.ok(Math.abs(width / height - 16 / 9) < 0.01, `${id}: ${width} × ${height}`);
    assert.ok(bytes.length < 400 * 1024, `${id}: ${bytes.length} bytes`);
  }
});

test('ids fit what boot.js applies before the first paint, and each has a name in both languages', () => {
  for (const id of WALLPAPERS) {
    assert.match(id, /^[a-z]+(-[a-z]+)*$/);
    for (const language of ['it', 'en']) {
      assert.ok(STRINGS[language][`wallpaper.${id}`], `${language}: ${id}`);
    }
  }
});
