import type { ProductUnit } from './types';

/**
 * Selling units as they are actually used in a Tanzanian market. `fungu` (a heap
 * on a mat) is the unit most genge stock is sold in and has no metric meaning --
 * that is fine, it is a unit of sale, not of measure.
 */
export const PRODUCT_UNITS: readonly ProductUnit[] = [
  'fungu',
  'kipande',
  'kg',
  'lita',
  'bunda',
  'debe',
  'pakti',
  'dazeni',
  'custom',
];

/** Units you can sell a fraction of. A half-kilo is normal; half a heap is not. */
const FRACTIONAL: ReadonlySet<ProductUnit> = new Set<ProductUnit>(['kg', 'lita', 'debe']);

export function allowsDecimals(unit: ProductUnit): boolean {
  return FRACTIONAL.has(unit);
}

export function quantityStep(unit: ProductUnit): number {
  return allowsDecimals(unit) ? 0.25 : 1;
}

/**
 * Quantities are stored to three decimals. Display drops trailing zeros so a
 * tile reads "2" rather than "2.000".
 */
export function formatQty(qty: number): string {
  const rounded = Math.round((qty + Number.EPSILON) * 1000) / 1000;
  return String(rounded);
}

/** Snaps a typed quantity to what the unit can actually represent. */
export function normaliseQty(qty: number, unit: ProductUnit): number {
  if (!Number.isFinite(qty)) return 0;
  const clamped = Math.max(0, qty);
  if (!allowsDecimals(unit)) return Math.round(clamped);
  return Math.round(clamped * 1000) / 1000;
}
