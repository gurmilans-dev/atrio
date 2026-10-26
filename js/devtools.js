// Developer tools for the command palette: calculator, timestamps, UUIDs, Base64, URL encoding,
// colors and passwords. Pure functions, everything local; see tests/devtools.test.js.
// Each result row is { tool, value, detail, first, color?, error? }: Enter copies `value`;
// `first` puts the rows above the web search (an explicit tool keyword or an obvious match).
import { hslToHex, rgbToHsl } from './color.js';
import { dateFormat, relativeFormat, t } from './i18n.js';

/** calc, ts, uuid, b64, url, color, pw */
export const toolName = (tool) => t(`tool.${tool}`);

const row = (tool, value, detail, extra = {}) => ({
  tool,
  value: String(value),
  detail,
  first: true,
  ...extra,
});
const errorRow = (tool, message) => row(tool, message, toolName(tool), { error: true });

// ---------- Calculator: a small recursive-descent parser (eval is unsafe and blocked by the CSP) ----------

const FUNCTIONS = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  log: Math.log10,
  ln: Math.log,
  log2: Math.log2,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  min: Math.min,
  max: Math.max,
};
const CONSTANTS = { pi: Math.PI, e: Math.E };
const OPERATOR_ALIASES = { '**': '^', '×': '*', '÷': '/' };

function tokenize(text) {
  const pattern =
    /\s*(?:(0x[0-9a-f]+|0b[01]+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)|([a-z][a-z0-9]*)|(\*\*|[-+*/%^(),×÷]))/iy;
  const tokens = [];
  const input = text.trim();
  let index = 0;
  while (index < input.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(input);
    if (!match) return null;
    index = pattern.lastIndex;
    if (match[1]) tokens.push({ type: 'number', value: Number(match[1]) });
    else if (match[2]) tokens.push({ type: 'name', value: match[2].toLowerCase() });
    else tokens.push({ type: 'op', value: OPERATOR_ALIASES[match[3]] ?? match[3] });
  }
  return tokens;
}

export function evaluate(text) {
  const tokens = tokenize(text);
  if (!tokens?.length) return null;
  let position = 0;
  const take = (value) => (tokens[position]?.value === value ? tokens[position++] : null);
  const fail = () => {
    throw new SyntaxError('invalid expression');
  };

  function expression() {
    let value = term();
    for (;;) {
      if (take('+')) value += term();
      else if (take('-')) value -= term();
      else return value;
    }
  }
  function term() {
    let value = unary();
    for (;;) {
      if (take('*')) value *= unary();
      else if (take('/')) value /= unary();
      else if (take('%')) value %= unary();
      else return value;
    }
  }
  // -2^2 = -(2^2) and 2^3^2 = 2^(3^2), as in maths.
  function unary() {
    if (take('-')) return -unary();
    if (take('+')) return unary();
    const base = primary();
    return take('^') ? base ** unary() : base;
  }
  function primary() {
    const token = tokens[position++];
    if (!token) fail();
    if (token.type === 'number') return token.value;
    if (token.type === 'name') {
      // Own keys only: "toString" or "constructor" must not reach Object.prototype.
      if (Object.hasOwn(CONSTANTS, token.value) && tokens[position]?.value !== '(') {
        return CONSTANTS[token.value];
      }
      const fn = Object.hasOwn(FUNCTIONS, token.value) ? FUNCTIONS[token.value] : null;
      if (!fn || !take('(')) fail();
      const args = [expression()];
      while (take(',')) args.push(expression());
      if (!take(')')) fail();
      return fn(...args);
    }
    if (token.value === '(') {
      const value = expression();
      if (!take(')')) fail();
      return value;
    }
    return fail();
  }

  try {
    const value = expression();
    return position === tokens.length && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

const formatNumber = (value) =>
  Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER
    ? String(value)
    : String(Number(value.toPrecision(12)));

function calculator(expression, explicit) {
  const value = evaluate(expression);
  if (value === null) {
    return explicit && expression.trim() ? [errorRow('calc', t('tool.badExpression'))] : [];
  }
  const rows = [row('calc', formatNumber(value), toolName('calc'))];
  if (explicit && Number.isInteger(value) && value >= 0 && value <= 2 ** 32) {
    rows.push(row('calc', `0x${value.toString(16)}`, t('tool.hex')));
    rows.push(row('calc', `0b${value.toString(2)}`, t('tool.bin')));
  }
  return rows;
}

// Plain arithmetic typed without "=": digits and operators only, with at least one operator
// other than "-" (so dates like 2026-10-26 stay searches).
const looksLikeMath = (text) =>
  /^[\d\s.+\-*/%^()×÷]+$/.test(text) && /[+*/%^()×÷]/.test(text) && /\d/.test(text);

// ---------- Timestamps ----------

const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

function relative(ms, now) {
  const seconds = (ms - now) / 1000;
  const [unit, size] = UNITS.find(([, unitSize]) => Math.abs(seconds) >= unitSize) ?? UNITS.at(-1);
  return relativeFormat().format(Math.round(seconds / size), unit);
}

function describeTime(ms, now, first) {
  return [
    row('ts', dateFormat({ dateStyle: 'full', timeStyle: 'medium' }).format(ms), t('tool.localDate'), {
      first,
    }),
    row('ts', new Date(ms).toISOString(), t('tool.iso'), { first }),
    row('ts', relative(ms, now), t('tool.relative'), { first }),
  ];
}

function timestamp(argument, now) {
  if (!argument) {
    return [
      row('ts', Math.floor(now / 1000), t('tool.unixSeconds')),
      row('ts', now, t('tool.unixMs')),
      row('ts', new Date(now).toISOString(), t('tool.iso')),
    ];
  }
  if (/^\d{1,13}$/.test(argument)) {
    // Up to 11 digits are seconds (until the year 5138), longer ones are milliseconds.
    const ms = argument.length <= 11 ? Number(argument) * 1000 : Number(argument);
    return describeTime(ms, now, true);
  }
  const parsed = Date.parse(argument) || Date.parse(argument.replace(' ', 'T'));
  if (!parsed) return [errorRow('ts', t('tool.badDate'))];
  return [
    row('ts', Math.floor(parsed / 1000), t('tool.unixSeconds')),
    row('ts', parsed, t('tool.unixMs')),
    row('ts', new Date(parsed).toISOString(), t('tool.iso')),
  ];
}

// ---------- Encodings ----------

export const encodeBase64 = (text) =>
  btoa(Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join(''));

export function decodeBase64(text) {
  try {
    const binary = atob(text.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function decodeURL(text) {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

// ---------- Colors ----------

const toHex = (r, g, b) => `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;

function parseColor(text) {
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
    return [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16));
  }
  const rgb = text.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/][^)]*)?\)$/i);
  if (rgb) {
    const channels = rgb.slice(1, 4).map(Number);
    return channels.every((value) => value <= 255) ? channels : null;
  }
  const hsl = text.match(
    /^hsla?\(\s*(\d+(?:\.\d+)?)(?:deg)?[\s,]+(\d+(?:\.\d+)?)%[\s,]+(\d+(?:\.\d+)?)%\s*(?:[,/][^)]*)?\)$/i,
  );
  if (hsl) {
    const [h, s, l] = hsl.slice(1, 4).map(Number);
    if (s > 100 || l > 100) return null;
    const value = hslToHex(h % 360, s / 100, l / 100);
    return [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  }
  return null;
}

function colorRows(text) {
  const channels = parseColor(text);
  if (!channels) return null;
  const [r, g, b] = channels;
  const hex = toHex(r, g, b);
  const [h, s, l] = rgbToHsl(r, g, b);
  return [
    row('color', hex, 'HEX', { color: hex }),
    row('color', `rgb(${r}, ${g}, ${b})`, 'RGB', { color: hex }),
    row('color', `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`, 'HSL', {
      color: hex,
    }),
  ];
}

// ---------- Random values ----------

// Ambiguous characters (I l 1 O 0) are left out so passwords can be read and typed back.
const LETTERS_AND_DIGITS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const SYMBOLS = '!@#$%^&*-_=+?';

export function password(length, charset) {
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % charset.length);
  const out = [];
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length) out.push(charset[byte % charset.length]);
    }
  }
  return out.join('');
}

const clamp = (value, min, max, fallback) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

// ---------- Entry point ----------

/** @returns {{tool: string, value: string, detail: string, first: boolean, color?: string, error?: boolean}[]} */
export function runTools(raw, now = Date.now()) {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  if (text.startsWith('=')) return calculator(text.slice(1), true);

  const [, keyword, rest = ''] = text.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  const argument = rest.trim();
  switch (keyword.toLowerCase()) {
    case 'ts':
      return timestamp(argument, now);
    case 'uuid': {
      const count = clamp(Number(argument || 1), 1, 10, 1);
      return Array.from({ length: count }, () => row('uuid', crypto.randomUUID(), t('tool.uuidV4')));
    }
    case 'pw': {
      const length = clamp(Number(argument || 20), 8, 128, 20);
      return [
        row('pw', password(length, LETTERS_AND_DIGITS + SYMBOLS), t('tool.password', { n: length })),
        row('pw', password(length, LETTERS_AND_DIGITS), t('tool.alnum')),
      ];
    }
    case 'b64':
      return argument ? [row('b64', encodeBase64(argument), t('tool.b64Encoded'))] : [];
    case 'b64d': {
      if (!argument) return [];
      const decoded = decodeBase64(argument);
      return [
        decoded === null ? errorRow('b64', t('tool.b64Invalid')) : row('b64', decoded, t('tool.b64Decoded')),
      ];
    }
    case 'url':
      return argument ? [row('url', encodeURIComponent(argument), t('tool.urlEncoded'))] : [];
    case 'urld': {
      if (!argument) return [];
      const decoded = decodeURL(argument);
      return [
        decoded === null ? errorRow('url', t('tool.urlInvalid')) : row('url', decoded, t('tool.urlDecoded')),
      ];
    }
    default:
      break;
  }

  const color = colorRows(text);
  if (color) return color;
  if (looksLikeMath(text)) return calculator(text, false);
  // A bare 10 or 13 digit number is probably a timestamp, but it may also be a search: shown below it.
  if (/^\d{10}$|^\d{13}$/.test(text)) {
    return timestamp(text, now).map((result) => ({ ...result, first: false }));
  }
  return [];
}
