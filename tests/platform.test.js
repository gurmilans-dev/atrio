// The timer alarm (js/platform.js) against a fake chrome.alarms whose calls, as in Chrome, end later:
// whatever the order the calls finish in, the alarm left is the one for the latest timer.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const alarms = new Map();
const later = (value) => new Promise((resolve) => setTimeout(() => resolve(value), Math.random() * 5));
globalThis.chrome = {
  runtime: { id: 'test' },
  alarms: {
    clearAll: () => later().then(() => alarms.clear()),
    create: (name, { when }) => later().then(() => alarms.set(name, when)),
    get: (name) => later(alarms.has(name) ? { name } : undefined),
  },
};
const { ensureTimerAlarm, syncTimerAlarm } = await import('../js/platform.js');
const { getLanguage } = await import('../js/i18n.js');
const name = (mode) => `timer:${mode}:${getLanguage()}`; // the language follows the system's

const endAt = Date.now() + 25 * 60000;
const running = { mode: 'focus', running: true, endAt };
const paused = { mode: 'focus', running: false, endAt: null };
const left = () => Object.fromEntries(alarms);

beforeEach(() => alarms.clear());

test('start then pause in the same task leaves no alarm', async () => {
  await Promise.all([syncTimerAlarm(running, true), syncTimerAlarm(paused, true)]);
  assert.deepEqual(left(), {});
});

test('start then notifications off in the same task leaves no alarm', async () => {
  await Promise.all([syncTimerAlarm(running, true), syncTimerAlarm(running, false)]);
  assert.deepEqual(left(), {});
});

test('pause then start leaves the alarm of the session started', async () => {
  await Promise.all([syncTimerAlarm(paused, true), syncTimerAlarm(running, true)]);
  assert.deepEqual(left(), { [name('focus')]: endAt });
});

test('a change asked while a sync is running is applied after it', async () => {
  const first = syncTimerAlarm(running, true);
  await later(); // the first sync is under way
  const second = syncTimerAlarm(paused, true);
  await Promise.all([first, second]);
  await later(10);
  assert.deepEqual(left(), {});
});

test('many quick changes end with the last one', async () => {
  const calls = [];
  for (let i = 0; i < 20; i++) {
    calls.push(syncTimerAlarm(i % 2 ? paused : { ...running, mode: i % 3 ? 'focus' : 'break' }, true));
    if (i % 5 === 0) await later();
  }
  calls.push(syncTimerAlarm({ ...running, mode: 'break' }, true));
  await Promise.all(calls);
  await later(10);
  assert.deepEqual(left(), { [name('break')]: endAt });
});

test('a missing alarm is recreated, an existing one kept', async () => {
  await ensureTimerAlarm(running, true);
  assert.deepEqual(left(), { [name('focus')]: endAt });
  await ensureTimerAlarm(paused, true);
  assert.deepEqual(left(), { [name('focus')]: endAt });
});
