// Search box + command palette. Typing shows developer tools, recent searches, matching links,
// Google apps and commands under the box; ">" lists only commands, "+ text" adds a task. Enter
// runs the highlighted row (for tools: copies the result). An empty box shows recent searches,
// with none preselected. Online suggestions (js/suggest.js), when turned on, join plain searches
// after a short pause in typing.
import { appIcon } from './apps.js';
import { getCommands } from './commands.js';
import { BANGS, ENGINES, FALLBACK_SEARCH_URL } from './config.js';
import { runTools, toolName } from './devtools.js';
import { $, announce, el } from './dom.js';
import { fuzzyScore } from './fuzzy.js';
import { GOOGLE_APPS, appName, appURL } from './google-apps.js';
import { getLanguage, t } from './i18n.js';
import { hostOf, linkIcon } from './links.js';
import { hasOrigins, openBrowserPage, searchWithChrome } from './platform.js';
import { prefixTargets } from './prefixes.js';
import { addRecent, matchRecent } from './recent.js';
import { resolveInput } from './search.js';
import { SUGGEST_SOURCES, cachedSuggestions, fetchSuggestions, hasSuggestions } from './suggest.js';
import { getState, subscribe, update } from './store.js';
import { addTask } from './tasks.js';

// Stroke icons drawn like the rest of the interface (Unicode glyphs vary too much between fonts).
const ICON_PATHS = {
  search: 'M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0zm-1.5 5 5 5',
  url: 'M7 17 17 7M9 7h8v8',
  command: 'm10 7 5 5-5 5',
  task: 'M12 6v12M6 12h12',
  copy: 'M9 9h10v10H9zM15 9V5H5v10h4',
  error: 'M12 7v6m0 4h.01',
  recent: 'M12 7.5V12l3 2M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0z',
};
const SUGGEST_DELAY_MS = 150;
let items = [];
let active = 0;
let open = false;
let wantedQuery = null; // online suggestions to fetch for the current text
let suggestTimer = 0;
let suggestAbort = null;

const input = () => $('search-input');

function kindIcon(kind) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICON_PATHS[kind]);
  svg.append(path);
  const wrapper = el('span', 'result-icon');
  wrapper.append(svg);
  return wrapper;
}

export function focusSearch() {
  input().focus();
  input().select();
}

/** Opens the search box in command mode, like the palette of a code editor. */
export function openCommandPalette() {
  input().value = '>';
  input().focus();
  refresh();
}

async function navigate(result) {
  if (result.kind === 'search' && result.chrome) {
    if (await searchWithChrome(result.query).catch(() => false)) return;
    window.location.assign(FALLBACK_SEARCH_URL + encodeURIComponent(result.query));
    return;
  }
  if (result.kind !== 'browser') {
    window.location.assign(result.url);
    return;
  }
  const opened = await openBrowserPage(result.url).catch(() => false);
  if (!opened) announce(t('toast.chromeOnly'));
}

// What runs from the box is remembered (unless turned off in the settings) to be offered again.
function remember(text) {
  if (!getState().rememberSearches) return;
  update((state) => {
    state.recent = addRecent(state.recent, text);
  });
}

function forget(text) {
  update((state) => {
    state.recent = state.recent.filter((item) => item !== text);
  });
  announce(t('recent.removed'));
}

// Text a local tool answers (a token, JSON, Base64, a sum…): its rows come first. It is never sent
// to a search engine unless asked for explicitly, nor kept among the recent searches.
function isLocalTool(text) {
  try {
    return runTools(text.trim()).some((row) => row.first);
  } catch {
    return false;
  }
}

function runText(text, force = false) {
  const state = getState();
  const result = resolveInput(text, state.engine, { force, prefixes: prefixTargets(state) });
  if (!result) return;
  if (!isLocalTool(text)) remember(text);
  navigate(result);
}

function go(force) {
  runText(input().value, force);
}

function rank(list, toText, query, max, subsequence) {
  return list
    .map((item) => ({ item, score: fuzzyScore(query, toText(item), { subsequence }) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ item }) => item);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    announce(t('toast.copied', { text: text.length > 48 ? `${text.slice(0, 48)}…` : text }));
  } catch {
    announce(t('toast.copyFailed'));
  }
}

// Tool rows stay open after Enter, so another format can be copied right away.
function toolItem(result) {
  const icon = result.color
    ? el('span', 'result-icon swatch-icon')
    : kindIcon(result.error ? 'error' : 'copy');
  if (result.color) icon.style.setProperty('--sample', result.color);
  return {
    kind: 'tool',
    tool: result.tool,
    first: result.first,
    mono: !result.error,
    keepOpen: true,
    label: result.value,
    detail: result.error ? toolName(result.tool) : `${result.detail} · ${t('result.copyHint')}`,
    icon,
    run: () => (result.error ? announce(result.value) : copy(result.value)),
  };
}

const commandText = (command) => `${command.label} ${command.keywords ?? ''}`;
const commandItem = (command) => ({
  kind: 'command',
  label: command.label,
  detail: t('result.command'),
  key: command.key,
  run: command.run,
});

// "Search the web" for Chrome's own provider (Atrio does not know its name), "Search Google" otherwise.
const searchDetail = (label) => (label ? t('result.searchOn', { target: label }) : t('result.searchWeb'));

function primaryItem(result, text) {
  const run = () => runText(text);
  if (result.kind === 'search') {
    return {
      kind: 'search',
      label: result.query,
      detail: searchDetail(result.label),
      run,
    };
  }
  return {
    kind: 'url',
    label: result.label ?? result.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    detail: t(result.kind === 'browser' ? 'result.chromePage' : 'result.openSite'),
    run,
  };
}

const recentItem = (text) => ({
  kind: 'recent',
  label: text,
  detail: t('result.recent'),
  run: () => runText(text),
});

// A suggestion is always searched, even when it looks like an address.
const suggestionItem = (text) => ({
  kind: 'search',
  label: text,
  detail: searchDetail(ENGINES[getState().engine].label),
  run: () => runText(text, true),
});

// Online suggestions are for plain searches on the chosen engine: not for prefixes, addresses or
// tools. Without an answer in the cache, the query is left for scheduleSuggestions().
function onlineSuggestions(state, primary, explicitTool, shown) {
  const plain = primary?.kind === 'search' && primary.label === ENGINES[state.engine].label;
  const query = plain ? primary.query : '';
  if (!state.suggest || explicitTool || query.length < 2 || !hasSuggestions(state.engine)) return [];
  const cached = cachedSuggestions(state.engine, query);
  if (!cached) {
    wantedQuery = query;
    return [];
  }
  const taken = new Set(shown.map((text) => text.toLowerCase()));
  return cached.filter((text) => !taken.has(text.toLowerCase()));
}

function buildItems(value) {
  const text = value.trim();
  wantedQuery = null;
  if (!text) return matchRecent(getState().recent, '', 5).map(recentItem);
  if (text.startsWith('>')) return rank(getCommands(), commandText, text.slice(1), 20, true).map(commandItem);
  // "+ text" adds a task, unless tasks are hidden (Settings → Page): then it is a plain search.
  if (text.startsWith('+') && getState().show.tasks) {
    const task = text.slice(1).trim();
    if (!task) return [];
    return [
      {
        kind: 'task',
        label: task,
        detail: t('result.addTask'),
        run: () => {
          if (addTask(task)) announce(t('toast.taskAdded'));
        },
      },
    ];
  }

  const state = getState();
  // A failing tool must not break the search box: it is logged and shows no rows.
  let tools = [];
  try {
    tools = runTools(text).map(toolItem);
  } catch (error) {
    console.error(error);
  }
  // Explicit tool keywords ("= 2^10", "uuid") go above the web search, guesses below it.
  const explicitTool = tools.some((tool) => tool.first);
  const primary = resolveInput(text, state.engine, { prefixes: prefixTargets(state) });
  const recents = explicitTool ? [] : matchRecent(state.recent, text, 3);
  const list = [
    ...tools.filter((tool) => tool.first),
    primaryItem(primary, text),
    ...tools.filter((tool) => !tool.first),
    // Recent searches, then online suggestions, right under the typed one, as in the address bar.
    ...recents.map(recentItem),
    ...onlineSuggestions(state, primary, explicitTool, [text, ...recents]).map(suggestionItem),
  ];
  if (text.length >= 2) {
    const links = rank(state.links, (link) => `${link.name} ${hostOf(link.url)}`, text, 5, true);
    for (const link of links) {
      list.push({
        kind: 'link',
        label: link.name,
        detail: hostOf(link.url),
        icon: linkIcon(link, state.showFavicons),
        run: () => window.location.assign(link.url),
      });
    }
    if (state.apps.visible) {
      const language = getLanguage();
      const apps = rank(
        GOOGLE_APPS,
        (app) => `${appName(app, language)} ${app.name} ${app.keywords}`,
        text,
        3,
        false,
      );
      for (const app of apps) {
        list.push({
          kind: 'link',
          label: appName(app, language),
          detail: 'Google',
          icon: appIcon(app),
          run: () => window.location.assign(appURL(app, state.apps.account)),
        });
      }
    }
    // Plain searches only show commands that really contain the words typed.
    list.push(...rank(getCommands(), commandText, text, 3, false).map(commandItem));
  }
  return list;
}

function highlight(scroll = true) {
  const rows = $('search-results').children;
  for (let index = 0; index < rows.length; index++) {
    rows[index].classList.toggle('active', index === active);
    rows[index].setAttribute('aria-selected', String(index === active));
  }
  if (active >= 0) input().setAttribute('aria-activedescendant', `result-${active}`);
  else input().removeAttribute('aria-activedescendant');
  if (scroll) rows[active]?.scrollIntoView({ block: 'nearest' });
}

function render() {
  const list = $('search-results');
  list.hidden = !open;
  input().setAttribute('aria-expanded', String(open));
  $('search-form').classList.toggle('has-results', open);
  if (!open) {
    list.replaceChildren();
    input().removeAttribute('aria-activedescendant');
    return;
  }
  list.replaceChildren(
    ...items.map((item, index) => {
      const row = el('li', 'result');
      row.id = `result-${index}`;
      row.dataset.index = String(index);
      row.setAttribute('role', 'option');
      const text = el('span', 'result-text');
      const label = el('span', item.mono ? 'result-label mono' : 'result-label', item.label);
      // Long results (a JWT payload, a hash) are cut with an ellipsis: hovering shows them whole.
      if (item.kind === 'tool') label.title = item.label;
      text.append(label, el('span', 'result-detail', item.detail));
      row.append(item.icon ?? kindIcon(item.kind), text);
      if (item.key) row.append(el('kbd', 'result-key', item.key));
      return row;
    }),
  );
  highlight();
}

function refresh() {
  const text = input().value.trim();
  items = buildItems(text);
  // With nothing typed only recent searches show and none is preselected, so Enter does nothing.
  active = text ? 0 : -1;
  // A plain search with nothing else to suggest needs no dropdown: the hint chip is enough.
  open =
    document.activeElement === input() &&
    items.length > 0 &&
    (!text || /^[>+]/.test(text) || items.length > 1);
  render();
  renderHint();
  scheduleSuggestions(wantedQuery);
}

// Asks for suggestions after a short pause in typing; every newer keystroke cancels the request.
function scheduleSuggestions(query) {
  clearTimeout(suggestTimer);
  suggestAbort?.abort();
  suggestAbort = null;
  if (!query) return;
  suggestTimer = setTimeout(async () => {
    const { engine } = getState();
    const controller = new AbortController();
    suggestAbort = controller;
    try {
      if (!(await hasOrigins([SUGGEST_SOURCES[engine].origin]))) return;
      await fetchSuggestions(engine, query, getLanguage(), controller.signal);
    } catch {
      return; // offline, blocked or cancelled: the box simply works without them
    }
    // Rows are never inserted under someone already moving through the list.
    if (!controller.signal.aborted && document.activeElement === input() && active <= 0) refresh();
  }, SUGGEST_DELAY_MS);
}

function close() {
  open = false;
  scheduleSuggestions(null);
  render();
}

function execute(index) {
  const item = items[index];
  if (!item) return;
  if (item.keepOpen) {
    item.run();
    return;
  }
  input().value = '';
  items = [];
  close();
  renderHint();
  item.run();
}

// Shows where Enter will go: a tool, a prefix target, a site, or a chrome:// page.
function renderHint() {
  const state = getState();
  const { engine } = state;
  const value = input().value.trim();
  let text = '';
  if (value.startsWith('>')) text = t('hint.commands');
  else if (value.startsWith('+')) text = t('hint.task');
  else if (value && items[0]?.kind === 'tool') text = `⧉ ${toolName(items[0].tool)}`;
  else if (value) {
    const result = resolveInput(value, engine, { prefixes: prefixTargets(state) });
    if (result?.kind === 'url') text = result.label ? `↗ ${result.label}` : t('hint.openSite');
    else if (result?.kind === 'browser') text = t('hint.chromePage');
    else if (result?.kind === 'search' && result.label !== ENGINES[engine].label) text = `→ ${result.label}`;
  }
  const hint = $('search-hint');
  if (hint.textContent !== text) hint.textContent = text;
  hint.hidden = !text;
  // The "/" key only invites to an empty box; with text the × to clear it takes its place.
  const empty = !input().value;
  $('search-clear').hidden = empty;
  $('search-key').hidden = !empty || Boolean(text);
}

function clearSearch() {
  input().value = '';
  input().focus();
  refresh();
}

function renderTips() {
  const tips = $('search-tips');
  tips.append(t('tips.prefixes'));
  for (const [key, target] of Object.entries(BANGS)) {
    const code = el('code', '', key);
    code.title = target.label;
    tips.append(' ', code);
  }
  tips.append(
    ' · ',
    el('code', '', '>'),
    ` ${t('tips.commands')} · `,
    el('code', '', '+'),
    ` ${t('tips.tasks')}`,
  );
  tips.append(` · ${t('tips.tools')}`);
  for (const tool of ['=', 'ts', 'uuid', 'b64', 'url', 'pw', '#hex']) tips.append(' ', el('code', '', tool));
  tips.append(
    ' · ',
    el('kbd', '', 'Shift'),
    '+',
    el('kbd', '', t('key.enter')),
    ` ${t('tips.alwaysSearch')}`,
  );
}

export function initSearch() {
  const select = $('search-engine');
  select.replaceChildren(
    ...Object.entries(ENGINES).map(([id, engine]) => {
      const option = el('option', '', engine.label ?? t(`engine.${id}`));
      option.value = id;
      return option;
    }),
  );
  renderTips();

  const box = input();
  box.addEventListener('input', refresh);
  box.addEventListener('focus', refresh);
  box.addEventListener('blur', close);
  box.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      go(true);
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      if (active < 0) active = step > 0 ? 0 : items.length - 1;
      else active = (active + step + items.length) % items.length;
      highlight();
    } else if (event.key === 'Delete' && event.shiftKey && items[active]?.kind === 'recent') {
      event.preventDefault(); // Shift+Delete, as in the address bar
      forget(items[active].label);
    } else if (event.key === 'Escape') {
      event.preventDefault(); // the first Esc closes the list, the second leaves the field
      close();
    }
  });
  $('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (open && active >= 0) {
      execute(active);
      return;
    }
    const text = box.value.trim();
    if (text.startsWith('>')) {
      announce(t('toast.noCommand'));
      return;
    }
    // A local tool's input stays local whatever closed its rows (Esc, the → button, a click
    // elsewhere): Enter brings them back. Only Shift+Enter, an explicit choice, searches it.
    if (isLocalTool(text) || (text.startsWith('+') && getState().show.tasks)) {
      box.focus();
      refresh();
      return;
    }
    go(false);
  });

  $('search-clear').addEventListener('mousedown', (event) => event.preventDefault()); // keep focus in the box
  $('search-clear').addEventListener('click', clearSearch);

  const list = $('search-results');
  list.addEventListener('mousedown', (event) => event.preventDefault()); // keep focus in the box
  list.addEventListener('click', (event) => {
    const row = event.target.closest('.result');
    if (row) execute(Number(row.dataset.index));
  });
  list.addEventListener('pointermove', (event) => {
    const row = event.target.closest('.result');
    if (!row || Number(row.dataset.index) === active) return;
    active = Number(row.dataset.index);
    highlight(false);
  });

  select.addEventListener('change', () => {
    update((state) => {
      state.engine = select.value;
    });
  });

  const sync = (state) => {
    select.value = state.engine;
    if (open) refresh();
    else renderHint();
  };
  sync(getState());
  subscribe(sync);
}
