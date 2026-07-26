const PRODUCTION_URL = 'https://spliittrr.web.app/';
const RETIRED_SCOPE_PATH = '/mickey-bill-splitter/';
const RETIRED_SCOPE_URL = `${window.location.origin}${RETIRED_SCOPE_PATH}`;

const isRetiredAppCache = (cacheName) =>
  cacheName.startsWith('bill-splitter-pwa-') ||
  (cacheName.startsWith('workbox-precache-') &&
    cacheName.endsWith(RETIRED_SCOPE_URL));

const clearRetiredCaches = async () => {
  if (!('caches' in window)) {
    return;
  }

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(isRetiredAppCache)
      .map((cacheName) => caches.delete(cacheName)),
  );
};

const redirectToProduction = () => {
  window.location.replace(PRODUCTION_URL);
};

const retireGitHubPwa = async () => {
  const fallbackRedirect = window.setTimeout(redirectToProduction, 5000);

  try {
    await clearRetiredCaches();

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register(
        `${RETIRED_SCOPE_PATH}sw.js`,
        {
          scope: RETIRED_SCOPE_PATH,
          updateViaCache: 'none',
        },
      );

      await registration.update();

      await new Promise((resolve) => {
        const activationTimeout = window.setTimeout(resolve, 2000);

        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            window.clearTimeout(activationTimeout);
            resolve();
          },
          {once: true},
        );
      });
    }
  } catch {
    // The redirect must still work when storage or Service Worker APIs fail.
  } finally {
    window.clearTimeout(fallbackRedirect);
    redirectToProduction();
  }
};

void retireGitHubPwa();
