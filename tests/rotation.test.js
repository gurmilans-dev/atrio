import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { localDay, shiftFrom, shownImage } from '../js/rotation.js';

const images = ['a', 'b', 'c'];

describe('shownImage', () => {
  test('without rotation: the selected image, or the first one', () => {
    const when = { day: 5, counter: 9 };
    assert.equal(shownImage({ customImages: images, customImage: 'b', rotation: 'off' }, when), 'b');
    assert.equal(shownImage({ customImages: images, customImage: 'zzz', rotation: 'off' }, when), 'a');
    assert.equal(shownImage({ customImages: [], customImage: '', rotation: 'daily' }, when), null);
  });

  test('daily: the same image all day, the next one tomorrow', () => {
    const state = { customImages: images, customImage: 'a', rotation: 'daily' };
    const days = [100, 100, 101, 102, 103].map((day) => shownImage(state, { day, counter: 1 }));
    assert.deepEqual(days, ['b', 'b', 'c', 'a', 'b']);
  });

  test('every new tab: the counter picks the image', () => {
    const state = { customImages: images, customImage: 'a', rotation: 'tab' };
    const shown = [1, 2, 3, 4].map((counter) => shownImage(state, { day: 0, counter }));
    assert.deepEqual(shown, ['b', 'c', 'a', 'b']);
  });

  test('started from an image: that one now, then the next ones, whatever the day or the tab', () => {
    for (const from of images) {
      const daily = { customImages: images, rotation: 'daily' };
      daily.rotationShift = shiftFrom(images, from, 'daily', { day: 20389, counter: 0 });
      const days = [20389, 20389, 20390, 20391].map((day) => shownImage(daily, { day, counter: 0 }));
      const tab = { customImages: images, rotation: 'tab' };
      tab.rotationShift = shiftFrom(images, from, 'tab', { day: 0, counter: 57 });
      const tabs = [57, 58, 59].map((counter) => shownImage(tab, { day: 0, counter }));
      const next = (id, n) => images[(images.indexOf(id) + n) % images.length];
      assert.deepEqual(days, [from, from, next(from, 1), next(from, 2)]);
      assert.deepEqual(tabs, [from, next(from, 1), next(from, 2)]);
    }
  });

  test('one image: rotation has nothing to rotate', () => {
    const state = { customImages: ['only'], customImage: 'only', rotation: 'tab' };
    assert.equal(shownImage(state, { day: 3, counter: 8 }), 'only');
  });
});

test('localDay changes at local midnight', () => {
  const evening = new Date(2026, 9, 27, 23, 59).getTime();
  const morning = new Date(2026, 9, 28, 0, 1).getTime();
  assert.equal(localDay(morning) - localDay(evening), 1);
  assert.equal(localDay(new Date(2026, 9, 27, 0, 1).getTime()), localDay(evening));
});
