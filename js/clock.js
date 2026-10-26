import { $ } from './dom.js';
import { dateFormat, t } from './i18n.js';
import { getState, subscribe } from './store.js';

// The big clock is always 24-hour: "2:05 PM" would not fit the layout.
const clockFormat = dateFormat({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const longDate = dateFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
let timeout;

function salutation(hour) {
  if (hour >= 5 && hour < 12) return t('greeting.morning');
  if (hour >= 12 && hour < 18) return t('greeting.afternoon');
  if (hour >= 18 && hour < 23) return t('greeting.evening');
  return t('greeting.night');
}

function renderGreeting() {
  const { name } = getState();
  const greeting = salutation(new Date().getHours());
  $('greeting').textContent = name
    ? t('greeting.named', { greeting, name })
    : t('greeting.plain', { greeting });
}

// One refresh per minute, aligned to the minute boundary; nothing runs while the tab is hidden.
function render() {
  const now = new Date();
  $('clock').textContent = clockFormat.format(now);
  $('date-label').textContent = longDate.format(now);
  renderGreeting();
  clearTimeout(timeout);
  if (!document.hidden) timeout = setTimeout(render, 60000 - (Date.now() % 60000) + 30);
}

export function initClock() {
  render();
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timeout);
    if (!document.hidden) render();
  });
  subscribe(renderGreeting);
}
