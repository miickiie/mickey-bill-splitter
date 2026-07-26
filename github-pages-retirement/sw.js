const RETIRED_SCOPE_URL = self.registration.scope;

const isRetiredAppCache = (cacheName) =>
  cacheName.startsWith('bill-splitter-pwa-') ||
  (cacheName.startsWith('workbox-precache-') &&
    cacheName.endsWith(RETIRED_SCOPE_URL));

const clearRetiredCaches = async () => {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(isRetiredAppCache)
      .map((cacheName) => caches.delete(cacheName)),
  );
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await clearRetiredCaches();
      await self.clients.claim();

      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      await Promise.all(
        windowClients.map((client) =>
          client.navigate(RETIRED_SCOPE_URL).catch(() => undefined),
        ),
      );

      await self.registration.unregister();
    })(),
  );
});
