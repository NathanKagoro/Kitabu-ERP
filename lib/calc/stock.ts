import type { StockMovement } from '../types';

/**
 * Stock is never stored as a number that can drift. It is always the sum of an
 * append-only ledger, which means a sale recorded offline three days ago still
 * lands in the right place when it finally syncs.
 */
export function stockOnHand(movements: readonly StockMovement[]): number {
  const total = movements.reduce((sum, m) => sum + m.qty, 0);
  // Three decimals is the storage precision; summing floats can leave dust.
  return Math.round((total + Number.EPSILON) * 1000) / 1000;
}

export function stockByProduct(movements: readonly StockMovement[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const m of movements) {
    totals.set(m.productId, (totals.get(m.productId) ?? 0) + m.qty);
  }
  for (const [id, value] of totals) {
    totals.set(id, Math.round((value + Number.EPSILON) * 1000) / 1000);
  }
  return totals;
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
