// ESLint flat config without plugins, so `npm run lint` needs no local install.
const browserGlobals = Object.fromEntries(
  [
    'window',
    'document',
    'localStorage',
    'indexedDB',
    'crypto',
    'screen',
    'devicePixelRatio',
    'setTimeout',
    'clearTimeout',
    'confirm',
    'fetch',
    'URL',
    'Blob',
    'FileReader',
    'Image',
    'Element',
    'CSS',
    'Intl',
    'createImageBitmap',
    'OffscreenCanvas',
    'globalThis',
    'matchMedia',
    'innerWidth',
    'innerHeight',
    'requestAnimationFrame',
  ].map((name) => [name, 'readonly']),
);
const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  crypto: 'readonly',
  fetch: 'readonly',
  WebSocket: 'readonly',
  setTimeout: 'readonly',
};

const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-unreachable': 'error',
  'no-dupe-keys': 'error',
  'no-self-assign': 'error',
  'no-constant-condition': 'error',
  'no-empty': ['error', { allowEmptyCatch: false }],
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: 'error',
  curly: ['error', 'multi-line'],
};

export default [
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: browserGlobals },
    rules,
  },
  {
    files: ['js/boot.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    files: ['background.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'script', globals: { chrome: 'readonly' } },
    rules,
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: nodeGlobals },
    rules,
  },
];
