import { toggleApps } from './apps.js';
import { isTyping } from './dom.js';
import { toggleTimer } from './focus.js';
import { openLink } from './links.js';
import { focusNotes } from './notes.js';
import { focusSearch, openCommandPalette } from './search-ui.js';
import { isSettingsOpen, openSettings } from './settings.js';
import { focusTaskInput } from './tasks.js';

// Single-key shortcuts, active only when no text field has focus.
const ACTIONS = {
  '/': focusSearch,
  '>': openCommandPalette,
  s: () => openSettings(),
  g: toggleApps,
  t: focusTaskInput,
  n: focusNotes,
  p: toggleTimer,
  '?': () => openSettings({ scrollTo: 'shortcuts-section' }),
};

export function initShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    const typing = isTyping(event.target);
    const { key } = event;

    const ctrl = (event.ctrlKey || event.metaKey) && !event.altKey;
    if (ctrl && !event.shiftKey && key.toLowerCase() === 'k') {
      event.preventDefault();
      if (!isSettingsOpen()) focusSearch();
      return;
    }
    if (ctrl && event.shiftKey && key.toLowerCase() === 'p') {
      event.preventDefault();
      if (!isSettingsOpen()) openCommandPalette();
      return;
    }
    if (isSettingsOpen()) return; // the dialog handles Esc and Tab natively
    if (key === 'Escape') {
      if (typing) event.target.blur();
      return;
    }
    if (typing || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;

    const action =
      ACTIONS[key.toLowerCase()] ?? (/^[1-9]$/.test(key) ? () => openLink(Number(key) - 1) : null);
    if (!action) return;
    event.preventDefault();
    action();
  });
}
