import { describe, expect, it } from 'vitest';

import { salesByStaff, shareOf } from '@/lib/calc/staff';

describe('sales by staff member', () => {
  const sale = (createdBy: string | null, total: number, status: 'complete' | 'void' = 'complete') => ({ createdBy, total, status });
  const cash = (createdBy: string | null, amount: number, over: Record<string, unknown> = {}) => ({
    createdBy,
    amount,
    method: 'cash' as const,
    direction: 'in' as const,
    deletedAt: null,
    ...over,
  });

  it('adds up each person’s sales, best first', () => {
    const rows = salesByStaff([sale('owner', 10000), sale('juma', 25000), sale('juma', 5000), sale('owner', 2000)]);
    expect(rows.map((r) => [r.userId, r.sales, r.total])).toEqual([
      ['juma', 2, 30000],
      ['owner', 2, 12000],
    ]);
  });

  it('cancelled sales are counted apart, not in the total', () => {
    const [juma] = salesByStaff([sale('juma', 8000), sale('juma', 40000, 'void')]);
    expect(juma).toMatchObject({ sales: 1, total: 8000, voided: 1, voidedValue: 40000 });
  });

  it('cash taken is the cash each person received, including debt repayments', () => {
    const rows = salesByStaff(
      [sale('juma', 8000)],
      [
        cash('juma', 8000),
        cash('juma', 3000), // a customer paying off their daftari
        cash('juma', 5000, { method: 'mpesa' }),
        cash('juma', 9999, { direction: 'out' }),
        cash('juma', 1000, { deletedAt: '2026-10-01' }),
      ]
    );
    expect(rows[0]).toMatchObject({ cash: 11000 });
  });

  it('sales from before staff logins existed are kept, under no one', () => {
    const rows = salesByStaff([sale(null, 500)]);
    expect(rows).toEqual([{ userId: null, sales: 1, total: 500, cash: 0, voided: 0, voidedValue: 0 }]);
  });

  it('share of the period', () => {
    expect(shareOf(30000, 42000)).toBe(71);
    expect(shareOf(5, 0)).toBe(0);
  });
});
