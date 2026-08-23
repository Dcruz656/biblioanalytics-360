self.addEventListener('push', event => {
  const { title, body, url } = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(title ?? 'Biblioteca', {
      body: body ?? 'Aviso de reserva',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'biblio-reserva',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'));
});
