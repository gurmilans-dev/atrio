import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HISTORY_DAYS, heatLevel, heatmap, recordSession, streak } from '../js/stats.js';

// Sunday 25 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 25, 10, 0, 0).getTime();
const empty = { total: 0, today: 0, day: '', history: {} };

describe('stats', () => {
  test('recordSession counts per day and keeps the totals', () => {
    const once = recordSession(empty, NOW);
    const twice = recordSession(once, NOW + 3600_000);
    assert.deepEqual(twice, { total: 2, today: 2, day: '2026-10-25', history: { '2026-10-25': 2 } });
  });

  test('recordSession drops history older than the heatmap', () => {
    const stats = { ...empty, history: { '2025-01-01': 4, '2026-10-01': 2 } };
    assert.deepEqual(Object.keys(recordSession(stats, NOW).history).sort(), ['2026-10-01', '2026-10-25']);
    assert.equal(HISTORY_DAYS, 140);
  });

  test('streak counts consecutive days, today may still be empty', () => {
    const history = { '2026-10-22': 1, '2026-10-23': 3, '2026-10-24': 2 };
    assert.equal(streak(history, NOW), 3);
    assert.equal(streak({ ...history, '2026-10-25': 1 }, NOW), 4);
    assert.equal(streak({ '2026-10-23': 1 }, NOW), 0);
    assert.equal(streak({}, NOW), 0);
  });

  test('heatmap: weeks start on Monday and end with today', () => {
    const cells = heatmap({ '2026-10-20': 2 }, NOW, 2);
    assert.equal(cells.length, 14);
    assert.equal(cells[0].key, '2026-10-12'); // Monday
    assert.equal(cells[13].key, '2026-10-25'); // Sunday = today
    assert.equal(cells[13].today, true);
    assert.equal(cells.find((cell) => cell.key === '2026-10-20').count, 2);
  });

  test('heatmap: days after today are empty', () => {
    const wednesday = new Date(2026, 9, 21, 9).getTime();
    const cells = heatmap({}, wednesday, 1);
    assert.deepEqual(
      cells.map((cell) => cell?.key ?? null),
      ['2026-10-19', '2026-10-20', '2026-10-21', null, null, null, null],
    );
  });

  test('heat levels', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 12].map(heatLevel), [0, 1, 2, 2, 3, 3, 4, 4]);
  });
});
