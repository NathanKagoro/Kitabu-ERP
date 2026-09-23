import type { ProductPack } from '../types';

/**
 * Buying and selling happen in different units. A trader buys a *tenga* of
 * tomatoes and sells *fungu*; buys a 50kg *gunia* of rice and sells kilos.
 * Everything downstream -- stock, cost, profit -- works in selling units, so
 * packs are converted here, once, at the point of purchase.
 */

/** The single selling unit, offered alongside real packs so buying loose still works. */
export const LOOSE_PACK_ID = 'loose';

export interface PackChoice {
  id: string;
  label: string;
  units: number;
}

export function packChoices(packs: readonly ProductPack[], looseLabel: string): PackChoice[] {
  const live = packs
    .filter((pack) => pack.active && !pack.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder || b.units - a.units)
    .map((pack) => ({ id: pack.id, label: pack.label, units: pack.units }));
  return [...live, { id: LOOSE_PACK_ID, label: looseLabel, units: 1 }];
}

/** Selling units received: 2 tenga of 40 = 80 fungu. */
export function packToUnits(packQty: number, unitsPerPack: number): number {
  if (!(packQty > 0) || !(unitsPerPack > 0)) return 0;
  return Math.round(packQty * unitsPerPack * 1000) / 1000;
}

/**
 * What one selling unit cost, given what a bulk buy cost. This is the number
 * that makes a purchase price comparable with a shelf price -- 60,000 a tenga
 * means nothing until it is 1,500 a fungu.
 */
export function costPerUnit(totalCost: number, units: number): number {
  if (!(units > 0)) return 0;
  return Math.round(totalCost / units);
}

/**
 * Margin on one selling unit at the current price. Returned as both money and
 * a percentage of the price, because "200 a heap" and "20%" answer different
 * questions and traders use both.
 */
export function unitMargin(price: number, unitCost: number): { profit: number; percent: number } {
  const profit = Math.round(price - unitCost);
  return { profit, percent: price > 0 ? Math.round((profit / price) * 1000) / 10 : 0 };
}
