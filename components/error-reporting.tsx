/**
 * Sentry via its Loader Script rather than the npm SDK. The SDK is ~30KB
 * gzipped, which the sales screen's 200KB budget cannot absorb; the loader is
 * a ~1KB stub that fetches the real SDK only once an error actually happens.
 * On a working day with no crashes, error tracking costs the trader nothing.
 *
 * A plain deferred script tag, rendered on the server: no client component,
 * so it adds nothing to the page's JavaScript when it is not configured.
 *
 * Set NEXT_PUBLIC_SENTRY_LOADER_URL to the "Loader Script" URL from the Sentry
 * project settings (free tier is fine). Unset, this renders nothing.
 */
export function ErrorReporting() {
  const src = process.env.NEXT_PUBLIC_SENTRY_LOADER_URL;
  if (!src) return null;
  return <script src={src} crossOrigin="anonymous" defer />;
}
