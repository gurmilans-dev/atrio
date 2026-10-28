// Catalog for the Google apps launcher (js/apps.js). The services keep their names and addresses, not
// their icons: each one is a generic symbol of what the service does (an envelope, a folder, a grid…) on a
// rounded tile, drawn in Atrio's accent color by style.css (.app-tile, .app-glyph), never in a product's own
// shapes or colors. Nodes are [tag, attributes, children]; "{day}" in a text node becomes today's date.

const tile = ['rect', { class: 'app-tile', x: 2, y: 2, width: 20, height: 20, rx: 6 }];
const icon = (...shapes) => [tile, ['g', { class: 'app-glyph' }, shapes]];
const path = (d) => ['path', { d }];
const circle = (cx, cy, r) => ['circle', { cx, cy, r }];
const rect = (x, y, width, height, rx = 1.2) => ['rect', { x, y, width, height, rx }];

// `name` is the English product name; `names` holds the Italian one where Google translates it.
// Keywords are in both languages, so the palette finds apps either way.
export const GOOGLE_APPS = [
  {
    id: 'account',
    name: 'Account',
    url: 'https://myaccount.google.com/',
    keywords: 'profilo sicurezza password profile security',
    icon: icon(circle(12, 12, 6), circle(12, 10.6, 2), path('M8.6 16.3c.8-1.5 2-2.2 3.4-2.2s2.6.7 3.4 2.2')),
  },
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com/mail/',
    keywords: 'mail posta email inbox',
    icon: icon(rect(6, 7.5, 12, 9, 1.5), path('m6.6 8.6 5.4 4 5.4-4')),
  },
  {
    id: 'drive',
    name: 'Drive',
    url: 'https://drive.google.com/drive/',
    keywords: 'file cartelle archivio files folders storage',
    icon: icon(
      path(
        'M6 8.5A1.5 1.5 0 0 1 7.5 7h2.6l1.4 1.6h5A1.5 1.5 0 0 1 18 10.1v5.4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 15.5z',
      ),
    ),
  },
  {
    id: 'classroom',
    name: 'Classroom',
    url: 'https://classroom.google.com/',
    keywords: 'scuola corsi compiti università school courses homework',
    icon: icon(
      path('M5.5 10 12 7l6.5 3L12 13z'),
      path('M8.5 11.6v2.9c1 .9 2.2 1.3 3.5 1.3s2.5-.4 3.5-1.3v-2.9M18.5 10v3.5'),
    ),
  },
  {
    id: 'docs',
    name: 'Docs',
    url: 'https://docs.google.com/document/',
    keywords: 'documenti documento word testo documents text',
    icon: icon(rect(7.5, 6, 9, 12), path('M9.8 9.5h4.4M9.8 12h4.4M9.8 14.5h2.6')),
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    keywords: 'ai intelligenza artificiale assistente assistant',
    icon: icon(
      circle(8.5, 15, 1.6),
      circle(15.5, 15, 1.6),
      circle(12, 8.5, 1.6),
      path('M9.3 13.6 11.2 9.9M14.7 13.6 12.8 9.9M10.1 15h3.8'),
    ),
  },
  {
    id: 'sheets',
    name: 'Sheets',
    url: 'https://docs.google.com/spreadsheets/',
    keywords: 'fogli di calcolo excel tabelle spreadsheets tables',
    icon: icon(rect(6.5, 7, 11, 10), path('M6.5 10.5h11M6.5 14h11M10.5 7v10')),
  },
  {
    id: 'slides',
    name: 'Slides',
    url: 'https://docs.google.com/presentation/',
    keywords: 'presentazioni powerpoint diapositive presentations',
    icon: icon(rect(6, 6.5, 12, 8), path('M12 14.5v3M9.5 17.5h5')),
  },
  {
    id: 'calendar',
    name: 'Calendar',
    url: 'https://calendar.google.com/calendar/',
    keywords: 'calendario eventi agenda events schedule',
    icon: icon(rect(6, 7, 12, 11, 1.5), path('M6 10h12M9.5 5.5v3M14.5 5.5v3'), [
      'text',
      { x: 12, y: 16.6, 'text-anchor': 'middle', 'font-size': 6 },
      '{day}',
    ]),
  },
  {
    id: 'chat',
    name: 'Chat',
    url: 'https://chat.google.com/',
    keywords: 'messaggi conversazioni messages',
    icon: icon(
      path('M8 7h8a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-4.5L8.5 18v-2.5H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z'),
    ),
  },
  {
    id: 'meet',
    name: 'Meet',
    url: 'https://meet.google.com/',
    keywords: 'videochiamata riunione call video meeting',
    icon: icon(rect(5.5, 8, 9, 8, 1.5), path('m14.5 11 4-2.5v7l-4-2.5z')),
  },
  {
    id: 'vids',
    name: 'Vids',
    url: 'https://vids.google.com/',
    keywords: 'video montaggio editing',
    icon: icon(rect(6.5, 6, 11, 12), path('M9.5 6v12M14.5 6v12M6.5 9.5h3M6.5 14.5h3M14.5 9.5h3M14.5 14.5h3')),
  },
  {
    id: 'tasks',
    name: 'Tasks',
    url: 'https://tasks.google.com/',
    keywords: 'promemoria to-do reminders todo',
    icon: icon(rect(6.5, 6.5, 11, 11, 2.5), path('m9.3 12.2 1.9 1.9 3.6-3.9')),
  },
  {
    id: 'contacts',
    name: 'Contacts',
    names: { it: 'Contatti' },
    url: 'https://contacts.google.com/',
    keywords: 'contatti rubrica persone people address book',
    icon: icon(
      rect(5.5, 7, 13, 10, 1.5),
      circle(9.5, 11, 1.5),
      path('M7.5 14.6c.4-1 1.1-1.5 2-1.5s1.6.5 2 1.5M13.5 10.5h3M13.5 13h3'),
    ),
  },
  {
    id: 'maps',
    name: 'Maps',
    url: 'https://www.google.com/maps',
    keywords: 'mappe navigatore indicazioni directions navigation',
    icon: icon(
      path('M6 8.2 9.8 6.5l4.4 1.8L18 6.6v9.2l-3.8 1.7-4.4-1.8L6 17.4z'),
      path('M9.8 6.5v9.2M14.2 8.3v9.2'),
    ),
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/',
    keywords: 'video tutorial',
    icon: icon(circle(12, 12, 6), path('M10.6 9.6v4.8l4-2.4z')),
  },
  {
    id: 'photos',
    name: 'Photos',
    names: { it: 'Foto' },
    url: 'https://photos.google.com/',
    keywords: 'foto immagini album pictures images',
    icon: icon(rect(6, 7, 12, 10, 1.5), circle(9.6, 10.2, 1.2), path('m6.5 15.5 3.5-3 2.5 2 2-1.5 3 2.5')),
  },
  {
    id: 'keep',
    name: 'Keep',
    url: 'https://keep.google.com/',
    keywords: 'note appunti promemoria notes',
    icon: icon(
      path('M7 6.5h10a.5.5 0 0 1 .5.5v6.5l-4 4H7a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5z'),
      path('M17.5 13.5H14a.5.5 0 0 0-.5.5v3.5'),
    ),
  },
  {
    id: 'translate',
    name: 'Translate',
    names: { it: 'Traduttore' },
    url: 'https://translate.google.com/',
    keywords: 'traduttore traduci lingue translator languages',
    icon: icon(
      circle(12, 12, 6),
      path('M6 12h12M12 6c1.7 1.7 2.5 3.7 2.5 6s-.8 4.3-2.5 6M12 6c-1.7 1.7-2.5 3.7-2.5 6s.8 4.3 2.5 6'),
    ),
  },
  {
    id: 'forms',
    name: 'Forms',
    names: { it: 'Moduli' },
    url: 'https://docs.google.com/forms/',
    keywords: 'moduli sondaggi questionari quiz surveys',
    icon: icon(
      rect(7, 6.5, 10, 12, 1.5),
      path('M10 5.8h4v1.8h-4zM9.3 11l.9.9 1.5-1.6M13 11.2h2.2M9.3 14.6l.9.9 1.5-1.6M13 14.8h2.2'),
    ),
  },
  {
    id: 'notebooklm',
    name: 'NotebookLM',
    url: 'https://notebooklm.google.com/',
    keywords: 'ai fonti ricerca studio sources research study',
    icon: icon(
      path(
        'M12 8.2c-1.6-1.2-3.4-1.6-5.5-1.4v9.6c2.1-.2 3.9.2 5.5 1.4 1.6-1.2 3.4-1.6 5.5-1.4V6.8c-2.1-.2-3.9.2-5.5 1.4z',
      ),
      path('M12 8.2v9.6'),
    ),
  },
  {
    id: 'colab',
    name: 'Colab',
    url: 'https://colab.research.google.com/',
    keywords: 'jupyter notebook python gpu',
    icon: icon(path('m9.5 8.5-3 3.5 3 3.5M14.5 8.5l3 3.5-3 3.5M12.8 7.5l-1.6 9')),
  },
  {
    id: 'cloud',
    name: 'Cloud Console',
    url: 'https://console.cloud.google.com/',
    keywords: 'gcp google cloud platform server',
    icon: icon(rect(6.5, 6.5, 11, 4.5), rect(6.5, 13, 11, 4.5), path('M9 8.75h.01M9 15.25h.01')),
  },
  {
    id: 'firebase',
    name: 'Firebase',
    url: 'https://console.firebase.google.com/',
    keywords: 'database hosting auth backend',
    icon: icon(
      ['ellipse', { cx: 12, cy: 8, rx: 5, ry: 2 }],
      path('M7 8v8c0 1.1 2.2 2 5 2s5-.9 5-2V8M7 12c0 1.1 2.2 2 5 2s5-.9 5-2'),
    ),
  },
];

export const DEFAULT_APP_FAVORITES = [
  'account',
  'gmail',
  'drive',
  'classroom',
  'docs',
  'gemini',
  'sheets',
  'slides',
  'calendar',
];

export const appName = (app, language = 'en') => app.names?.[language] ?? app.name;

// With several Google accounts signed in, authuser=N opens the app in the N-th one (0 = default).
export function appURL(app, account = 0) {
  const url = new URL(app.url);
  if (account > 0) url.searchParams.set('authuser', String(account));
  return url.href;
}
