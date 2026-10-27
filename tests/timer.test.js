import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizeState } from '../js/state.js';
import { dayKey, sessionsToday } from '../js/stats.js';
import {
  completeSession,
  formatClock,
  isExpired,
  msUntilNextMinute,
  msUntilNextSecond,
  pauseTimer,
  presetOf,
  progressOf,
  readyTimer,
  remainingSeconds,
  startTimer,
} from '../js/timer.js';

const NOW = new Date(2026, 9, 25, 10, 0, 0).getTime();

describe('timer', () => {
  test('presets set focus and break durations', () => {
    assert.equal(readyTimer('focus', 25).total, 1500);
    assert.equal(readyTimer('break', 25).total, 300);
    assert.equal(readyTimer('focus', 50).total, 3000);
    assert.equal(readyTimer('break', 50).total, 600);
  });

  test('start, pause and resume keep the remaining time', () => {
    const running = startTimer(readyTimer('focus', 25), NOW);
    assert.equal(running.endAt, NOW + 1500 * 1000);
    assert.equal(remainingSeconds(running, NOW + 60_500), 1440);
    const paused = pauseTimer(running, NOW + 60_500);
    assert.equal(paused.running, false);
    assert.equal(paused.remaining, 1440);
    assert.equal(startTimer(paused, NOW + 100_000).endAt, NOW + 100_000 + 1440 * 1000);
  });

  test('expiry and progress', () => {
    const running = startTimer(readyTimer('break', 25), NOW);
    assert.equal(isExpired(running, NOW + 299_000), false);
    assert.equal(isExpired(running, NOW + 300_000), true);
    assert.equal(progressOf(running, NOW + 150_000), 0.5);
    assert.equal(progressOf(running, NOW + 999_999), 1);
  });

  test('progress uses the session total, not the current preset', () => {
    const paused = { ...readyTimer('focus', 25), remaining: 750 };
    assert.equal(progressOf(paused, NOW), 0.5);
  });

  test('ticks are aligned to the displayed second and minute', () => {
    const timer = { running: true, endAt: NOW + 10_250 };
    assert.equal(msUntilNextSecond(timer, NOW), 265);
    assert.equal(msUntilNextSecond({ running: true, endAt: NOW + 3000 }, NOW), 1015);
    assert.equal(msUntilNextMinute({ running: true, endAt: NOW + 90_000 }, NOW), 30_015);
  });

  test('completing focus counts a session and readies the break', () => {
    const timer = { ...startTimer(readyTimer('focus', 25), NOW - 1500_000), endAt: NOW };
    const day = dayKey(new Date(NOW));
    const stats = { total: 4, today: 2, day, history: { [day]: 2 } };
    const result = completeSession({ timer, stats, preset: 25 });
    assert.equal(result.finishedFocus, true);
    assert.deepEqual(result.stats, { total: 5, today: 3, day, history: { [day]: 3 } });
    assert.deepEqual(result.timer, readyTimer('break', 25));
  });

  test('the daily counter restarts on a new day', () => {
    const timer = { ...readyTimer('focus', 25), running: true, endAt: NOW };
    const stats = { total: 9, today: 7, day: '2026-10-24', history: { '2026-10-24': 7 } };
    const result = completeSession({ timer, stats, preset: 25 });
    assert.deepEqual(result.stats, {
      total: 10,
      today: 1,
      day: '2026-10-25',
      history: { '2026-10-24': 7, '2026-10-25': 1 },
    });
    assert.equal(sessionsToday(result.stats, NOW), 1);
    assert.equal(sessionsToday(result.stats, NOW + 86_400_000), 0);
  });

  test('completing a break does not count and readies focus', () => {
    const timer = { ...readyTimer('break', 50), running: true, endAt: NOW };
    const stats = { total: 1, today: 1, day: '2026-10-25', history: { '2026-10-25': 1 } };
    const result = completeSession({ timer, stats, preset: 50 });
    assert.equal(result.stats, stats);
    assert.equal(result.timer.mode, 'focus');
    assert.equal(result.timer.total, 3000);
  });

  test('formatClock', () => {
    assert.equal(formatClock(1500), '25:00');
    assert.equal(formatClock(61), '01:01');
    assert.equal(formatClock(0), '00:00');
  });
});

describe('custom preset', () => {
  test('durations come from the custom preset when it is chosen', () => {
    const state = normalizeState({ preset: 'custom', customPreset: { focus: 90, break: 15 } });
    assert.deepEqual(presetOf(state), { focus: 90, break: 15 });
    assert.equal(readyTimer('focus', presetOf(state)).total, 5400);
    assert.equal(readyTimer('break', presetOf(state)).total, 900);
    assert.equal(state.timer.total, 5400); // a fresh timer already has the custom length
    assert.deepEqual(presetOf(normalizeState({ preset: 50 })), { id: 50, focus: 50, break: 10 });
  });

  test('saved durations are clamped, defaults when missing', () => {
    assert.deepEqual(normalizeState({}).customPreset, { focus: 45, break: 10 });
    assert.deepEqual(normalizeState({ customPreset: { focus: 999, break: 0 } }).customPreset, {
      focus: 180,
      break: 1,
    });
    assert.equal(normalizeState({ preset: 'other' }).preset, 25);
  });

  test('a finished custom session readies the custom break', () => {
    const state = normalizeState({ preset: 'custom', customPreset: { focus: 90, break: 15 } });
    const timer = { ...readyTimer('focus', presetOf(state)), running: true, endAt: NOW };
    const result = completeSession({ timer, stats: state.stats, preset: presetOf(state) });
    assert.equal(result.timer.total, 900);
  });
});
