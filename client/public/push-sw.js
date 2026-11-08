// Imported by the Workbox-generated service worker (vite.config.ts → workbox.importScripts).
// Shows staff push notifications even when no admin tab is open.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* non-JSON payload: generic notification */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Natura Lodge', {
    body: data.body || '',
    tag: data.tag,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const open = windows.find(w => w.url.startsWith(self.location.origin));
    if (open) {
      return open.focus().then(w => ('navigate' in w ? w.navigate(url) : w)).catch(() => self.clients.openWindow(url));
    }
    return self.clients.openWindow(url);
  }));
});
