// Minimal service worker whose only job is to turn an incoming Web Push
// message into a real OS-level notification (lock screen / notification
// shade), and route a tap on it back into the app. Deliberately not a full
// offline-cache/PWA service worker — just the push piece.

self.addEventListener('push', (event) => {
  let data = { title: 'USHS Portal', body: 'You have a new update.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload — fall back to the defaults above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/admin-hub-logo.png',
      badge: '/admin-hub-logo.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
