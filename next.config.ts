import withSerwistInit from '@serwist/next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin({
  requestConfig: './lib/i18n/request.ts',
  experimental: {
    // Compile ICU messages at build time so the client never ships the parser.
    messages: { path: './messages', format: 'json', locales: 'infer', precompile: true },
  },
});

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // The service worker is a liability in dev: it caches half-built chunks.
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: false,
  // Registered by <ServiceWorker/>, which checks the API exists first: some
  // in-app browsers (and WebViews) have no service worker support at all.
  register: false,
  // Pages are rendered per request (the language cookie), so the app shell is
  // cached as it is visited; the offline page must be there from install.
  additionalPrecacheEntries: [{ url: '/offline', revision: process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now()) }],
});

export default withSerwist(
  withNextIntl({
    reactStrictMode: true,
    // e2e builds point at a fake backend; keep them out of the real build dir.
    distDir: process.env.NEXT_DIST_DIR ?? '.next',
    typedRoutes: false,
  })
);
