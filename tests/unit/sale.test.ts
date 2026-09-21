import { describe, expect, it } from 'vitest';

import {
  buildSaleLines,
  cartTotal,
  changeDue,
  clampDiscount,
  costOfGoods,
  creditPortion,
  settleSale,
  vatBreakdown,
  type CartLine,
} from '@/lib/calc/sale';

const line = (qty: number, unitPrice: number, unitCost: number | null = null): CartLine => ({
  id: `l${qty}${unitPrice}`,
  productId: 'p',
  description: 'x',
  qty,
  unitPrice,
  unitCost,
  vatType: 'standard',
});

describe('cart totals', () => {
  it('multiplies qty by price and rounds to the shilling', () => {
    expect(cartTotal([line(1.5, 2500), line(2, 1000)])).toBe(5750);
    expect(cartTotal([line(0.333, 1000)])).toBe(333);
  });

  it('clamps discounts to [0, subtotal]', () => {
    expect(clampDiscount(1000, -50)).toBe(0);
    expect(clampDiscount(1000, 1500)).toBe(1000);
    expect(cartTotal([line(1, 1000)], 200)).toBe(800);
  });
});

describe('buildSaleLines', () => {
  it('spreads the discount so line totals still sum to the sale total', () => {
    const cart = [line(1, 1000), line(1, 2000), line(1, 3000)];
    const lines = buildSaleLines(cart, 100, { saleId: 's', businessId: 'b', lineId: (i) => `id${i}` });
    expect(lines.reduce((s, l) => s + l.lineTotal, 0)).toBe(cartTotal(cart, 100));
    expect(lines.map((l) => l.lineTotal)).toEqual([983, 1967, 2950]);
  });

  it('keeps the cost snapshot on each line', () => {
    const [first] = buildSaleLines([line(2, 1000, 600)], 0, { saleId: 's', businessId: 'b', lineId: () => 'x' });
    expect(first?.unitCost).toBe(600);
    expect(costOfGoods([first!])).toBe(1200);
  });
});

describe('settleSale', () => {
  it('cash in full is one cash row', () => {
    expect(settleSale(5000, [{ method: 'cash', amount: 5000 }])).toEqual([{ method: 'cash', amount: 5000 }]);
  });

  it('over-tendered cash is capped at the total; the rest is change', () => {
    const tenders = [{ method: 'cash' as const, amount: 10000 }];
    expect(settleSale(7000, tenders)).toEqual([{ method: 'cash', amount: 7000 }]);
    expect(changeDue(7000, tenders)).toBe(3000);
  });

  it('a split sale leaves the remainder as credit', () => {
    expect(settleSale(10000, [{ method: 'cash', amount: 4000 }])).toEqual([
      { method: 'cash', amount: 4000 },
      { method: 'credit', amount: 6000 },
    ]);
    expect(creditPortion(10000, [{ method: 'cash', amount: 4000 }])).toBe(6000);
  });

  it('always sums to exactly the sale total', () => {
    for (const [total, paid] of [
      [1000, 0],
      [1000, 999],
      [1000, 1000],
      [1000, 5000],
    ] as const) {
      const rows = settleSale(total, [{ method: 'mpesa', amount: paid }]);
      expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(total);
    }
  });

  it('a pure credit sale is one credit row', () => {
    expect(settleSale(3000, [])).toEqual([{ method: 'credit', amount: 3000 }]);
  });
});

describe('vatBreakdown', () => {
  it('backs VAT out of inclusive prices at the configured rate', () => {
    expect(vatBreakdown([{ lineTotal: 11800, vatType: 'standard' }], 0.18)).toEqual({ subtotal: 10000, vat: 1800, total: 11800 });
  });

  it('exempt lines carry no VAT', () => {
    const r = vatBreakdown(
      [
        { lineTotal: 11800, vatType: 'standard' },
        { lineTotal: 5000, vatType: 'exempt' },
      ],
      0.18
    );
    expect(r).toEqual({ subtotal: 15000, vat: 1800, total: 16800 });
  });

  it('follows the rate setting rather than a constant', () => {
    expect(vatBreakdown([{ lineTotal: 11500, vatType: 'standard' }], 0.15).vat).toBe(1500);
    expect(vatBreakdown([{ lineTotal: 11500, vatType: 'standard' }], 0).vat).toBe(0);
  });
});
