// One-release migration for caches created by the previous hand-written worker.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName === 'bill-splitter-pwa-v2')
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  );
});
