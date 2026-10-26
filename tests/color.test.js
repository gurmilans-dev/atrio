import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FALLBACK_ACCENT, hslToHex, pickAccent, rgbToHsl } from '../js/color.js';

function pixels(...groups) {
  const data = [];
  for (const [rgb, count] of groups) for (let i = 0; i < count; i++) data.push(...rgb, 255);
  return Uint8ClampedArray.from(data);
}
const hueOf = (hex) => rgbToHsl(...hex.match(/\w\w/g).map((part) => parseInt(part, 16)))[0];

describe('color', () => {
  test('hsl round trip', () => {
    assert.equal(hslToHex(0, 1, 0.5), '#ff0000');
    assert.equal(hslToHex(120, 1, 0.5), '#00ff00');
    assert.equal(hslToHex(240, 1, 0.5), '#0000ff');
    assert.deepEqual(rgbToHsl(255, 0, 0), [0, 1, 0.5]);
  });

  test('the dominant vivid hue wins, even against more dark pixels', () => {
    const accent = pickAccent(
      pixels(
        [[10, 12, 20], 500], // near-black night sky: ignored
        [[40, 90, 220], 120], // blue
        [[220, 60, 160], 40], // pink
      ),
    );
    assert.ok(Math.abs(hueOf(accent) - 223) < 6, `${accent} ${hueOf(accent)}`);
  });

  test('the accent is always light enough for the dark panels', () => {
    const [, saturation, lightness] = rgbToHsl(
      ...pickAccent(pixels([[90, 20, 20], 100]))
        .match(/\w\w/g)
        .map((part) => parseInt(part, 16)),
    );
    assert.ok(lightness > 0.68 && lightness < 0.76, String(lightness));
    assert.ok(saturation >= 0.5, String(saturation));
  });

  test('grayscale or transparent images fall back to the default accent', () => {
    assert.equal(pickAccent(pixels([[128, 128, 128], 200], [[20, 20, 20], 200])), FALLBACK_ACCENT);
    assert.equal(pickAccent(new Uint8ClampedArray(400)), FALLBACK_ACCENT);
  });
});
