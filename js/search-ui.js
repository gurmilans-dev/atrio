// Search box + command palette. Typing shows matching links, Google apps and commands under
// the box; ">" lists only commands, "+ text" adds a task. Enter runs the highlighted row.
import { appIcon } from './apps.js';
import { getCommands } from './commands.js';
import { BANGS, ENGINES } from './config.js';
import { $, announce, el } from './dom.js';
import { fuzzyScore } from './fuzzy.js';
import { GOOGLE_APPS, appURL } from './google-apps.js';
import { hostOf, linkIcon } from './links.js';
import { openBrowserPage } from './platform.js';
import { resolveInput } from './search.js';
import { getState, subscribe, update } from './store.js';
import { addTask } from './tasks.js';

// Stroke icons drawn like the rest of the interface (Unicode glyphs vary too much between fonts).
const ICON_PATHS = {
  search: 'M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0zm-1.5 5 5 5',
  url: 'M7 17 17 7M9 7h8v8',
  command: 'm10 7 5 5-5 5',
  task: 'M12 6v12M6 12h12',
};
let items = [];
let active = 0;
let open = false;

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
  if (result.kind !== 'browser') {
    window.location.assign(result.url);
    return;
  }
  const opened = await openBrowserPage(result.url).catch(() => false);
  if (!opened) announce('Le pagine chrome:// si aprono solo dall’estensione installata.');
}

function go(force) {
  const result = resolveInput(input().value, getState().engine, { force });
  if (result) navigate(result);
}

function rank(list, toText, query, max, subsequence) {
  return list
    .map((item) => ({ item, score: fuzzyScore(query, toText(item), { subsequence }) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ item }) => item);
}

const commandText = (command) => `${command.label} ${command.keywords ?? ''}`;
const commandItem = (command) => ({
  kind: 'command',
  label: command.label,
  detail: 'Comando',
  key: command.key,
  run: command.run,
});

function primaryItem(result) {
  if (result.kind === 'search') {
    return {
      kind: 'search',
      label: result.query,
      detail: `Cerca su ${result.label}`,
      run: () => navigate(result),
    };
  }
  return {
    kind: 'url',
    label: result.label ?? result.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    detail: result.kind === 'browser' ? 'Pagina di Chrome' : 'Apri sito',
    run: () => navigate(result),
  };
}

function buildItems(value) {
  const text = value.trim();
  if (!text) return [];
  if (text.startsWith('>')) return rank(getCommands(), commandText, text.slice(1), 20, true).map(commandItem);
  if (text.startsWith('+')) {
    const task = text.slice(1).trim();
    if (!task) return [];
    return [
      {
        kind: 'task',
        label: task,
        detail: 'Aggiungi attività',
        run: () => {
          if (addTask(task)) announce('Attività aggiunta.');
        },
      },
    ];
  }

  const state = getState();
  const list = [primaryItem(resolveInput(text, state.engine))];
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
      const apps = rank(GOOGLE_APPS, (app) => `${app.name} ${app.keywords}`, text, 3, false);
      for (const app of apps) {
        list.push({
          kind: 'link',
          label: app.name,
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
  input().setAttribute('aria-activedescendant', `result-${active}`);
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
      text.append(el('span', 'result-label', item.label), el('span', 'result-detail', item.detail));
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
  active = 0;
  // A plain search with nothing else to suggest needs no dropdown: the hint chip is enough.
  open = document.activeElement === input() && items.length > 0 && (/^[>+]/.test(text) || items.length > 1);
  render();
  renderHint();
}

function close() {
  open = false;
  render();
}

function execute(index) {
  const item = items[index];
  if (!item) return;
  input().value = '';
  items = [];
  close();
  renderHint();
  item.run();
}

// Shows where Enter will go: a prefix target, a site, or a chrome:// page.
function renderHint() {
  const { engine } = getState();
  const value = input().value.trim();
  let text = '';
  if (value.startsWith('>')) text = '› comandi';
  else if (value.startsWith('+')) text = '+ attività';
  else if (value) {
    const result = resolveInput(value, engine);
    if (result?.kind === 'url') text = result.label ? `↗ ${result.label}` : '↗ apri sito';
    else if (result?.kind === 'browser') text = '↗ pagina Chrome';
    else if (result?.kind === 'search' && result.label !== ENGINES[engine].label) text = `→ ${result.label}`;
  }
  const hint = $('search-hint');
  if (hint.textContent !== text) hint.textContent = text;
  hint.hidden = !text;
  $('search-key').hidden = Boolean(text);
}

function renderTips() {
  const tips = $('search-tips');
  tips.append('Prefissi:');
  for (const [key, target] of Object.entries(BANGS)) {
    const code = el('code', '', key);
    code.title = target.label;
    tips.append(' ', code);
  }
  tips.append(' · ', el('code', '', '>'), ' comandi · ', el('code', '', '+'), ' attività · ');
  tips.append(el('kbd', '', 'Shift'), '+', el('kbd', '', 'Invio'), ' cerca sempre');
}

export function initSearch() {
  const select = $('search-engine');
  select.replaceChildren(
    ...Object.entries(ENGINES).map(([id, engine]) => {
      const option = el('option', '', engine.label);
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
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      highlight();
    } else if (event.key === 'Escape') {
      event.preventDefault(); // the first Esc closes the list, the second leaves the field
      close();
    }
  });
  $('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (open) execute(active);
    else if (box.value.trim().startsWith('>')) announce('Nessun comando trovato.');
    else go(false);
  });

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
