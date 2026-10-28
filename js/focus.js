// Focus timer panel. Ticks only while running: once per displayed second when visible,
// once per minute when hidden (just to keep the tab title current).
import { $, announce, el } from './dom.js';
import { dateFormat, t } from './i18n.js';
import { revealPanel } from './layout.js';
import { ensureTimerAlarm, syncTimerAlarm } from './platform.js';
import { dayKey, heatLevel, heatmap, sessionsToday, streak } from './stats.js';
import { getState, subscribe, update } from './store.js';
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
} from './timer.js';

const MODE_LABEL = { focus: 'timer.modeFocus', break: 'timer.modeBreak' };
const cellDate = dateFormat({ weekday: 'short', day: 'numeric', month: 'short' });
let tickTimeout;
let pendingMessage = null;
let heatmapKey = '';

// GitHub-style grid of the last weeks; rebuilt only when the history or the day changes.
function renderHeatmap(stats, now) {
  const key = JSON.stringify(stats.history) + dayKey(new Date(now));
  if (key === heatmapKey) return;
  heatmapKey = key;
  const cells = heatmap(stats.history, now);
  const days = streak(stats.history, now);
  const recent = cells.reduce((sum, cell) => sum + (cell?.count ?? 0), 0);
  $('heatmap').replaceChildren(
    ...cells.map((cell) => {
      if (!cell) return el('span', 'cell empty');
      const node = el('span', `cell l${heatLevel(cell.count)}${cell.today ? ' today' : ''}`);
      node.title = `${t('heatmap.sessions', { n: cell.count })} · ${cellDate.format(cell.date)}`;
      return node;
    }),
  );
  const dayCount = t('heatmap.days', { n: days });
  $('heatmap').setAttribute(
    'aria-label',
    t('heatmap.label', { sessions: t('heatmap.sessions', { n: recent }), days: dayCount }),
  );
  $('streak').textContent = days ? t('heatmap.streak', { days: dayCount }) : t('heatmap.noStreak');
}

// A short glow on the panel when a session ends while the page is visible.
function celebrate() {
  const panel = $('focus-panel');
  panel.classList.remove('celebrate');
  void panel.offsetWidth; // restart the animation
  panel.classList.add('celebrate');
}

function render(state) {
  const now = Date.now();
  const { timer } = state;
  const seconds = remainingSeconds(timer, now);
  const fresh = !timer.running && seconds === timer.total;

  $('timer').textContent = formatClock(seconds);
  $('timer-state').textContent = t(
    timer.running ? 'timer.running' : seconds === 0 ? 'timer.done' : fresh ? 'timer.ready' : 'timer.paused',
  );
  $('timer-toggle').textContent = t(
    timer.running ? 'timer.pause' : fresh || seconds === 0 ? 'timer.start' : 'timer.resume',
  );
  for (const mode of ['focus', 'break']) {
    const node = $(`${mode}-mode`);
    node.classList.toggle('active', timer.mode === mode);
    node.setAttribute('aria-pressed', String(timer.mode === mode));
  }

  const preset = presetOf(state);
  $('preset-caption').textContent = `${preset.focus} / ${preset.break}`;
  const total = state.stats.total;
  $('focus-count').textContent = t('focus.today', { n: sessionsToday(state.stats, now) });
  $('focus-count').title = t('focus.total', { n: total });

  const progress = progressOf(timer, now);
  $('progress').setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  $('progress-fill').style.transform = `scaleX(${progress})`;
  renderHeatmap(state.stats, now);

  if (!timer.running) document.title = t('page.title');
  else {
    const left = document.hidden ? t('timer.minutes', { n: Math.ceil(seconds / 60) }) : formatClock(seconds);
    document.title = `${left} · ${t(MODE_LABEL[timer.mode])}`;
  }
}

function schedule(state) {
  clearTimeout(tickTimeout);
  if (!state.timer.running) return;
  const now = Date.now();
  const delay = document.hidden ? msUntilNextMinute(state.timer, now) : msUntilNextSecond(state.timer, now);
  tickTimeout = setTimeout(tick, delay);
}

function finish() {
  let finishedFocus = false;
  update((state) => {
    if (!isExpired(state.timer, Date.now())) return;
    const result = completeSession({ timer: state.timer, stats: state.stats, preset: presetOf(state) });
    finishedFocus = result.finishedFocus;
    state.stats = result.stats;
    state.timer = result.timer;
  });
  const message = t(finishedFocus ? 'timer.focusDone' : 'timer.breakDone');
  if (document.hidden) pendingMessage = message;
  else {
    announce(message);
    celebrate();
  }
}

function tick() {
  const state = getState();
  if (isExpired(state.timer, Date.now())) {
    finish(); // the update re-renders and reschedules through subscribe()
    return;
  }
  render(state);
  schedule(state);
}

export function syncAlarm() {
  const { timer, notify } = getState();
  syncTimerAlarm(timer, notify).catch(() => {});
}

// Minimal hides the panel: a start, pause or reset from a shortcut or a command shows it, with
// focus on its main button, so the result is visible and P, Space or Esc carry on from there.
function showTimer() {
  if (revealPanel('focus')) $('timer-toggle').focus();
}

export function toggleTimer() {
  showTimer();
  const now = Date.now();
  if (isExpired(getState().timer, now)) {
    finish();
    return;
  }
  update((state) => {
    state.timer = state.timer.running ? pauseTimer(state.timer, now) : startTimer(state.timer, now);
  });
  syncAlarm();
}

export function resetTimer() {
  showTimer();
  update((state) => {
    state.timer = readyTimer(state.timer.mode, presetOf(state));
  });
  syncAlarm();
}

function setMode(mode) {
  if (getState().timer.mode === mode) return;
  update((state) => {
    state.timer = readyTimer(mode, presetOf(state));
  });
  syncAlarm();
}

// A session already started keeps its length; the new preset applies from the next one.
// `custom` carries new durations for the custom preset.
export function applyPreset(presetId, custom) {
  const { timer, preset, customPreset } = getState();
  const sameCustom = !custom || (custom.focus === customPreset.focus && custom.break === customPreset.break);
  if (preset === presetId && sameCustom) return;
  const untouched = !timer.running && timer.remaining === timer.total;
  update((state) => {
    state.preset = presetId;
    if (custom) state.customPreset = custom;
    if (untouched) state.timer = readyTimer(state.timer.mode, presetOf(state));
  });
  if (!untouched) announce(t('timer.presetLater'));
}

export function initFocus() {
  $('timer-toggle').addEventListener('click', toggleTimer);
  $('timer-reset').addEventListener('click', resetTimer);
  $('focus-mode').addEventListener('click', () => setMode('focus'));
  $('break-mode').addEventListener('click', () => setMode('break'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pendingMessage) {
      announce(pendingMessage);
      celebrate();
      pendingMessage = null;
    }
    tick();
  });
  subscribe((state) => {
    render(state);
    schedule(state);
  });
  tick();
  const { timer, notify } = getState();
  ensureTimerAlarm(timer, notify).catch(() => {});
}
