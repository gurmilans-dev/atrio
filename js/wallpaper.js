// Custom wallpaper storage: binary Blob in IndexedDB, never base64 in localStorage.
const DB_NAME = 'workspace-wallpaper'; // former project name, kept for existing data
const STORE = 'images';
const KEY = 'selected';

let dbPromise = null;

function openDB() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

async function run(mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getImage = () => run('readonly', (store) => store.get(KEY));
export const putImage = (blob) => run('readwrite', (store) => store.put(blob, KEY));
export const deleteImage = () => run('readwrite', (store) => store.delete(KEY));

/**
 * Shrinks the image to what the screen can show (keeping "cover" coverage) and re-encodes it as WebP.
 * A 6000×4000 PNG would otherwise cost ~96 MB of decoded memory on every new tab.
 */
export async function prepareWallpaper(blob) {
  const source = await createImageBitmap(blob);
  try {
    const dpr = globalThis.devicePixelRatio || 1;
    const screenWidth = Math.min(3840, Math.round(screen.width * dpr));
    const screenHeight = Math.min(2400, Math.round(screen.height * dpr));
    const scale = Math.min(1, Math.max(screenWidth / source.width, screenHeight / source.height));
    if (scale === 1 && blob.type === 'image/webp') return blob;

    const width = Math.round(source.width * scale);
    const height = Math.round(source.height * scale);
    const resized = await createImageBitmap(source, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    });
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d').drawImage(resized, 0, 0);
    resized.close();
    const output = await canvas.convertToBlob({ type: 'image/webp', quality: 0.86 });
    return output.size < blob.size || scale < 1 ? output : blob;
  } finally {
    source.close();
  }
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(dataURL) {
  return (await fetch(dataURL)).blob(); // data: URL, decoded locally
}
