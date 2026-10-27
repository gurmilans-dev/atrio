import { $, el } from './dom.js';
import { dateFormat, t } from './i18n.js';
import { getState, subscribe } from './store.js';

const longDate = dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
let timeout;
// Hours and minutes are the big text; seconds and AM/PM (Settings → Page) sit beside them, smaller.
const time = document.createTextNode('');
const seconds = el('span', 'clock-seconds');
const period = el('span', 'clock-period');

const setText = (node, text) => {
  if (node.textContent !== text) node.textContent = text;
};

function salutation(hour) {
  if (hour >= 5 && hour < 12) return t('greeting.morning');
  if (hour >= 12 && hour < 18) return t('greeting.afternoon');
  if (hour >= 18 && hour < 23) return t('greeting.evening');
  return t('greeting.night');
}

function renderGreeting() {
  const { name } = getState();
  const greeting = salutation(new Date().getHours());
  setText($('greeting'), name ? t('greeting.named', { greeting, name }) : t('greeting.plain', { greeting }));
}

function renderTime(now, { hour12, seconds: withSeconds }) {
  const parts = dateFormat({
    hour: hour12 ? 'numeric' : '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hourCycle: hour12 ? 'h12' : 'h23',
  }).formatToParts(now);
  const minute = parts.findIndex((part) => part.type === 'minute');
  const second = parts.findIndex((part) => part.type === 'second');
  setText(
    time,
    parts
      .slice(0, minute + 1)
      .map((part) => part.value)
      .join(''),
  );
  setText(seconds, second > 0 ? parts[second - 1].value + parts[second].value : '');
  setText(period, parts.find((part) => part.type === 'dayPeriod')?.value ?? '');
  seconds.hidden = !seconds.textContent;
  period.hidden = !period.textContent;
}

// One refresh per minute (per second with the seconds shown), aligned to the boundary;
// nothing runs while the tab is hidden.
function render() {
  const now = new Date();
  const { clock } = getState();
  renderTime(now, clock);
  setText($('date-label'), longDate.format(now));
  renderGreeting();
  clearTimeout(timeout);
  if (document.hidden) return;
  const delay = clock.seconds ? 1000 - (Date.now() % 1000) + 20 : 60000 - (Date.now() % 60000) + 30;
  timeout = setTimeout(render, delay);
}

export function initClock() {
  $('clock').replaceChildren(time, seconds, period);
  render();
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timeout);
    if (!document.hidden) render();
  });
  subscribe(render);
}
