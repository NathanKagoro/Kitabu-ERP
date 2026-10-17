import { describe, expect, it } from 'vitest';

import { lineDifference, shortLines, summariseCount, type CountLine } from '@/lib/calc/stock-count';

const line = (over: Partial<CountLine>): CountLine => ({
  productId: crypto.randomUUID(),
  name: 'x',
  expected: 10,
  counted: 10,
  unitCost: 1000,
  unitPrice: 1500,
  ...over,
});

describe('the stock check', () => {
  it('a shelf that matches has nothing missing', () => {
    const s = summariseCount([line({}), line({ expected: 3, counted: 3 })]);
    expect(s).toMatchObject({ itemsCounted: 2, linesShort: 0, unitsShort: 0, valueShortCost: 0, valueShortPrice: 0 });
  });

  it('adds up what is missing, at cost and at selling price', () => {
    const s = summariseCount([
      line({ name: 'Lipstick Red', expected: 12, counted: 9, unitCost: 5500, unitPrice: 8000 }), // 3 missing
      line({ name: 'Nivea 400ml', expected: 6, counted: 5, unitCost: 9000, unitPrice: 12500 }), // 1 missing
      line({ name: 'Geisha', expected: 40, counted: 40 }),
    ]);
    expect(s.linesShort).toBe(2);
    expect(s.unitsShort).toBe(4);
    expect(s.valueShortCost).toBe(3 * 5500 + 9000);
    expect(s.valueShortPrice).toBe(3 * 8000 + 12500);
  });

  it('more on the shelf than recorded is reported separately, never netted off', () => {
    const s = summariseCount([line({ expected: 5, counted: 2 }), line({ expected: 5, counted: 8 })]);
    expect(s.unitsShort).toBe(3);
    expect(s.unitsOver).toBe(3);
    expect(s.valueShortCost).toBe(3000);
    expect(s.valueOverCost).toBe(3000);
  });

  it('a missing item with no known cost still counts at selling price and is flagged', () => {
    const s = summariseCount([line({ expected: 4, counted: 1, unitCost: null, unitPrice: 2000 })]);
    expect(s.valueShortCost).toBe(0);
    expect(s.valueShortPrice).toBe(6000);
    expect(s.shortWithoutCost).toBe(1);
  });

  it('works in kilos and metres without float dust', () => {
    expect(lineDifference({ expected: 10.3, counted: 10.1 })).toBe(-0.2);
    const s = summariseCount([line({ expected: 10.3, counted: 10.1, unitCost: 2000 })]);
    expect(s.unitsShort).toBe(0.2);
    expect(s.valueShortCost).toBe(400);
  });

  it('negative records (sold more than was ever entered) count from zero', () => {
    // The ledger can go below zero when sales were entered before stock was.
    const s = summariseCount([line({ expected: -2, counted: 3 })]);
    expect(s.linesShort).toBe(0);
    expect(s.unitsOver).toBe(5);
  });

  it('lists the worst losses first', () => {
    const lines = [
      line({ name: 'cheap', expected: 10, counted: 5, unitCost: 100 }),
      line({ name: 'dear', expected: 2, counted: 1, unitCost: 50000 }),
      line({ name: 'fine', expected: 2, counted: 2 }),
    ];
    expect(shortLines(lines).map((l) => [l.name, l.missing, l.lostCost])).toEqual([
      ['dear', 1, 50000],
      ['cheap', 5, 500],
    ]);
  });
});
