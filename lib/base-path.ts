/**
 * Where the app lives on its host. Empty on a domain of its own (kitabu.co.tz),
 * "/kitabu-erp" on GitHub Pages. Next's <Link> and router add it on their own;
 * anything that builds a URL by hand (the service worker, the manifest, a
 * receipt link sent to a customer) goes through here.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  return `${BASE_PATH}${path}`;
}
