import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { localDay, shiftFrom, shownImage } from '../js/rotation.js';

const images = ['a', 'b', 'c'];

describe('shownImage', () => {
  test('without rotation: the selected image, or the first one', () => {
    assert.equal(shownImage({ customImages: images, customImage: 'b', rotation: 'off' }, 5), 'b');
    assert.equal(shownImage({ customImages: images, customImage: 'zzz', rotation: 'off' }, 5), 'a');
    assert.equal(shownImage({ customImages: [], customImage: '', rotation: 'daily' }, 5), null);
  });

  test('daily, without a chosen start (older saves): the same image all day, the next one tomorrow', () => {
    const state = { customImages: images, customImage: 'a', rotation: 'daily' };
    const days = [100, 100, 101, 102, 103].map((day) => shownImage(state, day));
    assert.deepEqual(days, ['b', 'b', 'c', 'a', 'b']);
  });

  test('daily, started from an image: that one today, then the next ones', () => {
    for (const from of images) {
      const state = {
        customImages: images,
        rotation: 'daily',
        rotationShift: shiftFrom(images, from, 20389),
      };
      const days = [20389, 20389, 20390, 20391].map((day) => shownImage(state, day));
      const next = (n) => images[(images.indexOf(from) + n) % images.length];
      assert.deepEqual(days, [from, from, next(1), next(2)]);
    }
  });

  test('one image: rotation has nothing to rotate', () => {
    const state = { customImages: ['only'], customImage: 'only', rotation: 'daily' };
    assert.equal(shownImage(state, 3), 'only');
  });
});

test('localDay changes at local midnight', () => {
  const evening = new Date(2026, 9, 27, 23, 59).getTime();
  const morning = new Date(2026, 9, 28, 0, 1).getTime();
  assert.equal(localDay(morning) - localDay(evening), 1);
  assert.equal(localDay(new Date(2026, 9, 27, 0, 1).getTime()), localDay(evening));
});
