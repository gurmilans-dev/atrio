// Thin wrappers around chrome.* APIs. Each one degrades gracefully when the page
// is opened outside the extension (e.g. from a local web server while developing).
const ext = globalThis.chrome?.runtime?.id ? globalThis.chrome : null;

export const isExtension = Boolean(ext);

export const appVersion = () => (ext ? ext.runtime.getManifest().version : 'dev');

// Chrome's local favicon cache: no request leaves the browser.
export function faviconURL(pageUrl, size = 32) {
  if (!ext) return null;
  const url = new URL(ext.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.href;
}

import { getLanguage } from './i18n.js';

// The service worker cannot read the page's storage: the alarm name carries the language.
const alarmName = (mode) => `timer:${mode}:${getLanguage()}`;

// The service worker (background.js) shows a notification when the alarm fires.
// Syncs run one at a time (in every tab, under a lock) and each applies the latest timer asked for:
// two quick calls, such as start then pause, can no longer finish in the wrong order and leave the
// first one's alarm behind.
let wanted = null; // the latest { timer, enabled } not applied yet
let syncing = null;
const exclusive = (task) =>
  globalThis.navigator?.locks ? navigator.locks.request('atrio-alarm', task) : task();

export function syncTimerAlarm(timer, enabled) {
  if (!ext?.alarms) return Promise.resolve();
  wanted = { timer, enabled };
  syncing ??= exclusive(async () => {
    while (wanted) {
      const next = wanted;
      wanted = null;
      await ext.alarms.clearAll();
      if (next.enabled && next.timer.running && next.timer.endAt > Date.now()) {
        await ext.alarms.create(alarmName(next.timer.mode), { when: next.timer.endAt });
      }
    }
  }).finally(() => {
    syncing = null;
    if (wanted) syncTimerAlarm(wanted.timer, wanted.enabled).catch(() => {}); // asked meanwhile
  });
  return syncing;
}

// Alarms are dropped when the extension reloads: recreate the one we expect, if missing.
export async function ensureTimerAlarm(timer, enabled) {
  if (!ext?.alarms || !enabled || !timer.running || timer.endAt <= Date.now()) return;
  if (!(await ext.alarms.get(alarmName(timer.mode)))) await syncTimerAlarm(timer, enabled);
}

// Optional host access, for online search suggestions. request() must run inside the click that
// asked for it. Outside the extension there is nothing to ask.
export async function hasOrigins(origins) {
  return ext?.permissions ? ext.permissions.contains({ origins }) : true;
}
export async function requestOrigins(origins) {
  return ext?.permissions ? ext.permissions.request({ origins }) : true;
}
export async function removeOrigins(origins) {
  if (ext?.permissions) await ext.permissions.remove({ origins });
}

// Searches with the provider set in Chrome, in this tab (Search API; "search" permission). Returns
// false outside the extension, where the caller falls back to a search URL.
export async function searchWithChrome(text) {
  if (!ext?.search) return false;
  await ext.search.query({ text, disposition: 'CURRENT_TAB' });
  return true;
}

// Pages cannot navigate to chrome:// URLs themselves, the tabs API can (no permission needed).
export async function openBrowserPage(url) {
  if (!ext?.tabs) return false;
  const tab = await ext.tabs.getCurrent();
  if (tab?.id !== undefined) await ext.tabs.update(tab.id, { url });
  else await ext.tabs.create({ url });
  return true;
}
