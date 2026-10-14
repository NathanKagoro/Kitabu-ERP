#!/usr/bin/env node
/**
 * Serves the static export (out/) the way GitHub Pages does: /mauzo/ ->
 * /mauzo/index.html, everything else as a file, 404.html for anything missing.
 * Used by the end-to-end tests and `npm run preview`. No dependencies.
 *
 *   node scripts/serve-static.mjs [port] [dir]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2] ?? 3217);
const root = resolve(process.argv[3] ?? 'out');
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function fileFor(pathname) {
  let path = decodeURIComponent(pathname);
  if (base && path.startsWith(base)) path = path.slice(base.length) || '/';
  const target = normalize(join(root, path));
  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, 'index.html');
  if (existsSync(index)) return index;
  if (existsSync(`${target}.html`)) return `${target}.html`;
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // /mauzo -> /mauzo/, as GitHub Pages does.
  if (!url.pathname.endsWith('/') && !extname(url.pathname) && fileFor(`${url.pathname}/`)) {
    res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
    res.end();
    return;
  }
  const file = fileFor(url.pathname);
  const status = file ? 200 : 404;
  const served = file ?? join(root, '404.html');
  res.writeHead(status, {
    'Content-Type': TYPES[extname(served)] ?? 'application/octet-stream',
    'Cache-Control': served.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0',
  });
  createReadStream(served).pipe(res);
}).listen(port, () => {
  console.log(`serving ${root} at http://localhost:${port}${base}/`);
});
