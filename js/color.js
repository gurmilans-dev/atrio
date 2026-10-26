// Picks an accent color from wallpaper pixels: the dominant vivid hue, lifted to a
// lightness that stays readable on the dark panels. Pure function, see tests/color.test.js.

export const FALLBACK_ACCENT = '#7aa2f7';
const BUCKETS = 24;
const RAD = Math.PI / 180;

export function rgbToHsl(r, g, b) {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (!delta) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return [(hue * 60 + 360) % 360, saturation, lightness];
}

export function hslToHex(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    const value = lightness - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** @param {Uint8ClampedArray} data RGBA pixels, e.g. from getImageData on a small thumbnail */
export function pickAccent(data) {
  const buckets = Array.from({ length: BUCKETS }, () => ({ weight: 0, x: 0, y: 0, saturation: 0 }));
  let pixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    pixels++;
    const [hue, saturation, lightness] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (saturation < 0.25 || lightness < 0.12 || lightness > 0.9) continue;
    // Vivid mid-tones count most; near-black and washed-out pixels barely matter.
    const weight = saturation * (1 - Math.abs(lightness - 0.55));
    const bucket = buckets[Math.floor(hue / (360 / BUCKETS)) % BUCKETS];
    bucket.weight += weight;
    bucket.x += Math.cos(hue * RAD) * weight;
    bucket.y += Math.sin(hue * RAD) * weight;
    bucket.saturation += saturation * weight;
  }

  // Score each bucket together with its neighbours, so a hue on a bucket edge is not split in two.
  const around = (index) => [-1, 0, 1].map((offset) => buckets[(index + offset + BUCKETS) % BUCKETS]);
  let best = 0;
  let bestScore = -1;
  buckets.forEach((_, index) => {
    const score = around(index).reduce((sum, bucket, i) => sum + bucket.weight * (i === 1 ? 1 : 0.5), 0);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  const group = around(best);
  const weight = group.reduce((sum, bucket) => sum + bucket.weight, 0);
  if (!pixels || weight < pixels * 0.01) return FALLBACK_ACCENT;

  const x = group.reduce((sum, bucket) => sum + bucket.x, 0);
  const y = group.reduce((sum, bucket) => sum + bucket.y, 0);
  const hue = (Math.atan2(y, x) / RAD + 360) % 360;
  const saturation = group.reduce((sum, bucket) => sum + bucket.saturation, 0) / weight;
  return hslToHex(hue, Math.min(0.85, Math.max(0.55, saturation)), 0.72);
}
