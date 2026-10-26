// Pins the extension ID by writing the public key into manifest.json.
// Without "key", Chrome derives the ID of an unpacked extension from the folder path:
// moving the folder changes the ID and hides all saved data.
//
// The ID changes ONCE when the key is applied. Export a backup first (Impostazioni > Dati),
// then follow the steps printed below. Usage: npm run apply-key
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const manifestURL = new URL('../manifest.json', import.meta.url);
const publicKey = readFileSync(new URL('./extension-key.pub', import.meta.url), 'utf8').trim();

// Chrome's algorithm: first 128 bits of SHA-256(public key DER), hex digits mapped to a–p.
function extensionId(base64Key) {
  const hash = createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest('hex');
  return [...hash.slice(0, 32)].map((digit) => String.fromCharCode(97 + parseInt(digit, 16))).join('');
}

const manifest = JSON.parse(readFileSync(manifestURL, 'utf8'));
const id = extensionId(publicKey);
if (manifest.key === publicKey) {
  console.log(`La chiave è già nel manifest. ID fisso: ${id}`);
  process.exit(0);
}

// Keep "key" right after "version" for readability.
const { manifest_version, name, version, ...rest } = manifest;
delete rest.key;
const next = { manifest_version, name, version, key: publicKey, ...rest };
writeFileSync(manifestURL, `${JSON.stringify(next, null, 2)}\n`);

console.log(`Chiave applicata. Nuovo ID fisso dell'estensione: ${id}

Prossimi passi:
  1. chrome://extensions → rimuovi l'estensione già installata (solo DOPO aver esportato il backup).
  2. "Carica estensione non pacchettizzata" → seleziona di nuovo questa cartella.
  3. Apri una nuova scheda → Impostazioni → Dati → Importa backup.
Da ora l'ID resta ${id} anche se sposti la cartella.`);
