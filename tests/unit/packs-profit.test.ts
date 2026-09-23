import { describe, expect, it } from 'vitest';

import { costPerUnit, LOOSE_PACK_ID, packChoices, packToUnits, unitMargin } from '@/lib/calc/packs';
import { productProfitability, totalsOf } from '@/lib/calc/profit';
import type { Product, ProductPack, PurchaseLine, SaleLine } from '@/lib/types';

const at = '2026-03-10T09:00:00.000Z';

const pack = (p: Partial<ProductPack>): ProductPack => ({
  id: 'p1',
  businessId: 'b',
  productId: 'prod',
  label: 'tenga',
  units: 40,
  sortOrder: 0,
  active: true,
  createdAt: at,
  updatedAt: at,
  ...p,
});

const product = (p: Partial<Product>): Product => ({
  id: 'prod',
  businessId: 'b',
  name: 'Nyanya',
  unit: 'fungu',
  price: 1000,
  cost: 600,
  trackStock: true,
  vatType: 'standard',
  sortOrder: 0,
  active: true,
  createdAt: at,
  updatedAt: at,
  ...p,
});

const saleLine = (p: Partial<SaleLine>): SaleLine => ({
  id: `sl${Math.random()}`,
  businessId: 'b',
  saleId: 's1',
  productId: 'prod',
  qty: 1,
  unitPrice: 1000,
  lineTotal: 1000,
  unitCost: 600,
  vatType: 'standard',
  ...p,
});

describe('buying in bulk, selling in units', () => {
  it('converts packs to selling units', () => {
    // Two crates of 40 heaps.
    expect(packToUnits(2, 40)).toBe(80);
    // Half a 50kg sack.
    expect(packToUnits(0.5, 50)).toBe(25);
  });

  it('refuses nonsense rather than inventing stock', () => {
    expect(packToUnits(0, 40)).toBe(0);
    expect(packToUnits(-2, 40)).toBe(0);
    expect(packToUnits(2, 0)).toBe(0);
  });

  it('works out what one selling unit cost', () => {
    // 60,000 for 2 tenga of 40 fungu = 750 a fungu.
    expect(costPerUnit(60000, packToUnits(2, 40))).toBe(750);
    expect(costPerUnit(60000, 0)).toBe(0);
  });

  it('is an integer number of shillings', () => {
    const perUnit = costPerUnit(10000, 3);
    expect(Number.isInteger(perUnit)).toBe(true);
    expect(perUnit).toBe(3333);
  });

  it('shows the margin on a unit, in money and percent', () => {
    expect(unitMargin(1000, 750)).toEqual({ profit: 250, percent: 25 });
    // Selling below cost is a real case, and must read as negative.
    expect(unitMargin(500, 750)).toEqual({ profit: -250, percent: -50 });
    expect(unitMargin(0, 750).percent).toBe(0);
  });

  it('offers the biggest pack first and always allows buying loose', () => {
    const choices = packChoices(
      [
        pack({ id: 'small', label: 'kilo', units: 1, sortOrder: 1 }),
        pack({ id: 'big', label: 'tenga', units: 40, sortOrder: 0 }),
        pack({ id: 'gone', label: 'old', units: 99, active: false }),
      ],
      'Kimoja kimoja'
    );
    expect(choices.map((c) => c.id)).toEqual(['big', 'small', LOOSE_PACK_ID]);
    expect(choices.at(-1)).toEqual({ id: LOOSE_PACK_ID, label: 'Kimoja kimoja', units: 1 });
  });
});

describe('profit by product', () => {
  const products = [
    product({}),
    product({ id: 'sukuma', name: 'Sukuma', price: 500, cost: 450 }),
    product({ id: 'mystery', name: 'Mchicha', price: 500, cost: null }),
  ];

  const rows = productProfitability({
    saleLines: [
      saleLine({ qty: 10, lineTotal: 10000, unitCost: 600 }),
      saleLine({ productId: 'sukuma', qty: 4, unitPrice: 500, lineTotal: 2000, unitCost: 450 }),
      saleLine({ productId: 'mystery', qty: 3, unitPrice: 500, lineTotal: 1500, unitCost: null }),
      // A voided sale contributes nothing.
      saleLine({ saleId: 'void', qty: 100, lineTotal: 100000, unitCost: 600 }),
    ],
    purchaseLines: [
      { id: 'pl1', businessId: 'b', purchaseId: 'pu1', productId: 'prod', qty: 40, totalCost: 24000 },
    ] as PurchaseLine[],
    products,
    liveSaleIds: new Set(['s1']),
  });

  it('ranks products by what they actually earned', () => {
    expect(rows.map((r) => r.productId)).toEqual(['prod', 'mystery', 'sukuma']);
  });

  it('is revenue minus the cost of what was sold', () => {
    const tomatoes = rows.find((r) => r.productId === 'prod')!;
    expect(tomatoes).toMatchObject({ qtySold: 10, revenue: 10000, cost: 6000, profit: 4000, margin: 40 });
  });

  it('keeps bulk spending alongside, for context', () => {
    expect(rows.find((r) => r.productId === 'prod')!.purchased).toBe(24000);
  });

  it('flags a product whose cost is unknown instead of calling it pure profit', () => {
    const mystery = rows.find((r) => r.productId === 'mystery')!;
    expect(mystery.partial).toBe(true);
    expect(mystery.cost).toBe(0);
    expect(mystery.unitCost).toBeNull();
  });

  it('shows a thin margin honestly', () => {
    const sukuma = rows.find((r) => r.productId === 'sukuma')!;
    expect(sukuma.profit).toBe(200);
    expect(sukuma.margin).toBe(10);
    expect(sukuma.unitProfit).toBe(50);
  });

  it('excludes voided sales from every total', () => {
    expect(totalsOf(rows)).toEqual({ revenue: 13500, cost: 7800, profit: 5700, purchased: 24000 });
  });
});
