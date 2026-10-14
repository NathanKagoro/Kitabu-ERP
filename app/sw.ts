import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheableResponsePlugin, ExpirationPlugin, NetworkFirst, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * The app is static files. The screens a trader opens are precached at install
 * (next.config.ts, additionalPrecacheEntries), so the installed app opens with
 * no signal from day one. Any other page is kept the first time it is opened.
 * Pages are revalidated from the network first when there is one, so nobody is
 * served a stale build for long.
 */
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

const pageCache = [
  new CacheableResponsePlugin({ statuses: [200] }),
  new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // The navigations below are answered from cache when offline, so a preload
  // racing them would only add a request the phone cannot afford.
  navigationPreload: false,
  runtimeCaching: [
    /*
     * The app shell: whole pages. A page is the same file whatever its ?id=
     * (the record is read from the phone), so the query is ignored: a product
     * opened once offline-capable means every product opens offline.
     */
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: 'kitabu-pages',
        networkTimeoutSeconds: 4,
        matchOptions: { ignoreSearch: true },
        plugins: pageCache,
      }),
    },
    // Moving between tabs inside the app fetches a payload rather than a page.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.searchParams.has('_rsc'),
      handler: new NetworkFirst({
        cacheName: 'kitabu-navigation',
        networkTimeoutSeconds: 4,
        plugins: pageCache,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: `${BASE}/offline/`,
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
