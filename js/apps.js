// Google apps launcher: a native popover (light dismiss, Esc and top layer for free) opened
// by the grid button in the top-right corner or with G. Favorites are editable: in edit
// mode a tile toggles its favorite state, favorites reorder by drag or Ctrl + ← / →.
import { $, button, el } from './dom.js';
import { GOOGLE_APPS, appURL } from './google-apps.js';
import { getState, subscribe, update } from './store.js';

const ACCOUNTS = 4;
const SVG_NS = 'http://www.w3.org/2000/svg';
const byId = new Map(GOOGLE_APPS.map((app) => [app.id, app]));
let editing = false;
let renderedKey = '';
let dragged = null;
let iconCount = 0;

const panel = () => $('apps-panel');
const isOpen = () => panel().matches(':popover-open');

/** Builds an app icon as inline SVG; gradient ids are made unique per icon. */
export function appIcon(app) {
  const uid = `app-${app.id}-${++iconCount}`;
  const build = ([tag, attributes, children]) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) {
      const text =
        key === 'id' ? `${uid}-${value}` : String(value).replace(/url\(#([\w-]+)\)/, `url(#${uid}-$1)`);
      node.setAttribute(key, text);
    }
    if (typeof children === 'string') {
      node.textContent = children.replace('{day}', String(new Date().getDate()));
    } else if (children) {
      node.append(...children.map(build));
    }
    return node;
  };
  return build(['svg', { viewBox: '0 0 24 24', class: 'app-icon', 'aria-hidden': 'true' }, app.icon]);
}

function tile(app, account, favorite) {
  if (!editing) {
    const link = el('a', 'app');
    link.href = appURL(app, account);
    link.rel = 'noreferrer';
    link.dataset.id = app.id;
    link.append(appIcon(app), el('span', 'app-name', app.name));
    return link;
  }
  const node = button(
    'app',
    undefined,
    favorite ? `Togli ${app.name} dai preferiti` : `Aggiungi ${app.name} ai preferiti`,
  );
  node.dataset.id = app.id;
  node.setAttribute('aria-pressed', String(favorite));
  node.draggable = favorite;
  node.append(appIcon(app), el('span', 'app-name', app.name), el('span', 'app-badge', favorite ? '−' : '+'));
  return node;
}

function render(state, force = false) {
  const { apps } = state;
  document.documentElement.toggleAttribute('data-apps-off', !apps.visible);
  if (!apps.visible && isOpen()) panel().hidePopover();

  const key = JSON.stringify([apps, editing]);
  if (key === renderedKey && !force) return;
  renderedKey = key;

  // Keep focus on the same tile when it moves between sections.
  const focusedId = panel().contains(document.activeElement) ? document.activeElement.dataset.id : null;
  const favorites = apps.favorites.map((id) => byId.get(id));
  const others = GOOGLE_APPS.filter((app) => !apps.favorites.includes(app.id));
  $('apps-favorites').replaceChildren(...favorites.map((app) => tile(app, apps.account, true)));
  $('apps-others').replaceChildren(...others.map((app) => tile(app, apps.account, false)));
  $('apps-favorites-empty').hidden = favorites.length > 0;
  panel().classList.toggle('editing', editing);
  $('apps-edit').setAttribute('aria-pressed', String(editing));
  $('apps-edit').title = editing ? 'Fine' : 'Modifica i preferiti';
  for (const pick of $('account-picks').children) {
    pick.setAttribute('aria-pressed', String(Number(pick.dataset.account) === apps.account));
  }
  if (focusedId) panel().querySelector(`[data-id="${focusedId}"]`)?.focus();
}

function setFavorites(ids) {
  update((state) => {
    state.apps.favorites = ids;
  });
}

function toggleFavorite(id) {
  const { favorites } = getState().apps;
  setFavorites(favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id]);
}

function moveFavorite(id, delta) {
  const favorites = [...getState().apps.favorites];
  const from = favorites.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= favorites.length) return;
  favorites.splice(to, 0, ...favorites.splice(from, 1));
  setFavorites(favorites);
}

/** Opens or closes the launcher; from the keyboard, focus goes to the first app. */
export function toggleApps() {
  if (!getState().apps.visible) return;
  if (isOpen()) {
    panel().hidePopover();
    return;
  }
  panel().showPopover();
  panel().querySelector('.app')?.focus();
}

function initDrag() {
  const grid = $('apps-favorites');
  grid.addEventListener('dragstart', (event) => {
    dragged = event.target.closest('.app');
    if (!dragged) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragged.dataset.id);
    dragged.classList.add('dragging');
  });
  // The dragged tile moves live in the DOM; the order is saved on dragend.
  grid.addEventListener('dragover', (event) => {
    if (!dragged) return;
    event.preventDefault();
    const over = event.target.closest('.app');
    if (!over || over === dragged) return;
    const rect = over.getBoundingClientRect();
    over[event.clientX > rect.left + rect.width / 2 ? 'after' : 'before'](dragged);
  });
  grid.addEventListener('drop', (event) => event.preventDefault());
  grid.addEventListener('dragend', () => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged = null;
    setFavorites([...grid.children].map((node) => node.dataset.id));
  });
}

export function initApps() {
  $('account-picks').replaceChildren(
    ...Array.from({ length: ACCOUNTS }, (_, index) => {
      const pick = button('account-pick', `${index + 1}°`, `Apri le app con il ${index + 1}° account Google`);
      pick.dataset.account = String(index);
      return pick;
    }),
  );
  $('account-picks').addEventListener('click', (event) => {
    const pick = event.target.closest('[data-account]');
    if (!pick) return;
    update((state) => {
      state.apps.account = Number(pick.dataset.account);
    });
  });

  $('apps-edit').addEventListener('click', () => {
    editing = !editing;
    render(getState());
  });
  for (const id of ['apps-favorites', 'apps-others']) {
    $(id).addEventListener('click', (event) => {
      const target = event.target.closest('.app');
      if (editing && target) toggleFavorite(target.dataset.id);
    });
  }
  $('apps-favorites').addEventListener('keydown', (event) => {
    const target = event.target.closest('.app');
    if (!editing || !target || !event.ctrlKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    moveFavorite(target.dataset.id, event.key === 'ArrowLeft' ? -1 : 1);
  });
  initDrag();

  panel().addEventListener('toggle', (event) => {
    if (event.newState === 'closed') editing = false;
    // Re-render on open so the Calendar icon shows today's date.
    render(getState(), true);
  });

  render(getState());
  subscribe(render);
}
