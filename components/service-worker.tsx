'use client';

import { useEffect } from 'react';

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    const container = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    if (!container) return;
    container.register('/sw.js', { scope: '/' }).catch(() => {
      // Not fatal: the app works without it, it just cannot open with no signal.
    });
  }, []);
  return null;
}
