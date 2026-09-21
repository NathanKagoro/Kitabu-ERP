import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hesabu',
    short_name: 'Hesabu',
    description: 'Biashara yako, mkononi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf8f4',
    theme_color: '#0f6b3f',
    lang: 'sw',
    dir: 'ltr',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Mauzo', short_name: 'Mauzo', url: '/mauzo' },
      { name: 'Madeni', short_name: 'Madeni', url: '/madeni' },
      { name: 'Hesabu ya leo', short_name: 'Hesabu', url: '/hesabu' },
    ],
  };
}
