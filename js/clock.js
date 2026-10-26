import { $ } from './dom.js';
import { getState, subscribe } from './store.js';

const clockFormat = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
let timeout;

function salutation(hour) {
  if (hour >= 5 && hour < 12) return 'Buongiorno';
  if (hour >= 12 && hour < 18) return 'Buon pomeriggio';
  if (hour >= 18 && hour < 23) return 'Buonasera';
  return 'Buonanotte';
}

function renderGreeting() {
  const { name } = getState();
  const text = salutation(new Date().getHours());
  $('greeting').textContent = name ? `${text}, ${name}.` : `${text}.`;
}

// One refresh per minute, aligned to the minute boundary; nothing runs while the tab is hidden.
function render() {
  const now = new Date();
  $('clock').textContent = clockFormat.format(now);
  $('date-label').textContent = dateFormat.format(now);
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
