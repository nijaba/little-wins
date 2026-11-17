// Service worker: only for the evening reminder (Web Push). It caches nothing.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Little Wins', {
      body: data.body || '',
      icon: '/icon-192.png',
      tag: 'little-wins-reminder',
      data: { url: data.url || '/' },
    }),
  );
});

// Tapping the reminder opens the app, or brings an open one to the front.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if (w.url.startsWith(self.location.origin)) return w.focus();
      return self.clients.openWindow(url);
    }),
  );
});
