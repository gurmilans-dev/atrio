// Actions available from the command palette (type ">" in the search box).
import { toggleApps } from './apps.js';
import { LAYOUTS, THEMES, WALLPAPERS } from './config.js';
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
  const { timer, show, layout } = getState();
  const commands = [
    {
      label: t(timer.running ? 'command.pauseTimer' : 'command.startTimer'),
      keywords: 'focus pomodoro start avvia pausa pause sessione session',
      key: 'P',
      section: 'focus',
      run: toggleTimer,
    },
    {
      label: t('command.resetTimer'),
      keywords: 'reset azzera focus timer',
      section: 'focus',
      run: resetTimer,
    },
    {
      label: t('command.newTask'),
      keywords: 'task todo aggiungi add nuova attività',
      key: 'T',
      section: 'tasks',
      run: focusTaskInput,
    },
    {
      label: t('command.notes'),
      keywords: 'notes note appunti scratchpad snippet',
      key: 'N',
      section: 'tasks',
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
    ...LAYOUTS.filter((id) => id !== layout).map((id) => ({
      label: t('command.layout', { name: t(`layout.${id}`) }),
      keywords: 'modalità mode interfaccia interface layout minimal minimale developer completa full',
      run: set('layout', id),
    })),
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
  // Commands for a part of the page hidden in Settings → Page are left out.
  return commands.filter((command) => !command.section || show[command.section]);
}
