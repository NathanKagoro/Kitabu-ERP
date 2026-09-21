import { apportion } from '../money';
import type { PaymentMethod, SaleLine, VatType } from '../types';

export interface CartLine {
  id: string;
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  unitCost: number | null;
  vatType: VatType;
}

export interface Tender {
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
}

export function lineTotal(line: Pick<CartLine, 'qty' | 'unitPrice'>): number {
  return Math.round(line.qty * line.unitPrice);
}

export function cartSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

/**
 * A discount can never turn a sale into a payout, and it can never exceed what
 * was actually sold. Bargaining a price to zero is legitimate; going below is a
 * typo.
 */
export function clampDiscount(subtotal: number, discount: number): number {
  return Math.min(Math.max(Math.round(discount || 0), 0), Math.max(subtotal, 0));
}

export function cartTotal(lines: readonly CartLine[], discount = 0): number {
  const subtotal = cartSubtotal(lines);
  return subtotal - clampDiscount(subtotal, discount);
}

/** Cost of goods sold for the lines whose cost we know. Unknown costs count as zero. */
export function costOfGoods(lines: readonly Pick<SaleLine, 'qty' | 'unitCost'>[]): number {
  return lines.reduce((sum, line) => sum + Math.round(line.qty * (line.unitCost ?? 0)), 0);
}

/**
 * Turns the cart into the sale_lines that get stored. A whole-sale discount is
 * spread across the lines in proportion to their size so that per-product
 * reporting stays honest, and the parts always add back to the discount exactly.
 */
export function buildSaleLines(
  lines: readonly CartLine[],
  discount: number,
  ids: { saleId: string; businessId: string; lineId: (index: number) => string }
): SaleLine[] {
  const totals = lines.map((line) => lineTotal(line));
  const subtotal = totals.reduce((a, b) => a + b, 0);
  const applied = clampDiscount(subtotal, discount);
  const shares = applied > 0 ? apportion(applied, totals) : totals.map(() => 0);

  return lines.map((line, index) => ({
    id: ids.lineId(index),
    businessId: ids.businessId,
    saleId: ids.saleId,
    productId: line.productId,
    description: line.description,
    qty: line.qty,
    unitPrice: line.unitPrice,
    lineTotal: (totals[index] ?? 0) - (shares[index] ?? 0),
    unitCost: line.unitCost,
    vatType: line.vatType,
  }));
}

/**
 * VAT is backed out of the price rather than added to it: the price on a tile
 * is what the customer hands over, in the shop and on the invoice alike.
 * `rate` is a fraction (0.18), and it comes from business settings -- never
 * hard-coded, because the rate is a policy decision that changes.
 */
export function vatBreakdown(
  lines: readonly { lineTotal: number; vatType: VatType }[],
  rate: number
): { subtotal: number; vat: number; total: number } {
  let vat = 0;
  let total = 0;
  for (const line of lines) {
    total += line.lineTotal;
    if (line.vatType === 'standard' && rate > 0) {
      vat += line.lineTotal - Math.round(line.lineTotal / (1 + rate));
    }
  }
  return { subtotal: total - vat, vat, total };
}

/** What is still owed after the tenders offered. Never negative: change is not debt. */
export function creditPortion(total: number, tenders: readonly Tender[]): number {
  const paid = tenders
    .filter((t) => t.method !== 'credit')
    .reduce((sum, t) => sum + Math.round(t.amount || 0), 0);
  return Math.max(total - paid, 0);
}

/** Change owed back to the customer when they over-tender cash. */
export function changeDue(total: number, tenders: readonly Tender[]): number {
  const paid = tenders
    .filter((t) => t.method !== 'credit')
    .reduce((sum, t) => sum + Math.round(t.amount || 0), 0);
  return Math.max(paid - total, 0);
}

/**
 * The payment rows a completed sale produces. The invariant every report leans
 * on: the amounts here always sum to exactly the sale total, with any unpaid
 * remainder carried as a `credit` row.
 */
export function settleSale(total: number, tenders: readonly Tender[]): Tender[] {
  const settled: Tender[] = [];
  let remaining = total;

  for (const tender of tenders) {
    if (tender.method === 'credit') continue;
    const amount = Math.min(Math.round(tender.amount || 0), remaining);
    if (amount <= 0) continue;
    settled.push({ ...tender, amount });
    remaining -= amount;
  }

  if (remaining > 0) settled.push({ method: 'credit', amount: remaining });
  return settled;
}
