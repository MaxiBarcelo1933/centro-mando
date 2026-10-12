// Service worker: guarda una copia de todos los archivos de la app en el teléfono
// para que funcione sin internet.
//
// IMPORTANTE: cada vez que publiques cambios, subí CACHE_VERSION (v1 → v2…).
// Así el teléfono detecta que hay una versión nueva y descarga los archivos de nuevo.
const CACHE_VERSION = 'v3';
const CACHE_NAME = `mando-${CACHE_VERSION}`;

// Todos los archivos que forman la app. Si agregás uno nuevo, sumalo acá.
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/app.css',
  'js/app.js',
  'js/dom.js',
  'js/icons.js',
  'js/dates.js',
  'js/db.js',
  'js/store.js',
  'js/router.js',
  'js/periods.js',
  'js/seed.js',
  'js/components/toast.js',
  'js/components/sheet.js',
  'js/components/chips.js',
  'js/components/form.js',
  'js/components/followup-bits.js',
  'js/components/install-banner.js',
  'js/components/swipe.js',
  'js/views/common.js',
  'js/views/hoy.js',
  'js/views/captura.js',
  'js/views/task-sheet.js',
  'js/views/template-editor.js',
  'js/views/followup-sheet.js',
  'js/views/procesos.js',
  'js/views/seguimientos.js',
  'js/views/ajustes.js',
  'js/views/calendario.js',
  'js/work-seed.js',
  'js/views/proyectos.js',
  'js/views/pdv-sheet.js',
  'icons/icon.svg',
  'icons/apple-touch-icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
];

// En la compu (localhost) primero pedimos a la red, para ver los cambios al instante
// mientras programamos. Publicada, primero usamos la copia guardada (más rápido y offline).
const IS_DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' evita que el navegador use una copia vieja de su propio caché.
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Borramos las copias de versiones anteriores.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('mando-') && key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(IS_DEV ? networkFirst(request) : cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return offlineFallback(cache, request, error);
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    return cached || offlineFallback(cache, request, error);
  }
}

// Sin red y sin copia: si se estaba abriendo una página, mostramos la app igual.
async function offlineFallback(cache, request, error) {
  if (request.mode === 'navigate') {
    const shell = await cache.match('./');
    if (shell) return shell;
  }
  throw error;
}
