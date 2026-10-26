// Event-driven service worker: it sleeps until a timer alarm fires, then shows a notification.
// The new tab page schedules the alarm (js/platform.js) when a session starts.
const NOTIFICATION_ID = 'atrio-timer';
const MESSAGES = {
  focus: {
    title: 'Sessione di focus completata',
    message: 'Ottimo lavoro. La pausa è pronta: apri una nuova scheda per avviarla.',
  },
  break: {
    title: 'Pausa finita',
    message: 'Pronto per la prossima sessione di focus?',
  },
};
// Chrome fires missed alarms at startup: skip sessions that ended long ago.
const STALE_AFTER_MS = 2 * 60 * 1000;

chrome.alarms.onAlarm.addListener((alarm) => {
  const [kind, mode] = alarm.name.split(':');
  const text = MESSAGES[mode];
  if (kind !== 'timer' || !text) return;
  if (Date.now() - alarm.scheduledTime > STALE_AFTER_MS) return;
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'assets/icons/icon-128.png',
    title: text.title,
    message: text.message,
    priority: 2,
  });
});

chrome.notifications.onClicked.addListener((id) => {
  if (id !== NOTIFICATION_ID) return;
  chrome.notifications.clear(id);
  chrome.tabs.create({});
});
