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
export async function syncTimerAlarm(timer, enabled) {
  if (!ext?.alarms) return;
  await ext.alarms.clearAll();
  if (enabled && timer.running && timer.endAt > Date.now()) {
    await ext.alarms.create(alarmName(timer.mode), { when: timer.endAt });
  }
}

// Alarms are dropped when the extension reloads: recreate the one we expect, if missing.
export async function ensureTimerAlarm(timer, enabled) {
  if (!ext?.alarms || !enabled || !timer.running || timer.endAt <= Date.now()) return;
  if (!(await ext.alarms.get(alarmName(timer.mode)))) await syncTimerAlarm(timer, enabled);
}

// Pages cannot navigate to chrome:// URLs themselves, the tabs API can (no permission needed).
export async function openBrowserPage(url) {
  if (!ext?.tabs) return false;
  const tab = await ext.tabs.getCurrent();
  if (tab?.id !== undefined) await ext.tabs.update(tab.id, { url });
  else await ext.tabs.create({ url });
  return true;
}
