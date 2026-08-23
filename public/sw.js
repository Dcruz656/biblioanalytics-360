const CACHE = 'biblio-v2';
const OFFLINE_URL = '/kiosco';

// Instalar: cachear shell de la app
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(['/', '/kiosco', '/registro', '/icon-192.png', '/icon-512.png', '/favicon.svg'])
    ).then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first para API, cache-first para assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Dejar pasar peticiones a Supabase y externos sin interferir
  if (!url.origin.includes(self.location.origin)) return;
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request).then(r => r || caches.match(OFFLINE_URL)))
  );
});

// Push notifications
self.addEventListener('push', event => {
  const { title, body, url } = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(title ?? 'Biblioteca', {
      body: body ?? 'Aviso de reserva',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'biblio-reserva',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: url ?? '/kiosco' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/kiosco'));
});
