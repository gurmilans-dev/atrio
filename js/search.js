// Turns what the user typed into a destination. Pure function, covered by tests/search.test.js.
// Dotted code such as "console.log", "next.js" or "README.md" must stay a search:
// only real-looking hosts become URLs.
import { BANGS, ENGINES } from './config.js';
import { validTemplate, validURL } from './state.js';

// Common TLDs. Left out on purpose because they collide with file extensions:
// md, py, sh, rs, pl, cc, so, zip, mov.
const TLDS = new Set(
  (
    'com org net edu gov mil int io dev app ai co me it eu uk de fr es ch nl be at se no dk fi ' +
    'pt ie us ca mx br ar jp kr cn in au nz ru ua info biz xyz tech cloud site online page blog ' +
    'news tv fm gg ly to land run codes tools design studio live space world'
  ).split(' '),
);
// Development hosts: opened with http:// instead of https://.
const LOCAL_TLDS = new Set(['localhost', 'test', 'local', 'internal', 'lan']);

const HOST_LABELS = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63})$/i;
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function searchTarget(query, target) {
  const encoded = encodeURIComponent(query);
  // Built-in targets end where the query goes; personal prefixes mark the place with %s.
  const url = target.url.includes('%s') ? target.url.replaceAll('%s', encoded) : target.url + encoded;
  return { kind: 'search', url, label: target.label, query };
}

// Own keys only: "constructor" must not find Object.prototype.constructor.
const lookup = (table, key) => (Object.hasOwn(table, key) ? table[key] : null);

function isIPv4(host) {
  return IPV4.test(host) && host.split('.').every((part) => Number(part) <= 255);
}

// Returns "http", "https" or null when the text does not look like an address.
function schemeFor(input) {
  const [, hostPort] = input.match(/^([^/?#]+)(?:[/?#].*)?$/) ?? [];
  if (!hostPort) return null;
  if (/^\[[0-9a-f:.]+\](?::\d{1,5})?$/i.test(hostPort)) return 'http';
  const [, host, port] = hostPort.match(/^([^:]+)(?::(\d{1,5}))?$/) ?? [];
  if (!host) return null;
  const lower = host.toLowerCase();
  if (lower === 'localhost' || isIPv4(lower)) return 'http';
  const tld = lower.match(HOST_LABELS)?.[1];
  if (!tld) return null;
  if (LOCAL_TLDS.has(tld)) return 'http';
  if (TLDS.has(tld)) return 'https';
  // Unknown TLD with an explicit port: almost always a machine on the network.
  if (port) return 'http';
  return null;
}

/**
 * @param {string} raw text typed in the search box
 * @param {string} engine key of ENGINES used for plain searches
 * @param {{force?: boolean, prefixes?: Object<string, {label: string, url: string}>}} options
 *   force=true always searches (Shift+Enter); prefixes are the user's own, url with %s
 * @returns {{kind: 'url'|'browser'|'search', url: string, label?: string, query?: string} | null}
 */
export function resolveInput(raw, engine, { force = false, prefixes = {} } = {}) {
  const input = String(raw ?? '').trim();
  if (!input) return null;
  const defaultTarget = ENGINES[engine] ?? ENGINES.google;
  if (force) return searchTarget(input, defaultTarget);

  if (/^chrome:\/\/\S+$/i.test(input)) return { kind: 'browser', url: input };

  if (/^https?:\/\//i.test(input)) {
    const url = validURL(input);
    return url ? { kind: 'url', url } : searchTarget(input, defaultTarget);
  }

  const bang = input.match(/^!?([a-z][a-z0-9]*)(?:\s+(.+))?$/i);
  const key = bang?.[1].toLowerCase();
  const bangTarget = bang && (lookup(BANGS, key) ?? lookup(prefixes, key));
  if (bangTarget) {
    // A prefix alone ("yt", "!gh") opens the site itself instead of searching the prefix.
    if (!bang[2]) {
      const origin = new URL(bangTarget.url.replaceAll('%s', '')).origin;
      return { kind: 'url', url: `${origin}/`, label: bangTarget.label };
    }
    return searchTarget(bang[2].trim(), bangTarget);
  }

  if (!/\s/.test(input)) {
    const scheme = schemeFor(input);
    const url = scheme && validURL(`${scheme}://${input}`);
    if (url) return { kind: 'url', url };
  }
  return searchTarget(input, defaultTarget);
}

// Normalizes the URL of a personal prefix: "acme.atlassian.net/browse/%s" gets its https://.
export function resolvePrefixURL(raw) {
  const marker = 'atrioquery';
  const url = resolveLinkURL(String(raw ?? '').replaceAll('%s', marker));
  return url && validTemplate(url.replaceAll(marker, '%s'));
}

// Normalizes the URL field of the link form: "github.com/me" -> "https://github.com/me".
export function resolveLinkURL(raw) {
  const input = String(raw ?? '').trim();
  if (/^https?:\/\//i.test(input)) return validURL(input);
  const scheme = /\s/.test(input) ? null : schemeFor(input);
  return scheme ? validURL(`${scheme}://${input}`) : null;
}
