// Which of the user's own wallpapers is shown: the selected one or, with rotation on and at least
// two images, the day's (the same in every tab) or the next one for each new tab. js/boot.js
// repeats this to apply the matching accent before the first paint; tests/boot.test.js checks
// they agree. Pure, see tests/rotation.test.js.
export const ROTATIONS = ['off', 'daily', 'tab'];

/** Days since 1970 in local time, so the daily image changes at local midnight. */
export const localDay = (now) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

/** @param {{ day: number, counter: number }} when counter: this tab's number, from js/boot.js */
export function shownImage({ customImages, customImage, rotation }, { day, counter }) {
  const count = customImages.length;
  if (!count) return null;
  if (rotation === 'off' || count < 2) {
    return customImages.includes(customImage) ? customImage : customImages[0];
  }
  const step = rotation === 'daily' ? day : counter;
  return customImages[((step % count) + count) % count];
}
