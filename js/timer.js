// Pure timer logic: no DOM, no storage, easy to test with node --test.
// The timer stores an absolute end timestamp, so throttled or closed tabs stay accurate.
import { CUSTOM_PRESET, PRESETS } from './config.js';
import { recordSession } from './stats.js';

export const presetById = (id) => PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];

/** The durations chosen in the state: a fixed preset or the custom one ({ focus, break } in minutes). */
export const presetOf = (state) =>
  state.preset === CUSTOM_PRESET ? state.customPreset : presetById(state.preset);

// A preset is a PRESETS id (25, 50) or durations { focus, break } in minutes, as presetOf returns.
const durationsOf = (preset) => (typeof preset === 'object' && preset !== null ? preset : presetById(preset));

export const durationFor = (mode, preset) => durationsOf(preset)[mode === 'break' ? 'break' : 'focus'] * 60;

export const nextMode = (mode) => (mode === 'focus' ? 'break' : 'focus');

export function readyTimer(mode, preset) {
  const total = durationFor(mode, preset);
  return { mode, running: false, remaining: total, total, endAt: null };
}

export function remainingSeconds(timer, now) {
  if (!timer.running) return timer.remaining;
  return Math.max(0, Math.ceil((timer.endAt - now) / 1000));
}

export const isExpired = (timer, now) => timer.running && timer.endAt <= now;

export function startTimer(timer, now) {
  const remaining = timer.remaining > 0 ? timer.remaining : timer.total;
  return { ...timer, running: true, remaining, endAt: now + remaining * 1000 };
}

export function pauseTimer(timer, now) {
  return { ...timer, running: false, remaining: remainingSeconds(timer, now), endAt: null };
}

export function progressOf(timer, now) {
  if (!timer.total) return 0;
  const done = (timer.total - remainingSeconds(timer, now)) / timer.total;
  return Math.min(1, Math.max(0, done));
}

// Delay until the displayed second changes (display uses Math.ceil), so ticks never drift.
export function msUntilNextSecond(timer, now) {
  const left = timer.endAt - now;
  if (left <= 0) return 0;
  return (left % 1000 || 1000) + 15;
}

// Hidden tabs only refresh the title once per displayed minute.
export function msUntilNextMinute(timer, now) {
  const left = timer.endAt - now;
  if (left <= 0) return 0;
  return (left % 60000 || 60000) + 15;
}

export function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

// Finishing a session readies the next one (focus -> break -> focus) without starting it.
export function completeSession({ timer, stats, preset }) {
  const finishedFocus = timer.mode === 'focus';
  return {
    finishedFocus,
    stats: finishedFocus ? recordSession(stats, timer.endAt) : stats,
    timer: readyTimer(nextMode(timer.mode), preset),
  };
}
