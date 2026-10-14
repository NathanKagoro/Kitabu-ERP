'use client';

import { useEffect } from 'react';

import { useApp } from '@/components/app-provider';
import { brandColorOf, DEFAULT_BRAND } from '@/lib/shop-config';

/**
 * Paints the app in the shop's own colour. Every brand-coloured surface reads
 * the --color-brand* variables, so setting three of them on <html> is the whole
 * theme. The darker and lighter shades are mixed from the one colour the
 * owner picks, so nobody has to choose a palette.
 */
export function ThemeColor() {
  const { business } = useApp();
  const color = brandColorOf(business);

  useEffect(() => {
    const root = document.documentElement.style;
    if (color === DEFAULT_BRAND) {
      root.removeProperty('--color-brand');
      root.removeProperty('--color-brand-dark');
      root.removeProperty('--color-brand-tint');
    } else {
      root.setProperty('--color-brand', color);
      root.setProperty('--color-brand-dark', `color-mix(in srgb, ${color} 72%, black)`);
      root.setProperty('--color-brand-tint', `color-mix(in srgb, ${color} 12%, white)`);
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [color]);

  return null;
}
