import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FALLBACK_ACCENT, hslToHex, luminance, pickAccent, readableAccent, rgbToHsl } from '../js/color.js';
import { normalizeState } from '../js/state.js';

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

describe('readableAccent', () => {
  const hex = (color) =>
    color
      .slice(1)
      .match(/../g)
      .map((part) => parseInt(part, 16));

  test('black and white become a readable gray; accents already readable stay put', () => {
    assert.equal(readableAccent('#000000'), '#999999');
    assert.equal(readableAccent('#ffffff'), '#d9d9d9');
    const [r, g, b] = hex(readableAccent('#7aa2f7'));
    assert.ok(Math.abs(r - 0x7a) <= 1 && Math.abs(g - 0xa2) <= 1 && Math.abs(b - 0xf7) <= 1);
  });

  test('any color ends up light enough for dark text, with its hue kept', () => {
    for (const color of [
      '#0000ff',
      '#4b0082',
      '#003366',
      '#8b0000',
      '#006400',
      '#123456',
      '#ff00ff',
      '#ffff00',
    ]) {
      const readable = readableAccent(color);
      assert.ok(luminance(readable) >= 0.3, `${color} -> ${readable}`);
      const [hueBefore] = rgbToHsl(...hex(color));
      const [hueAfter] = rgbToHsl(...hex(readable));
      assert.ok(Math.abs(hueBefore - hueAfter) < 3, `${color} -> ${readable}`);
    }
  });

  test('the saved custom accent is validated and its readable version recomputed', () => {
    assert.deepEqual(normalizeState({}).customAccent, {
      picked: '#7aa2f7',
      color: readableAccent('#7aa2f7'),
    });
    const saved = normalizeState({ customAccent: { picked: '#003366', color: '#000000' } }).customAccent;
    assert.deepEqual(saved, { picked: '#003366', color: readableAccent('#003366') });
    assert.equal(normalizeState({ customAccent: { picked: 'red' } }).customAccent.picked, '#7aa2f7');
  });
});
