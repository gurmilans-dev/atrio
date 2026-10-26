// Quick links: the grid on the page and the management list in settings.
import { LIMITS } from './config.js';
import { $, announce, button, el } from './dom.js';
import { faviconURL } from './platform.js';
import { resolveLinkURL } from './search.js';
import { getState, subscribe, update } from './store.js';

let renderedKey = '';
let editingId = null;

export const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '');
const monogram = (link) => (link.symbol || link.name.slice(0, 2)).toUpperCase();

export function linkIcon(link, showFavicons) {
  const icon = el('span', 'link-icon');
  const src = showFavicons ? faviconURL(link.url) : null;
  if (!src) {
    icon.textContent = monogram(link);
    return icon;
  }
  const image = el('img');
  image.src = src;
  image.alt = '';
  image.width = 18;
  image.height = 18;
  image.decoding = 'async';
  image.addEventListener(
    'error',
    () => {
      icon.classList.remove('has-favicon');
      image.replaceWith(monogram(link));
    },
    { once: true },
  );
  icon.classList.add('has-favicon');
  icon.append(image);
  return icon;
}

function renderGrid(state) {
  const anchors = state.links.map((link, index) => {
    const anchor = el('a', 'shortcut glow');
    anchor.href = link.url;
    anchor.title = link.url;
    anchor.rel = 'noreferrer';
    const info = el('span', 'link-info');
    info.append(el('span', 'link-name', link.name), el('span', 'link-host', hostOf(link.url)));
    let hint;
    if (index < 9) {
      anchor.setAttribute('aria-keyshortcuts', String(index + 1));
      hint = el('kbd', 'link-key', String(index + 1));
      hint.setAttribute('aria-hidden', 'true');
    } else {
      hint = el('span', 'shortcut-arrow', '↗');
    }
    anchor.append(linkIcon(link, state.showFavicons), info, hint);
    return anchor;
  });
  $('links').replaceChildren(...anchors);
  $('link-count').textContent = String(state.links.length).padStart(2, '0');
  $('links-empty').hidden = state.links.length > 0;
}

function renderManagement(state) {
  const last = state.links.length - 1;
  const rows = state.links.map((link, index) => {
    const row = el('div', link.id === editingId ? 'settings-link editing' : 'settings-link');
    row.dataset.id = link.id;
    const name = el('span', 'settings-link-name', link.name);
    name.append(el('small', '', hostOf(link.url)));
    const actions = el('div', 'row-actions');
    const up = button('icon-action', '↑', `Sposta su: ${link.name}`);
    up.dataset.action = 'up';
    up.disabled = index === 0;
    const down = button('icon-action', '↓', `Sposta giù: ${link.name}`);
    down.dataset.action = 'down';
    down.disabled = index === last;
    const edit = button('text-action', 'Modifica', `Modifica: ${link.name}`);
    edit.dataset.action = 'edit';
    const remove = button('text-action danger', 'Rimuovi', `Rimuovi: ${link.name}`);
    remove.dataset.action = 'remove';
    actions.append(up, down, edit, remove);
    row.append(name, actions);
    return row;
  });
  $('settings-links').replaceChildren(...rows);
}

function render(state) {
  if (editingId && !state.links.some((link) => link.id === editingId)) resetForm();
  $('favicon-toggle').checked = state.showFavicons;
  const key = JSON.stringify([state.links, state.showFavicons, editingId]);
  if (key === renderedKey) return;
  renderedKey = key;
  renderGrid(state);
  renderManagement(state);
}

function resetForm() {
  editingId = null;
  $('link-form').reset();
  $('link-submit').textContent = 'Aggiungi collegamento';
  $('link-cancel').hidden = true;
}

function startEditing(id) {
  const link = getState().links.find((item) => item.id === id);
  if (!link) return;
  editingId = id;
  $('link-name').value = link.name;
  $('link-url').value = link.url;
  $('link-symbol').value = link.symbol ?? '';
  $('link-submit').textContent = 'Salva modifiche';
  $('link-cancel').hidden = false;
  render(getState());
  $('link-name').focus();
}

function focusRow(id, preferredAction) {
  const row = $('settings-links').querySelector(`[data-id="${CSS.escape(id)}"]`);
  const preferred = row?.querySelector(`[data-action="${preferredAction}"]`);
  (preferred && !preferred.disabled ? preferred : row?.querySelector('button:not(:disabled)'))?.focus();
}

function moveLink(id, delta) {
  update((state) => {
    const from = state.links.findIndex((link) => link.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= state.links.length) return;
    const [link] = state.links.splice(from, 1);
    state.links.splice(to, 0, link);
  });
  focusRow(id, delta < 0 ? 'up' : 'down');
}

function removeLink(id) {
  const links = getState().links;
  const index = links.findIndex((link) => link.id === id);
  if (index < 0) return;
  const link = links[index];
  const next = links[index + 1] ?? links[index - 1];
  if (editingId === id) resetForm();
  update((state) => {
    state.links = state.links.filter((item) => item.id !== id);
  });
  if (next) focusRow(next.id, 'remove');
  else $('link-name').focus();
  announce(`“${link.name}” rimosso.`, {
    label: 'Annulla',
    run: () =>
      update((state) => {
        if (state.links.some((item) => item.id === id) || state.links.length >= LIMITS.links) return;
        state.links.splice(Math.min(index, state.links.length), 0, link);
      }),
  });
}

function submitForm(event) {
  event.preventDefault();
  const name = $('link-name').value.trim().slice(0, LIMITS.linkName);
  const url = resolveLinkURL($('link-url').value);
  const symbol = $('link-symbol').value.trim().slice(0, LIMITS.linkSymbol);
  if (!name) {
    $('link-name').focus();
    return;
  }
  if (!url) {
    announce('URL non valido: usa un indirizzo http o https.');
    $('link-url').focus();
    return;
  }

  if (editingId) {
    const id = editingId;
    update((state) => {
      const link = state.links.find((item) => item.id === id);
      if (!link) return;
      link.name = name;
      link.url = url;
      if (symbol) link.symbol = symbol;
      else delete link.symbol;
    });
    resetForm();
    render(getState());
    focusRow(id, 'edit');
    announce('Collegamento aggiornato.');
    return;
  }

  if (getState().links.length >= LIMITS.links) {
    announce(`Massimo ${LIMITS.links} collegamenti.`);
    return;
  }
  const link = { id: crypto.randomUUID(), name, url };
  if (symbol) link.symbol = symbol;
  update((state) => {
    state.links.push(link);
  });
  $('link-form').reset();
  $('link-name').focus();
  announce('Collegamento aggiunto.');
}

/** Opens the link at position `index` (0-based); used by the 1–9 shortcuts. */
export function openLink(index) {
  const link = getState().links[index];
  if (link) window.location.assign(link.url);
}

export function initLinks() {
  $('settings-links').addEventListener('click', (event) => {
    const target = event.target.closest('button[data-action]');
    if (!target) return;
    const { id } = target.closest('[data-id]').dataset;
    const { action } = target.dataset;
    if (action === 'edit') startEditing(id);
    else if (action === 'remove') removeLink(id);
    else moveLink(id, action === 'up' ? -1 : 1);
  });
  $('link-form').addEventListener('submit', submitForm);
  $('link-cancel').addEventListener('click', () => {
    const id = editingId;
    resetForm();
    render(getState());
    if (id) focusRow(id, 'edit');
  });
  $('favicon-toggle').addEventListener('change', (event) => {
    update((state) => {
      state.showFavicons = event.target.checked;
    });
  });
  render(getState());
  subscribe(render);
}
