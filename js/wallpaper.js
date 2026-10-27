// Custom wallpapers: binary Blobs in IndexedDB keyed by id, never base64 in localStorage.
// The order and the selection live in the state (customImages, customImage).
const DB_NAME = 'workspace-wallpaper'; // former project name, kept for existing data
const STORE = 'images';

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

export const getImage = (id) => run('readonly', (store) => store.get(id));
export const putImage = (id, blob) => run('readwrite', (store) => store.put(blob, id));
export const deleteImage = (id) => run('readwrite', (store) => store.delete(id));
export const clearImages = () => run('readwrite', (store) => store.clear());
export const storedImageIds = () => run('readonly', (store) => store.getAllKeys());
// Earlier versions kept a single image under the key "selected": it stays a valid id.
export const newImageId = () => `img-${crypto.randomUUID().slice(0, 8)}`;

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
