// Actions available from the command palette (type ">" in the search box).
import { toggleApps } from './apps.js';
import { THEMES, WALLPAPERS } from './config.js';
import { resetTimer, toggleTimer } from './focus.js';
import { t, themeName, wallpaperName } from './i18n.js';
import { focusNotes } from './notes.js';
import { exportBackup, openSettings } from './settings.js';
import { getState, update } from './store.js';
import { focusTaskInput } from './tasks.js';

const set = (key, value) => () =>
  update((state) => {
    state[key] = value;
  });

// Keywords are in both languages, so a command is found whatever the interface language.
/** @returns {{label: string, keywords?: string, key?: string, run: () => void}[]} */
export function getCommands() {
  const { timer } = getState();
  return [
    {
      label: t(timer.running ? 'command.pauseTimer' : 'command.startTimer'),
      keywords: 'focus pomodoro start avvia pausa pause sessione session',
      key: 'P',
      run: toggleTimer,
    },
    { label: t('command.resetTimer'), keywords: 'reset azzera focus timer', run: resetTimer },
    {
      label: t('command.newTask'),
      keywords: 'task todo aggiungi add nuova attività',
      key: 'T',
      run: focusTaskInput,
    },
    {
      label: t('command.notes'),
      keywords: 'notes note appunti scratchpad snippet',
      key: 'N',
      run: focusNotes,
    },
    {
      label: t('command.settings'),
      keywords: 'settings impostazioni preferenze preferences opzioni options',
      key: 'S',
      run: () => openSettings(),
    },
    {
      label: t('command.apps'),
      keywords: 'google apps launcher gmail drive docs',
      key: 'G',
      run: toggleApps,
    },
    {
      label: t('command.shortcuts'),
      keywords: 'shortcuts scorciatoie tasti keys aiuto help',
      key: '?',
      run: () => openSettings({ scrollTo: 'shortcuts-section' }),
    },
    {
      label: t('command.export'),
      keywords: 'export esporta backup json salva save dati data',
      run: exportBackup,
    },
    ...Object.keys(THEMES).map((id) => ({
      label: t('command.theme', { name: themeName(id) }),
      keywords: 'tema theme colori colors aspetto',
      run: set('theme', id),
    })),
    ...WALLPAPERS.map((id) => ({
      label: t('command.wallpaper', { name: wallpaperName(id) }),
      keywords: 'sfondo wallpaper immagine image background',
      run: set('wallpaper', id),
    })),
  ];
}
