// Actions available from the command palette (type ">" in the search box).
import { toggleApps } from './apps.js';
import { THEMES, WALLPAPERS } from './config.js';
import { resetTimer, toggleTimer } from './focus.js';
import { focusNotes } from './notes.js';
import { exportBackup, openSettings } from './settings.js';
import { getState, update } from './store.js';
import { focusTaskInput } from './tasks.js';

const set = (key, value) => () =>
  update((state) => {
    state[key] = value;
  });

/** @returns {{label: string, keywords?: string, key?: string, run: () => void}[]} */
export function getCommands() {
  const { timer } = getState();
  return [
    {
      label: timer.running ? 'Metti in pausa il timer' : 'Avvia il timer',
      keywords: 'focus pomodoro start sessione',
      key: 'P',
      run: toggleTimer,
    },
    { label: 'Azzera il timer', keywords: 'reset focus', run: resetTimer },
    { label: 'Nuova attività', keywords: 'task todo aggiungi', key: 'T', run: focusTaskInput },
    { label: 'Apri le note', keywords: 'notes appunti scratchpad snippet', key: 'N', run: focusNotes },
    { label: 'Impostazioni', keywords: 'settings preferenze opzioni', key: 'S', run: () => openSettings() },
    { label: 'App Google', keywords: 'google launcher gmail drive docs', key: 'G', run: toggleApps },
    {
      label: 'Scorciatoie da tastiera',
      keywords: 'shortcuts tasti aiuto help',
      key: '?',
      run: () => openSettings({ scrollTo: 'shortcuts-section' }),
    },
    { label: 'Esporta backup', keywords: 'export json salva dati', run: exportBackup },
    ...Object.entries(THEMES).map(([id, theme]) => ({
      label: `Tema: ${theme.label}`,
      keywords: 'colori theme aspetto',
      run: set('theme', id),
    })),
    ...Object.entries(WALLPAPERS).map(([id, label]) => ({
      label: `Sfondo: ${label}`,
      keywords: 'wallpaper immagine',
      run: set('wallpaper', id),
    })),
  ];
}
