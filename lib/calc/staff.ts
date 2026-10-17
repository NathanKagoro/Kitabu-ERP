import type { Payment, Sale } from '../types';

/**
 * What each person at the till sold. Every sale and payment records the login
 * that made it (createdBy), so this needs no new data -- only adding up.
 *
 * Cash taken is the cash each person physically received (sales and debt
 * repayments), which is what an owner checks against the drawer at closing.
 */
export interface StaffTotals {
  userId: string | null;
  sales: number;
  total: number;
  cash: number;
  /** Sales by this person that were later cancelled. A high count is worth a question. */
  voided: number;
  voidedValue: number;
}

export function salesByStaff(
  sales: readonly Pick<Sale, 'createdBy' | 'total' | 'status'>[],
  payments: readonly Pick<Payment, 'createdBy' | 'method' | 'amount' | 'direction' | 'deletedAt'>[] = []
): StaffTotals[] {
  const by = new Map<string, StaffTotals>();
  const entry = (userId: string | null | undefined) => {
    const key = userId ?? '';
    const found = by.get(key);
    if (found) return found;
    const fresh: StaffTotals = { userId: userId ?? null, sales: 0, total: 0, cash: 0, voided: 0, voidedValue: 0 };
    by.set(key, fresh);
    return fresh;
  };

  for (const sale of sales) {
    const e = entry(sale.createdBy);
    if (sale.status === 'void') {
      e.voided += 1;
      e.voidedValue += sale.total;
    } else {
      e.sales += 1;
      e.total += sale.total;
    }
  }
  for (const payment of payments) {
    if (payment.deletedAt || payment.direction !== 'in' || payment.method !== 'cash') continue;
    entry(payment.createdBy).cash += payment.amount;
  }

  return [...by.values()].sort((a, b) => b.total - a.total || b.sales - a.sales);
}

/** Share of the period's sales, as a whole percent, for the bar beside each name. */
export function shareOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
