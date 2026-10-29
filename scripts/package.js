// Builds the Chrome Web Store package, azlune-<version>.zip at the root of the repository (ignored by
// git), then checks it.
//   npm run package
// Only what the extension loads goes in (RUNTIME below), with manifest.json at the root of the ZIP.
// The manifest is written without "key": npm run apply-key adds one for local development, and the
// Store assigns the item its own. Entries use forward slashes and a fixed date, so the same files
// always give the same ZIP, and the same SHA-256.
//
// The check reads the ZIP back, extracts it to a new temporary folder and verifies what the Store and
// the extension need. `npm run test:extension -- <that folder>` then runs the smoke checks on it.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { WALLPAPERS, wallpaperSrc } from '../js/config.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RUNTIME = [
  'manifest.json',
  'index.html',
  'style.css',
  'background.js',
  'LICENSE',
  'js',
  'assets',
  '_locales',
];
// The kinds of file each runtime path holds: anything else in them (notes, sources, a stray export)
// fails the check instead of shipping.
const EXPECTED = [
  /^(manifest\.json|index\.html|style\.css|background\.js|LICENSE)$/,
  /^js\/[\w-]+\.js$/,
  /^assets\/[\w-]+\.webp$/,
  /^assets\/icons\/[\w-]+\.(png|svg)$/,
  /^_locales\/[\w-]+\/messages\.json$/,
];
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01, the earliest date a ZIP can hold
const UTF8_NAMES = 0x0800;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Files under the runtime paths, as ZIP names (forward slashes), sorted; hidden files left out.
function runtimeFiles() {
  const files = [];
  const walk = (path) => {
    const full = join(ROOT, path);
    let children;
    try {
      children = readdirSync(full, { withFileTypes: true });
    } catch {
      files.push(path);
      return;
    }
    for (const child of children) {
      if (child.name.startsWith('.') || child.name === 'Thumbs.db') continue;
      walk(`${path}/${child.name}`);
    }
  };
  RUNTIME.forEach(walk);
  return files.sort();
}

function contentOf(name) {
  const bytes = readFileSync(join(ROOT, name));
  if (name !== 'manifest.json') return bytes;
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (!('key' in manifest)) return bytes;
  delete manifest.key;
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    // Images are compressed already: stored as they are when deflating does not help.
    const [method, stored] = deflated.length < data.length ? [8, deflated] : [0, data];
    const header = (signature, size) => {
      const buffer = Buffer.alloc(size);
      buffer.writeUInt32LE(signature, 0);
      return buffer;
    };
    const local = header(0x04034b50, 30);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_NAMES, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = header(0x02014b50, 46);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    local.copy(central, 8, 6, 30); // flags, method, time, date, CRC, sizes, name length
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, stored);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + stored.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// Reads a ZIP written by zip() back: name -> content, each checked against its CRC.
function unzip(buffer) {
  const end = buffer.length - 22;
  if (buffer.readUInt32LE(end) !== 0x06054b50) throw new Error('no end of central directory');
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('bad central directory');
    const method = buffer.readUInt16LE(at + 10);
    const crc = buffer.readUInt32LE(at + 16);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    if (crc32(data) !== crc) throw new Error(`${name}: CRC mismatch`);
    files.set(name, data);
    at += 46 + nameLength + buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32);
  }
  return files;
}

function check(files, version) {
  const problems = [];
  const need = (name, why) => files.has(name) || problems.push(`missing ${name} (${why})`);
  if (!files.has('manifest.json')) throw new Error('manifest.json is not at the root of the ZIP');
  const manifest = JSON.parse(files.get('manifest.json').toString('utf8'));
  if (manifest.manifest_version !== 3) problems.push('manifest_version is not 3');
  if (manifest.version !== version) {
    problems.push(`manifest version ${manifest.version}, package.json ${version}`);
  }
  if ('key' in manifest) problems.push('the manifest has a "key"');
  for (const icon of Object.values(manifest.icons ?? {})) need(icon, 'manifest icon');
  need(manifest.background?.service_worker, 'service worker');
  need(manifest.chrome_url_overrides?.newtab, 'new tab page');
  need(`_locales/${manifest.default_locale}/messages.json`, 'default locale');
  const page = files.get(manifest.chrome_url_overrides?.newtab)?.toString('utf8') ?? '';
  for (const [, ref] of page.matchAll(/(?:src|href)="([^"#?:]+)"/g)) need(ref, 'linked from the page');
  for (const id of WALLPAPERS) need(wallpaperSrc(id), 'built-in wallpaper');
  for (const name of files.keys()) {
    if (!EXPECTED.some((pattern) => pattern.test(name))) problems.push(`unexpected ${name}`);
  }
  return problems;
}

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const target = join(ROOT, `azlune-${version}.zip`);
const buffer = zip(runtimeFiles().map((name) => ({ name, data: contentOf(name) })));
writeFileSync(target, buffer);

const files = unzip(readFileSync(target));
const folder = mkdtempSync(join(tmpdir(), `azlune-${version}-`));
for (const [name, data] of files) {
  mkdirSync(dirname(join(folder, name)), { recursive: true });
  writeFileSync(join(folder, name), data);
}
const problems = check(files, version);
const unpacked = [...files.values()].reduce((sum, data) => sum + data.length, 0);
console.log(`${target}
  ${files.size} files, ${buffer.length} bytes (${unpacked} unpacked)
  SHA-256 ${createHash('sha256').update(buffer).digest('hex')}
  extracted to ${folder}`);
if (problems.length) {
  console.error(problems.map((problem) => `  ✖ ${problem}`).join('\n'));
  process.exit(1);
}
console.log(`  ✔ manifest at the root, version ${version}, no "key"; every file it and the page name, and the
    ${WALLPAPERS.length} built-in wallpapers, are there; nothing else but scripts, styles, images and locales
  Smoke checks on this copy: npm run test:extension -- "${folder}"`);
