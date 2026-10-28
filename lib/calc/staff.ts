import type { Payment, Sale } from '../types';

/**
 * What each person at the till sold. Every sale and payment records the login
 * that made it (createdBy), so this needs no new data -- only adding up.
 *
 * Cash taken is the cash each person physically received (sales and debt
 * repayments), which is what an owner checks against the drawer at closing.
 */
export interface StaffTotals {
  /** Who: a members.id, or the login's user id for sales from before 0.5. */
  personId: string | null;
  sales: number;
  total: number;
  cash: number;
  /** Sales by this person that were later cancelled. A high count is worth a question. */
  voided: number;
  voidedValue: number;
}

type Attributed = { createdBy?: string | null; memberId?: string | null };

/**
 * Who a row belongs to: the person at the till (memberId) when recorded, else
 * the login that made it, mapped to that login's member when `loginToMember`
 * knows it -- so one person's sales from before and after the till switch
 * land on one line.
 */
export function personOf(row: Attributed, loginToMember: ReadonlyMap<string, string> = new Map()): string | null {
  if (row.memberId) return row.memberId;
  if (!row.createdBy) return null;
  return loginToMember.get(row.createdBy) ?? row.createdBy;
}

export function salesByStaff(
  sales: readonly (Pick<Sale, 'total' | 'status'> & Attributed)[],
  payments: readonly (Pick<Payment, 'method' | 'amount' | 'direction' | 'deletedAt'> & Attributed)[] = [],
  loginToMember: ReadonlyMap<string, string> = new Map()
): StaffTotals[] {
  const by = new Map<string, StaffTotals>();
  const entry = (personId: string | null) => {
    const key = personId ?? '';
    const found = by.get(key);
    if (found) return found;
    const fresh: StaffTotals = { personId, sales: 0, total: 0, cash: 0, voided: 0, voidedValue: 0 };
    by.set(key, fresh);
    return fresh;
  };

  for (const sale of sales) {
    const e = entry(personOf(sale, loginToMember));
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
    entry(personOf(payment, loginToMember)).cash += payment.amount;
  }

  return [...by.values()].sort((a, b) => b.total - a.total || b.sales - a.sales);
}

/** Share of the period's sales, as a whole percent, for the bar beside each name. */
export function shareOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
