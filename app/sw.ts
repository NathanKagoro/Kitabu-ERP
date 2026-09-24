import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheableResponsePlugin, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Pages are rendered per request (the language is a cookie), so they cannot be
 * precached at build time the way a static site's can -- and they come back
 * `no-store`, which means nothing caches them by default. Without the two rules
 * below, a phone with no signal has no HTML to open: the shell is gone even
 * though every sale is safe in IndexedDB.
 *
 * So: keep the last good copy of each page and each navigation payload. A
 * screen that has been opened once online opens again with no signal; one that
 * never has falls back to /offline. The response is always revalidated from the
 * network first when there is one, so nobody is served a stale price list.
 */
const pageCache = [
  new CacheableResponsePlugin({ statuses: [200] }),
  new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60 }),
];

/**
 * The screens a trader opens. Moving between them inside the app never fetches
 * a page -- the router swaps payloads -- so without warming this list nothing
 * would be in the cache the first time the app is reopened with no signal.
 *
 * Done once per deployed service worker, on install, which is the only moment
 * we know there is a connection and that these are the current build's pages.
 */
const SHELL_ROUTES = ['/mauzo', '/manunuzi', '/madeni', '/hesabu', '/zaidi', '/bei', '/offline'];

async function warmShell(): Promise<void> {
  const cache = await caches.open('hesabu-pages');
  await Promise.all(
    SHELL_ROUTES.map(async (route) => {
      try {
        // Same-origin, so the language cookie rides along and the cached copy
        // is in the right language.
        const response = await fetch(route, { credentials: 'same-origin' });
        if (response.ok) await cache.put(route, response);
      } catch {
        // No connection during install: NetworkFirst will fill the cache on
        // the first successful visit instead.
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(warmShell());
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // The navigations below are answered from cache when offline, so a preload
  // racing them would only add a request the phone cannot afford.
  navigationPreload: false,
  runtimeCaching: [
    /*
     * A public receipt link is shared with a customer who may open it weeks
     * later, on a different phone, with a stale cache. Always fetch it fresh
     * rather than serve a receipt that might have been voided since.
     */
    {
      matcher: ({ url }) => url.pathname.startsWith('/r/'),
      handler: new NetworkOnly(),
    },
    // The app shell: whole pages.
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'hesabu-pages',
        networkTimeoutSeconds: 4,
        plugins: pageCache,
      }),
    },
    // Moving between tabs inside the app fetches a payload rather than a page.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.searchParams.has('_rsc'),
      handler: new NetworkFirst({
        cacheName: 'hesabu-navigation',
        networkTimeoutSeconds: 4,
        plugins: pageCache,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
