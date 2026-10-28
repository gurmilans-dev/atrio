// Which of the user's own wallpapers is shown: the selected one or, with the daily rotation on and at
// least two images, the day's (the same in every tab). js/boot.js repeats this to apply the matching
// accent before the first paint; tests/boot.test.js checks they agree. Pure, see tests/rotation.test.js.
// The "every new tab" rotation of 3.2.0 is gone: saves that used it rotate daily (js/state.js).
export const ROTATIONS = ['off', 'daily'];

/** Days since 1970 in local time, so the daily image changes at local midnight. */
export const localDay = (now) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);

/**
 * rotationShift moves the start: a rotation turned on in Settings goes on from the image then on screen
 * (see shiftFrom). Saves from before it have none, and keep the image they showed.
 */
export function shownImage({ customImages, customImage, rotation, rotationShift = 0 }, day) {
  const count = customImages.length;
  if (!count) return null;
  if (rotation !== 'daily' || count < 2) {
    return customImages.includes(customImage) ? customImage : customImages[0];
  }
  const step = day + rotationShift;
  return customImages[((step % count) + count) % count];
}

/** The rotationShift that shows `id` on `day`: the next day brings the one after it. */
export function shiftFrom(customImages, id, day) {
  return Math.max(0, customImages.indexOf(id)) - day;
}
