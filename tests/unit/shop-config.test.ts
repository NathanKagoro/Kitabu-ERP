import { describe, expect, it } from 'vitest';

import { MODE_FOR_TYPE } from '@/lib/modes';
import { STARTER_PRODUCTS } from '@/lib/onboarding/starter-products';
import {
  brandColorOf,
  DEFAULT_BRAND,
  isPaused,
  mobileMethodsOf,
  paymentMethodsOf,
  PRESETS,
  presetOf,
  SHOP_TYPES,
  shopHasFeature,
  tillNumberFor,
} from '@/lib/shop-config';
import type { Business } from '@/lib/types';

const shop = (over: Partial<Business> = {}): Pick<Business, 'type' | 'mode' | 'settings' | 'status'> => ({
  type: 'cosmetics',
  mode: 'duka',
  settings: {},
  ...over,
});

describe('every shop type is complete', () => {
  it('has a mode, a preset and a starter list', () => {
    for (const type of SHOP_TYPES) {
      expect(MODE_FOR_TYPE[type]).toBeDefined();
      expect(PRESETS[type]).toBeDefined();
      expect(STARTER_PRODUCTS[type]).toBeDefined();
    }
  });

  it('cosmetics ask for a shade, clothes for size and colour', () => {
    expect(presetOf({ type: 'cosmetics' }).variantLabel).toBe('shade');
    expect(presetOf({ type: 'clothes' }).variantLabel).toBe('sizeColour');
    expect(presetOf({ type: 'cosmetics' }).productFields).toContain('variant');
    expect(presetOf({ type: 'genge' }).productFields).toEqual([]);
  });
});

describe('features: shop override, then preset, then mode', () => {
  it('falls back to the mode', () => {
    expect(shopHasFeature(shop({ type: 'duka', mode: 'duka' }), 'stockTracking')).toBe(true);
    expect(shopHasFeature(shop({ type: 'genge', mode: 'genge' }), 'stockTracking')).toBe(false);
  });

  it('the preset can switch a mode feature off', () => {
    // A cosmetics shop does not reprice every morning like a genge.
    expect(shopHasFeature(shop(), 'dailyPriceUpdate')).toBe(false);
    expect(shopHasFeature(shop({ type: 'duka' }), 'dailyPriceUpdate')).toBe(true);
  });

  it('the shop’s own choice wins over both', () => {
    expect(shopHasFeature(shop({ settings: { features: { dailyPriceUpdate: true } } }), 'dailyPriceUpdate')).toBe(true);
    expect(shopHasFeature(shop({ settings: { features: { credit: false } } }), 'credit')).toBe(false);
    expect(shopHasFeature(shop({ settings: { features: { staff: true } } }), 'staff')).toBe(true);
  });
});

describe('payment methods', () => {
  it('all of them until the shop chooses', () => {
    expect(paymentMethodsOf(shop())).toEqual(['cash', 'mpesa', 'mixx', 'airtel', 'halopesa', 'bank']);
  });

  it('only the chosen ones, always in the same order', () => {
    const s = shop({ settings: { paymentMethods: ['airtel', 'cash', 'mpesa'] } });
    expect(paymentMethodsOf(s)).toEqual(['cash', 'mpesa', 'airtel']);
    expect(mobileMethodsOf(s)).toEqual(['mpesa', 'airtel']);
  });

  it('a till number only when one is set', () => {
    const settings = { tillNumbers: { mpesa: ' 5123456 ', airtel: '  ' } };
    expect(tillNumberFor(settings, 'mpesa')).toBe('5123456');
    expect(tillNumberFor(settings, 'airtel')).toBeNull();
    expect(tillNumberFor(settings, 'mixx')).toBeNull();
  });
});

describe('look and status', () => {
  it('the shop’s colour, or Kitabu green for anything that is not a colour', () => {
    expect(brandColorOf(shop({ settings: { brandColor: '#b0225f' } }))).toBe('#b0225f');
    expect(brandColorOf(shop({ settings: { brandColor: 'pink' } }))).toBe(DEFAULT_BRAND);
    expect(brandColorOf(null)).toBe(DEFAULT_BRAND);
  });

  it('only "paused" is paused; records from before 0.3 have no status', () => {
    expect(isPaused(shop({ status: 'paused' }))).toBe(true);
    expect(isPaused(shop({ status: 'active' }))).toBe(false);
    expect(isPaused(shop())).toBe(false);
  });
});
