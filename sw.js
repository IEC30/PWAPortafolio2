/* =========================================================
   PWA Unidad 2 — Service Worker (sw.js)
   Estrategias de Caché, Notificaciones Push Locales y Manejo de Mensajes
   ========================================================= */

const VERSION = 'v2.0.0';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './offline.html',
  './manifest.webmanifest',
  './icons/persona5.png',
  './icons/carafeliz.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

/* ---------- Instalación ---------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker versión:', VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-cacheados recursos estáticos esenciales');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Fallo al precachear:', err))
  );
});

/* ---------- Activación ---------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker versión:', VERSION);
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => {
              console.log('[SW] Eliminando caché obsoleta:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- Intercepción de Peticiones Fetch ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // 1. Navegación: Network-First → Cache → Fallback offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          return (await caches.match(request)) ||
                 (await caches.match('./index.html')) ||
                 (await caches.match('./offline.html'));
        })
    );
    return;
  }

  // 2. Tiles del mapa OpenStreetMap: Cache-First
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 3. Recursos estáticos y scripts: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

/* ---------- Notificaciones Push y Mensajes Locales ---------- */

// Escuchar mensajes provenientes de la ventana (postMessage) para lanzar notificaciones
self.addEventListener('message', (event) => {
  console.log('[SW] Mensaje recibido:', event.data);

  if (event.data && event.data.action === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        badge: 'icons/persona5.png',
        icon: 'icons/persona5.png',
        vibrate: [200, 100, 200],
        ...options
      })
    );
  }

  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Evento disparado cuando el usuario hace clic en la notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Clic en notificación:', event.notification.tag);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// Evento al cerrar la notificación
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notificación cerrada por el usuario:', event.notification.tag);
});
