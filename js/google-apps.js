// Catalog for the Google apps launcher (js/apps.js). Each icon is a small drawing on a
// 24×24 grid in the product's colors, built locally: no network, no favicon cache.
// Nodes are [tag, attributes, children]; "{day}" in a text node becomes today's date.

const W = '#fff';
const PAGE = 'M6.5 2H14l5.5 5.5V20a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z';
const page = (color, fold) => [
  ['path', { d: PAGE, fill: color }],
  ['path', { d: 'M14 2v5.5h5.5z', fill: fold }],
];
const bar = (y, width = 8) => ['rect', { x: 8, y, width, height: 1.4, rx: 0.7, fill: W }];
const gradient = (stops) => [
  'defs',
  {},
  [
    [
      'linearGradient',
      { id: 'g', x1: 0, y1: 0, x2: 1, y2: 1 },
      stops.map(([offset, color]) => ['stop', { offset, 'stop-color': color }]),
    ],
  ],
];
const person = (fill) => [
  ['circle', { cx: 12, cy: 9.4, r: 3, fill }],
  ['path', { d: 'M6.8 17.4c1-2.6 3-3.9 5.2-3.9s4.2 1.3 5.2 3.9z', fill }],
];

export const GOOGLE_APPS = [
  {
    id: 'account',
    name: 'Account',
    url: 'https://myaccount.google.com/',
    keywords: 'profilo sicurezza password',
    icon: [['circle', { cx: 12, cy: 12, r: 10, fill: '#8ab4f8' }], ...person('#174ea6')],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com/mail/',
    keywords: 'mail posta email',
    icon: [
      ['path', { d: 'M2 7.6v9.9A1.5 1.5 0 0 0 3.5 19h3v-8z', fill: '#4285f4' }],
      ['path', { d: 'M17.5 19h3a1.5 1.5 0 0 0 1.5-1.5V7.6L17.5 11z', fill: '#34a853' }],
      ['path', { d: 'M17.5 6.2V11L22 7.6V6.4c0-1.4-1.6-2.2-2.7-1.4z', fill: '#fbbc04' }],
      ['path', { d: 'M6.5 11V6.2l5.5 4.1 5.5-4.1V11L12 15.1z', fill: '#ea4335' }],
      ['path', { d: 'M2 6.4v1.2L6.5 11V6.2L4.7 5C3.6 4.2 2 5 2 6.4z', fill: '#c5221f' }],
    ],
  },
  {
    id: 'drive',
    name: 'Drive',
    url: 'https://drive.google.com/drive/',
    keywords: 'file cartelle archivio',
    icon: [
      ['path', { d: 'M8.6 3.5h6.8l6.4 11.2H8.9z', fill: '#fbbc04' }],
      ['path', { d: 'M8.6 3.5 12 9.4 5.6 20.5l-3.4-5.8z', fill: '#0f9d58' }],
      ['path', { d: 'M5.6 20.5 8.9 14.7h12.9l-3.4 5.8z', fill: '#4285f4' }],
    ],
  },
  {
    id: 'classroom',
    name: 'Classroom',
    url: 'https://classroom.google.com/',
    keywords: 'scuola corsi compiti università',
    icon: [
      ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2.2, fill: '#fbbc04' }],
      ['rect', { x: 3.8, y: 5.8, width: 16.4, height: 12.4, rx: 1, fill: '#0f9d58' }],
      ['circle', { cx: 7.3, cy: 11, r: 1.3, fill: '#57bb8a' }],
      ['circle', { cx: 16.7, cy: 11, r: 1.3, fill: '#57bb8a' }],
      ['circle', { cx: 12, cy: 10.2, r: 1.9, fill: W }],
      ['path', { d: 'M8.4 15.6c.6-1.8 2-2.8 3.6-2.8s3 1 3.6 2.8z', fill: W }],
    ],
  },
  {
    id: 'docs',
    name: 'Docs',
    url: 'https://docs.google.com/document/',
    keywords: 'documenti documento word testo',
    icon: [...page('#4285f4', '#a1c2fa'), bar(11), bar(14), bar(17, 5)],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    keywords: 'ai intelligenza artificiale assistente',
    icon: [
      gradient([
        [0, '#4f8ff7'],
        [0.55, '#9b72cb'],
        [1, '#d96570'],
      ]),
      [
        'path',
        {
          d: 'M12 2.5c.6 5.1 4.4 8.9 9.5 9.5-5.1.6-8.9 4.4-9.5 9.5-.6-5.1-4.4-8.9-9.5-9.5 5.1-.6 8.9-4.4 9.5-9.5z',
          fill: 'url(#g)',
        },
      ],
    ],
  },
  {
    id: 'sheets',
    name: 'Sheets',
    url: 'https://docs.google.com/spreadsheets/',
    keywords: 'fogli di calcolo excel tabelle',
    icon: [
      ...page('#0f9d58', '#87ceac'),
      [
        'rect',
        { x: 7.8, y: 10.5, width: 8.4, height: 8, rx: 0.8, fill: 'none', stroke: W, 'stroke-width': 1.5 },
      ],
      ['path', { d: 'M12 10.5v8M7.8 14.5h8.4', stroke: W, 'stroke-width': 1.5 }],
    ],
  },
  {
    id: 'slides',
    name: 'Slides',
    url: 'https://docs.google.com/presentation/',
    keywords: 'presentazioni powerpoint diapositive',
    icon: [
      ...page('#f4b400', '#fadb8c'),
      [
        'rect',
        { x: 7.6, y: 11, width: 8.8, height: 6, rx: 0.8, fill: 'none', stroke: W, 'stroke-width': 1.6 },
      ],
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    url: 'https://calendar.google.com/calendar/',
    keywords: 'calendario eventi agenda',
    icon: [
      ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 3, fill: W }],
      ['path', { d: 'M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2H3z', fill: '#4285f4' }],
      [
        'text',
        {
          x: 12,
          y: 18.4,
          'text-anchor': 'middle',
          'font-size': 9,
          'font-weight': 700,
          'font-family': 'Arial, Helvetica, sans-serif',
          fill: '#1967d2',
        },
        '{day}',
      ],
    ],
  },
  {
    id: 'chat',
    name: 'Chat',
    url: 'https://chat.google.com/',
    keywords: 'messaggi conversazioni',
    icon: [
      [
        'path',
        {
          d: 'M5 3.5h14A2.5 2.5 0 0 1 21.5 6v9.5a2.5 2.5 0 0 1-2.5 2.5H9.5L5 21.5V18a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 5 3.5z',
          fill: '#34a853',
        },
      ],
      [
        'path',
        {
          d: 'M8.3 10.8c2 2.3 5.4 2.3 7.4 0',
          fill: 'none',
          stroke: W,
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
        },
      ],
    ],
  },
  {
    id: 'meet',
    name: 'Meet',
    url: 'https://meet.google.com/',
    keywords: 'videochiamata riunione call',
    icon: [
      [
        'path',
        {
          d: 'M2.5 7.5A2.5 2.5 0 0 1 5 5h8.5A2.5 2.5 0 0 1 16 7.5v9a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5z',
          fill: '#00ac47',
        },
      ],
      ['path', { d: 'M5 5h8.5A2.5 2.5 0 0 1 16 7.5V9H2.5V7.5A2.5 2.5 0 0 1 5 5z', fill: '#ffba00' }],
      ['path', { d: 'M16 10.2 21.5 6v12L16 13.8z', fill: '#00832d' }],
    ],
  },
  {
    id: 'vids',
    name: 'Vids',
    url: 'https://vids.google.com/',
    keywords: 'video montaggio',
    icon: [
      gradient([
        [0, '#4c8bf5'],
        [1, '#a463f2'],
      ]),
      ['rect', { x: 2.5, y: 2.5, width: 19, height: 19, rx: 5, fill: 'url(#g)' }],
      ['path', { d: 'M10 8.3v7.4l6-3.7z', fill: W }],
    ],
  },
  {
    id: 'tasks',
    name: 'Tasks',
    url: 'https://tasks.google.com/',
    keywords: 'promemoria to-do',
    icon: [
      ['circle', { cx: 12, cy: 12, r: 10, fill: '#1a73e8' }],
      [
        'path',
        {
          d: 'm7.6 12.4 3 3 5.8-6.1',
          fill: 'none',
          stroke: W,
          'stroke-width': 2.2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
      ],
      ['circle', { cx: 18.4, cy: 5.8, r: 2.2, fill: '#fbbc04' }],
    ],
  },
  {
    id: 'contacts',
    name: 'Contatti',
    url: 'https://contacts.google.com/',
    keywords: 'contacts rubrica persone',
    icon: [['circle', { cx: 12, cy: 12, r: 10, fill: '#1a73e8' }], ...person(W)],
  },
  {
    id: 'maps',
    name: 'Maps',
    url: 'https://www.google.com/maps',
    keywords: 'mappe navigatore indicazioni',
    icon: [
      ['path', { d: 'M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7z', fill: '#ea4335' }],
      ['circle', { cx: 12, cy: 9, r: 2.6, fill: '#a50e0e' }],
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/',
    keywords: 'video tutorial',
    icon: [
      ['rect', { x: 2, y: 5.5, width: 20, height: 13, rx: 4, fill: '#ff0000' }],
      ['path', { d: 'M10 9.2v5.6l4.8-2.8z', fill: W }],
    ],
  },
  {
    id: 'photos',
    name: 'Foto',
    url: 'https://photos.google.com/',
    keywords: 'photos immagini album',
    icon: [
      ['path', { d: 'M12 12H3.5a4.25 4.25 0 0 1 8.5 0z', fill: '#ea4335' }],
      ['path', { d: 'M12 12V3.5a4.25 4.25 0 0 1 0 8.5z', fill: '#fbbc04' }],
      ['path', { d: 'M12 12h8.5a4.25 4.25 0 0 1-8.5 0z', fill: '#34a853' }],
      ['path', { d: 'M12 12v8.5a4.25 4.25 0 0 1 0-8.5z', fill: '#4285f4' }],
    ],
  },
  {
    id: 'keep',
    name: 'Keep',
    url: 'https://keep.google.com/',
    keywords: 'note appunti promemoria',
    icon: [
      [
        'path',
        {
          d: 'M6 2.5h9.5l4 4V19a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 19V5A2.5 2.5 0 0 1 6 2.5z',
          fill: '#fbbc04',
        },
      ],
      ['path', { d: 'M15.5 2.5v4h4z', fill: '#f29900' }],
      ['circle', { cx: 11.5, cy: 11, r: 3.2, fill: W }],
      ['rect', { x: 10.1, y: 14.6, width: 2.8, height: 2.4, rx: 0.6, fill: W }],
    ],
  },
  {
    id: 'translate',
    name: 'Traduttore',
    url: 'https://translate.google.com/',
    keywords: 'translate traduci lingue',
    icon: [
      ['rect', { x: 2.5, y: 2.5, width: 19, height: 19, rx: 4, fill: '#4285f4' }],
      [
        'path',
        {
          d: 'M5.8 16.8 8.6 8h1.6l2.8 8.8M6.8 13.9h5.2M14.6 9.6h5M17.1 8v1.6M15.4 9.6c.6 2.6 2 4.6 4.2 5.8M18.8 9.6c-.5 2.6-1.9 4.6-4.2 5.8',
          fill: 'none',
          stroke: W,
          'stroke-width': 1.4,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
      ],
    ],
  },
  {
    id: 'forms',
    name: 'Moduli',
    url: 'https://docs.google.com/forms/',
    keywords: 'forms sondaggi questionari quiz',
    icon: [
      ...page('#7248b9', '#c1abe6'),
      ['circle', { cx: 9, cy: 12, r: 1, fill: W }],
      ['rect', { x: 11, y: 11.3, width: 5, height: 1.4, rx: 0.7, fill: W }],
      ['circle', { cx: 9, cy: 15.5, r: 1, fill: W }],
      ['rect', { x: 11, y: 14.8, width: 5, height: 1.4, rx: 0.7, fill: W }],
    ],
  },
  {
    id: 'notebooklm',
    name: 'NotebookLM',
    url: 'https://notebooklm.google.com/',
    keywords: 'ai fonti ricerca studio',
    icon: [
      ['circle', { cx: 12, cy: 12, r: 10, fill: '#e8eaed' }],
      [
        'path',
        {
          d: 'M6.2 16.5a5.8 5.8 0 0 1 11.6 0M9.1 16.5a2.9 2.9 0 0 1 5.8 0M6.2 16.5V9.8',
          fill: 'none',
          stroke: '#202124',
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
        },
      ],
    ],
  },
  {
    id: 'colab',
    name: 'Colab',
    url: 'https://colab.research.google.com/',
    keywords: 'jupyter notebook python gpu',
    icon: [
      ['circle', { cx: 8.3, cy: 12, r: 4.4, fill: 'none', stroke: '#f9ab00', 'stroke-width': 3.2 }],
      ['circle', { cx: 15.7, cy: 12, r: 4.4, fill: 'none', stroke: '#e8710a', 'stroke-width': 3.2 }],
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud Console',
    url: 'https://console.cloud.google.com/',
    keywords: 'gcp google cloud platform server',
    icon: [
      [
        'path',
        {
          d: 'M7.2 18.5a4.3 4.3 0 0 1-.9-8.5 6 6 0 0 1 11.5-.6 4.6 4.6 0 0 1-.4 9.1z',
          fill: 'none',
          stroke: '#4285f4',
          'stroke-width': 2.2,
          'stroke-linejoin': 'round',
        },
      ],
      ['path', { d: 'M9 14.5h6', stroke: '#ea4335', 'stroke-width': 2.2, 'stroke-linecap': 'round' }],
    ],
  },
  {
    id: 'firebase',
    name: 'Firebase',
    url: 'https://console.firebase.google.com/',
    keywords: 'database hosting auth backend',
    icon: [
      ['path', { d: 'M5 18.6 7.8 3.4c.1-.6.9-.7 1.2-.2l3 5.5z', fill: '#ffa000' }],
      [
        'path',
        { d: 'M5 18.6 15.6 8c.4-.4 1.1-.2 1.2.4L19 18.6l-6.3 3.6a1.4 1.4 0 0 1-1.4 0z', fill: '#f57c00' },
      ],
      ['path', { d: 'M12 8.7 9.9 4.6c-.2-.5-.9-.4-1 .1L5 18.6z', fill: '#ffca28' }],
    ],
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

// With several Google accounts signed in, authuser=N opens the app in the N-th one (0 = default).
export function appURL(app, account = 0) {
  const url = new URL(app.url);
  if (account > 0) url.searchParams.set('authuser', String(account));
  return url.href;
}
