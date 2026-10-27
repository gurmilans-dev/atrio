import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { localDay, shownImage } from '../js/rotation.js';

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
