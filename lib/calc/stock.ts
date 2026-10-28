import type { StockMovement } from '../types';

/**
 * Stock is never stored as a number that can drift. It is the ledger: every
 * sale, purchase and loss is a movement, and on-hand is what they add up to.
 *
 * A stock count is different. It does not say "remove 2"; it says "at 14:05
 * the shelf held exactly 9" (`setsQty`). So on-hand is the latest count, plus
 * only the movements recorded *after* it. Two things follow, and both matter
 * because the count is the number the whole pitch rests on:
 *
 *   - A sale made at 13:50 on a cashier's phone that only syncs tonight lands
 *     before the count, so it changes nothing: the shelf was already counted
 *     without those lotions. Summing a difference instead would take them off
 *     twice and leave the records 2 below the shelf.
 *   - A sale made at 14:10, after that shelf was counted, is still subtracted.
 *
 * Order is by the phone's own clock (createdAt), then by id, which is a UUID
 * v7 and so also time-ordered.
 */

type Ledgered = Pick<StockMovement, 'id' | 'qty' | 'createdAt'> & { setsQty?: number | null };

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

const after = (a: Ledgered, b: Ledgered) => a.createdAt > b.createdAt || (a.createdAt === b.createdAt && a.id > b.id);

const isCount = (m: Ledgered) => m.setsQty != null;

/** The latest count in a set of movements for one product, or null. */
export function latestCount<T extends Ledgered>(movements: readonly T[]): T | null {
  let latest: T | null = null;
  for (const m of movements) if (isCount(m) && (!latest || after(m, latest))) latest = m;
  return latest;
}

export function stockOnHand(movements: readonly Ledgered[]): number {
  const count = latestCount(movements);
  let total = count ? Number(count.setsQty) : 0;
  for (const m of movements) {
    if (isCount(m)) continue;
    if (count && !after(m, count)) continue;
    total += m.qty;
  }
  return round3(total);
}

/** On-hand as it stood at a moment: the ledger up to and including `at`. */
export function stockAsOf(movements: readonly Ledgered[], at: string, excludeId?: string): number {
  return stockOnHand(movements.filter((m) => m.createdAt <= at && m.id !== excludeId));
}

export function stockByProduct(movements: readonly (Ledgered & Pick<StockMovement, 'productId'>)[]): Map<string, number> {
  const byProduct = new Map<string, Ledgered[]>();
  for (const m of movements) {
    const list = byProduct.get(m.productId);
    if (list) list.push(m);
    else byProduct.set(m.productId, [m]);
  }
  const totals = new Map<string, number>();
  for (const [id, list] of byProduct) totals.set(id, stockOnHand(list));
  return totals;
}

/**
 * What a unit of stock cost on average: every unit received with a known
 * cost (purchases and opening stock), weighted by quantity. This is what a
 * shortfall is valued at -- not the most recent price, which after one
 * expensive delivery would overstate every loss.
 */
export function averageUnitCost(
  movements: readonly Pick<StockMovement, 'qty' | 'unitCost' | 'type'>[],
  fallback: number | null | undefined = null
): number | null {
  let units = 0;
  let value = 0;
  for (const m of movements) {
    if (m.qty <= 0 || m.unitCost == null || m.unitCost <= 0) continue;
    if (m.type !== 'purchase' && m.type !== 'adjust') continue;
    units += m.qty;
    value += m.qty * m.unitCost;
  }
  if (units > 0) return Math.round(value / units);
  return fallback != null && fallback > 0 ? fallback : null;
}

export function isLowStock(onHand: number, lowStockLevel: number | null | undefined): boolean {
  if (lowStockLevel == null) return false;
  return onHand <= lowStockLevel;
}

/**
 * Weighted-average cost after receiving new stock.
 *
 * Deliberately weighted-average rather than FIFO: a trader buying two crates of
 * tomatoes at different prices on the same morning thinks of "what a crate cost
 * me", not of which crate a given heap came from.
 *
 * Returns integer TZS per unit. Stock already on hand that was bought at an
 * unknown cost is ignored rather than treated as free, otherwise the first
 * purchase would drag the average to nearly zero.
 */
export function weightedAverageCost(input: {
  currentQty: number;
  currentCost: number | null | undefined;
  incomingQty: number;
  incomingTotalCost: number;
}): number {
  const { currentQty, currentCost, incomingQty, incomingTotalCost } = input;

  if (incomingQty <= 0) return currentCost ?? 0;

  const incomingUnitCost = incomingTotalCost / incomingQty;
  const haveExistingValue = currentCost != null && currentCost > 0 && currentQty > 0;

  if (!haveExistingValue) return Math.round(incomingUnitCost);

  const totalValue = currentQty * currentCost + incomingTotalCost;
  const totalQty = currentQty + incomingQty;
  return Math.round(totalValue / totalQty);
}

/** Value of stock lost to spoilage or theft, at the cost we paid for it. */
export function wasteCost(qty: number, unitCost: number | null | undefined): number {
  if (!unitCost || unitCost <= 0) return 0;
  return Math.round(qty * unitCost);
}
