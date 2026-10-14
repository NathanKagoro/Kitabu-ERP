import withSerwistInit from '@serwist/next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Kitabu builds to plain files (`out/`) that any static host can serve:
 * GitHub Pages, Netlify, Cloudflare Pages, a folder on a USB stick. Nothing
 * runs on the host. The data lives on the phone and syncs to Supabase.
 *
 * NEXT_PUBLIC_BASE_PATH is set when the app is served from a sub-folder, as on
 * GitHub Pages (/kitabu-erp).
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

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
  // The static export writes every screen as its own HTML file; precache the
  // ones a trader opens so the installed app opens with no signal from day one.
  additionalPrecacheEntries: [
    '/', '/ingia/', '/mauzo/', '/manunuzi/', '/madeni/', '/hesabu/', '/zaidi/', '/bei/', '/offline/',
  ].map((url) => ({ url: `${basePath}${url}`, revision: process.env.GITHUB_SHA ?? String(Date.now()) })),
});

export default withSerwist(
  withNextIntl({
    output: 'export',
    // /mauzo/index.html rather than /mauzo.html: works on every static host,
    // including GitHub Pages, without rewrite rules.
    trailingSlash: true,
    basePath: basePath || undefined,
    images: { unoptimized: true },
    reactStrictMode: true,
    distDir: process.env.NEXT_DIST_DIR ?? '.next',
    typedRoutes: false,
  })
);
