import { hasFeature, type Feature } from './modes';
import type { Business, BusinessSettings, BusinessType, PaymentMethod, ProductUnit } from './types';

/**
 * Everything that makes one shop's copy of Kitabu its own. There is one app
 * for every shop; what differs lives here and in `businesses.settings`, and is
 * set by the operator when the shop is created (see /admin) or later by the
 * owner in Mipangilio.
 *
 *   - Shop type   -> a preset: which screens show, starter categories, which
 *                    product details are asked for (shade, size, barcode...).
 *   - Branding    -> colour, logo, receipt details.
 *   - Money       -> which payment methods appear, till numbers, VAT, credit.
 *   - Features    -> per-shop on/off overrides on top of the preset.
 */

export const DEFAULT_BRAND = '#0f6b3f';

/** Colours offered in the picker: all hold up in sunlight against white text. */
export const BRAND_COLOURS = [
  '#0f6b3f', // Kitabu green
  '#1c5c8a', // blue
  '#6b2fa3', // purple
  '#b0225f', // berry (cosmetics shops like this one)
  '#a32020', // red
  '#a8600a', // amber
  '#2f3a45', // slate
  '#0e6e6e', // teal
] as const;

export const ALL_PAYMENT_METHODS: readonly Exclude<PaymentMethod, 'credit'>[] = [
  'cash',
  'mpesa',
  'mixx',
  'airtel',
  'halopesa',
  'bank',
];

/** The shop types offered at setup, in the order they are shown. */
export const SHOP_TYPES: readonly BusinessType[] = [
  'cosmetics',
  'clothes',
  'hardware',
  'duka',
  'genge',
  'pharmacy',
  'wholesale',
  'services',
  'other',
];

/** A product detail a shop type asks for, beyond name and price. */
export type ProductField = 'category' | 'variant' | 'barcode';

export interface ShopPreset {
  /** Extra product details the product form and bulk entry ask for. */
  productFields: readonly ProductField[];
  /** What a variant is called in this trade: shade, size, colour, gauge. */
  variantLabel: 'shade' | 'size' | 'sizeColour' | 'spec' | null;
  /** Categories offered when adding products. The owner can type others. */
  categories: readonly string[];
  /** The unit most products in this trade are sold by. */
  defaultUnit: ProductUnit;
  /** Feature overrides on top of the mode (genge/duka/biashara) defaults. */
  features?: Partial<Record<Feature, boolean>>;
}

/**
 * The presets. Categories are named the way the shop owner says them; they
 * are a head start, not a rule.
 */
export const PRESETS: Record<BusinessType, ShopPreset> = {
  cosmetics: {
    productFields: ['category', 'variant', 'barcode'],
    variantLabel: 'shade',
    categories: ['Mafuta ya ngozi', 'Losheni', 'Sabuni', 'Manukato', 'Make-up', 'Nywele', 'Kucha', 'Vipodozi vingine'],
    defaultUnit: 'kipande',
    // Most cosmetics shops have an assistant at the counter.
    features: { dailyPriceUpdate: false, staff: true },
  },
  clothes: {
    productFields: ['category', 'variant', 'barcode'],
    variantLabel: 'sizeColour',
    categories: ['Magauni', 'Mashati', 'Suruali', 'Viatu', 'Mikoba', 'Vito', 'Nguo za watoto', 'Vingine'],
    defaultUnit: 'kipande',
    features: { dailyPriceUpdate: false, staff: true },
  },
  hardware: {
    productFields: ['category', 'variant', 'barcode'],
    variantLabel: 'spec',
    categories: ['Saruji', 'Nondo na chuma', 'Mabati', 'Misumari na skrubu', 'Rangi', 'Bomba na maji', 'Umeme', 'Zana', 'Mbao'],
    defaultUnit: 'kipande',
  },
  duka: {
    productFields: ['category'],
    variantLabel: null,
    categories: ['Vyakula', 'Vinywaji', 'Usafi', 'Vocha', 'Vingine'],
    defaultUnit: 'kipande',
  },
  genge: { productFields: [], variantLabel: null, categories: [], defaultUnit: 'fungu' },
  pharmacy: {
    productFields: ['category', 'variant', 'barcode'],
    variantLabel: 'spec',
    categories: ['Dawa za maumivu', 'Antibiotiki', 'Vitamini', 'Vifaa tiba', 'Usafi', 'Vingine'],
    defaultUnit: 'pakti',
  },
  wholesale: {
    productFields: ['category', 'variant'],
    variantLabel: 'spec',
    categories: ['Vyakula', 'Vinywaji', 'Usafi', 'Vingine'],
    defaultUnit: 'kipande',
  },
  services: { productFields: ['category'], variantLabel: null, categories: ['Huduma'], defaultUnit: 'kipande' },
  other: { productFields: ['category', 'variant'], variantLabel: 'spec', categories: [], defaultUnit: 'kipande' },
};

export function presetOf(business: Pick<Business, 'type'> | null | undefined): ShopPreset {
  return PRESETS[business?.type as BusinessType] ?? PRESETS.other;
}

/**
 * Is a feature switched on for this shop? Shop-level overrides win, then the
 * shop type's preset, then the mode's default.
 */
export function shopHasFeature(business: Pick<Business, 'type' | 'mode' | 'settings'> | null | undefined, feature: Feature): boolean {
  const own = business?.settings?.features?.[feature];
  if (typeof own === 'boolean') return own;
  const preset = presetOf(business).features?.[feature];
  if (typeof preset === 'boolean') return preset;
  return hasFeature(business?.mode ?? 'genge', feature);
}

export function brandColorOf(business: Pick<Business, 'settings'> | null | undefined): string {
  const color = business?.settings?.brandColor;
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BRAND;
}

/** Payment methods this shop takes, cash first. Credit is a feature, not a method here. */
export function paymentMethodsOf(business: Pick<Business, 'settings'> | null | undefined): Exclude<PaymentMethod, 'credit'>[] {
  const chosen = business?.settings?.paymentMethods;
  if (!Array.isArray(chosen) || chosen.length === 0) return [...ALL_PAYMENT_METHODS];
  const set = new Set(chosen);
  return ALL_PAYMENT_METHODS.filter((m) => set.has(m));
}

/** The mobile-money methods this shop takes, in display order. */
export function mobileMethodsOf(business: Pick<Business, 'settings'> | null | undefined): Exclude<PaymentMethod, 'credit'>[] {
  return paymentMethodsOf(business).filter((m) => m !== 'cash' && m !== 'bank');
}

/** "Lipa Namba" / till number shown on receipts and the payment sheet. */
export function tillNumberFor(settings: BusinessSettings | null | undefined, method: PaymentMethod): string | null {
  const value = settings?.tillNumbers?.[method];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** A shop the operator has paused (e.g. the monthly fee is overdue). */
export function isPaused(business: Pick<Business, 'status'> | null | undefined): boolean {
  return business?.status === 'paused';
}
