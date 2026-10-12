// Wrapper chico de IndexedDB (la base de datos que trae el navegador y guarda
// los datos en el propio teléfono). Convierte su API de eventos en promesas.

const DB_NAME = 'centro-mando';
const DB_VERSION = 2;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Este navegador no tiene IndexedDB'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Se ejecuta la primera vez y cada vez que subamos DB_VERSION (migraciones).
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        db.createObjectStore('tasks', { keyPath: 'id' });
        db.createObjectStore('followups', { keyPath: 'id' });
        db.createObjectStore('processTemplates', { keyPath: 'id' });
        db.createObjectStore('processRuns', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      // v2: proyectos (ej. "Estandarización 37 PDV") y sus puntos de venta.
      if (event.oldVersion < 2) {
        db.createObjectStore('projects', { keyPath: 'id' });
        db.createObjectStore('pdvs', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Si otra pestaña actualiza la base, cerramos esta conexión para no trabarla.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña abierta'));
  });
  // Si falla, permitimos reintentar más tarde.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

// Ejecuta una operación en una transacción y espera a que termine de guardarse.
async function run(storeName, mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Se canceló la operación en la base de datos'));
  });
}

export const getAll = (storeName) => run(storeName, 'readonly', (store) => store.getAll());
export const get = (storeName, key) => run(storeName, 'readonly', (store) => store.get(key));
export const put = (storeName, value) => run(storeName, 'readwrite', (store) => store.put(value));
export const remove = (storeName, key) => run(storeName, 'readwrite', (store) => store.delete(key));
export const putMany = (storeName, values) => run(storeName, 'readwrite', (store) => {
  for (const value of values) store.put(value);
});
export const removeMany = (storeName, keys) => run(storeName, 'readwrite', (store) => {
  for (const key of keys) store.delete(key);
});

/**
 * Reemplaza el contenido de varios stores en UNA sola transacción
 * (si algo falla, no se cambia nada). Se usa al importar un backup.
 */
export async function replaceAll(dataByStore) {
  const db = await openDB();
  const names = Object.keys(dataByStore);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    for (const name of names) {
      const store = tx.objectStore(name);
      store.clear();
      for (const value of dataByStore[name]) store.put(value);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Se canceló la importación'));
  });
}

/** Lee todo el contenido de varios stores (para exportar). */
export async function readAll(names) {
  const entries = await Promise.all(names.map(async (name) => [name, await getAll(name)]));
  return Object.fromEntries(entries);
}
