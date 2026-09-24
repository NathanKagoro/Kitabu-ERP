'use client';

import { useEffect } from 'react';

/**
 * Pulls the code-split screens into the cache once the app is idle.
 *
 * The POS sheets and the PIN screen are deliberately not in the first load --
 * that is what keeps the sales screen inside its data budget -- but they are
 * fetched the first time they are needed, and "the first time" is exactly when
 * a trader is standing in a market with no signal. The build's own precache
 * does not cover them, so they are warmed here instead: after the screen is
 * usable, while there is still a connection, at idle priority.
 *
 * Each import is tiny (a few KB) and happens once per version; afterwards the
 * service worker serves them from cache.
 */
const LAZY_SCREENS = [
  () => import('@/components/pin-lock'),
  () => import('@/components/pos/payment-sheet'),
  () => import('@/components/pos/success-sheet'),
  () => import('@/components/pos/cart-sheet'),
  () => import('@/components/pos/line-editor'),
  () => import('@/components/pos/quick-sale-sheet'),
];

export function WarmChunks() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    // Deliberately after the screen is interactive: a trader who opens the app
    // to take a sale must never wait on this.
    const timer = window.setTimeout(() => {
      const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 1));
      idle(() => {
        for (const load of LAZY_SCREENS) {
          // A failure here costs nothing: the screen still loads on demand.
          void load().catch(() => undefined);
        }
      });
    }, 2500);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
