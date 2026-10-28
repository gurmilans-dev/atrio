// Interface modes (Settings → Appearance). Developer shows every panel; Minimal hides the side panels
// but keeps them in the page: their shortcuts and commands (T, N, P…) open the one they need as a
// floating sheet (data-sheet on the root), which closes on Esc, a click elsewhere, or when focus
// leaves it. In Developer the panels are always there and revealPanel() does nothing.
import { getState, subscribe } from './store.js';

const root = document.documentElement;
let returnFocus = null;

const side = () => document.querySelector('.side');

/**
 * Makes the focus or tasks panel visible in Minimal, before the caller moves focus into it.
 * @returns {boolean} whether it floats as a sheet (Minimal), so the caller should focus it
 */
export function revealPanel(name) {
  if (getState().layout !== 'minimal') return false;
  if (root.dataset.sheet !== name) {
    if (!root.dataset.sheet) returnFocus = document.activeElement;
    root.dataset.sheet = name;
  }
  return true;
}

function closePanel({ restoreFocus }) {
  if (!root.dataset.sheet) return;
  // Leaving a field fires its blur first, so the notes are saved as on any other blur.
  if (side().contains(document.activeElement)) document.activeElement.blur();
  delete root.dataset.sheet;
  const target = returnFocus;
  returnFocus = null;
  if (restoreFocus && target?.isConnected && target !== document.body) target.focus();
}

// Minimal centers the search box: its list of results gets the room left below it, so the bottom
// of the window never cuts it (style.css reads --results-room). Measured when the page or the window
// changes, not while typing.
function measureResultsRoom() {
  if (getState().layout !== 'minimal') {
    root.style.removeProperty('--results-room');
    return;
  }
  const below = window.innerHeight - document.querySelector('.search').getBoundingClientRect().bottom;
  root.style.setProperty('--results-room', `${Math.max(160, Math.floor(below - 26))}px`);
}

export function initLayout() {
  measureResultsRoom();
  window.addEventListener('resize', measureResultsRoom);
  document.addEventListener('keydown', (event) => {
    // Esc in the settings closes the settings, not the sheet behind them.
    if (event.key !== 'Escape' || !root.dataset.sheet || event.target.closest?.('dialog')) return;
    closePanel({ restoreFocus: true });
  });
  // A press outside closes it; the press then acts as usual (and takes focus where it lands).
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (root.dataset.sheet && !side().contains(event.target)) closePanel({ restoreFocus: false });
    },
    true,
  );
  side().addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (next && !side().contains(next)) closePanel({ restoreFocus: false });
  });
  // Back to Developer, or the panel turned off in Settings → Page: nothing to float.
  subscribe((state) => {
    measureResultsRoom();
    const name = root.dataset.sheet;
    if (name && (state.layout !== 'minimal' || !state.show[name])) {
      closePanel({ restoreFocus: false });
    }
  });
}
