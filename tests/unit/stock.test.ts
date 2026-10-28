import { describe, expect, it } from 'vitest';

import { averageUnitCost, isLowStock, stockAsOf, stockByProduct, stockOnHand, wasteCost, weightedAverageCost } from '@/lib/calc/stock';
import type { StockMovement } from '@/lib/types';

const move = (productId: string, qty: number, type: StockMovement['type'] = 'adjust'): StockMovement => ({
  id: `${productId}-${qty}-${Math.random()}`,
  businessId: 'b',
  productId,
  qty,
  type,
  createdAt: '2026-01-01T00:00:00Z',
});

describe('stockOnHand', () => {
  it('is the sum of the ledger', () => {
    expect(stockOnHand([move('p', 20, 'purchase'), move('p', -3, 'sale'), move('p', -2, 'waste')])).toBe(15);
  });

  it('does not accumulate float dust on kg quantities', () => {
    const movements = [move('p', 10, 'purchase'), ...Array.from({ length: 10 }, () => move('p', -0.1, 'sale'))];
    expect(stockOnHand(movements)).toBe(9);
  });

  it('a void puts sold stock back', () => {
    expect(stockOnHand([move('p', 5, 'purchase'), move('p', -2, 'sale'), move('p', 2, 'void')])).toBe(5);
  });

  it('groups by product', () => {
    const totals = stockByProduct([move('a', 3), move('b', 4), move('a', -1)]);
    expect(totals.get('a')).toBe(2);
    expect(totals.get('b')).toBe(4);
  });
});

describe('weightedAverageCost', () => {
  it('averages old and new stock by quantity', () => {
    // 10 on hand at 600, buy 30 more for 24,000 (800 each) -> (6000+24000)/40 = 750
    expect(weightedAverageCost({ currentQty: 10, currentCost: 600, incomingQty: 30, incomingTotalCost: 24000 })).toBe(750);
  });

  it('uses the purchase cost when nothing is on hand', () => {
    expect(weightedAverageCost({ currentQty: 0, currentCost: 600, incomingQty: 10, incomingTotalCost: 9000 })).toBe(900);
  });

  it('ignores existing stock of unknown cost instead of treating it as free', () => {
    expect(weightedAverageCost({ currentQty: 50, currentCost: null, incomingQty: 10, incomingTotalCost: 9000 })).toBe(900);
  });

  it('ignores negative on-hand (oversold) stock', () => {
    expect(weightedAverageCost({ currentQty: -4, currentCost: 500, incomingQty: 10, incomingTotalCost: 7000 })).toBe(700);
  });

  it('keeps the old cost when nothing arrives', () => {
    expect(weightedAverageCost({ currentQty: 5, currentCost: 500, incomingQty: 0, incomingTotalCost: 0 })).toBe(500);
  });

  it('returns integer shillings', () => {
    const cost = weightedAverageCost({ currentQty: 3, currentCost: 333, incomingQty: 7, incomingTotalCost: 2500 });
    expect(Number.isInteger(cost)).toBe(true);
    expect(cost).toBe(350);
  });
});

describe('waste and low stock', () => {
  it('values waste at cost, zero when cost is unknown', () => {
    expect(wasteCost(2.5, 600)).toBe(1500);
    expect(wasteCost(3, null)).toBe(0);
  });

  it('flags low stock only when a level is set', () => {
    expect(isLowStock(3, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
    expect(isLowStock(0, null)).toBe(false);
  });
});

describe('a count resets stock to what was on the shelf at that moment', () => {
  let n = 0;
  const m = (qty: number, createdAt: string, over: Record<string, unknown> = {}) => ({
    id: `0000${String(++n).padStart(4, '0')}`,
    productId: 'lotion',
    qty,
    type: 'sale' as const,
    createdAt,
    ...over,
  });

  it('later movements still count; earlier ones are already in the count', () => {
    const ledger = [
      m(12, '2026-10-01T08:00:00Z', { type: 'purchase' }),
      m(-1, '2026-10-01T09:00:00Z'),
      m(-2, '2026-10-01T09:30:00Z', { type: 'adjust', setsQty: 9 }), // counted 9 at 09:30
      m(-1, '2026-10-01T10:00:00Z'),
    ];
    expect(stockOnHand(ledger)).toBe(8);
  });

  it('a sale from before the count that syncs late changes nothing', () => {
    const counted = [m(12, '2026-10-01T08:00:00Z', { type: 'purchase' }), m(0, '2026-10-01T14:05:00Z', { type: 'adjust', setsQty: 10 })];
    // The cashier's phone sold 2 at 13:50, offline; it arrives tonight.
    const late = m(-2, '2026-10-01T13:50:00Z');
    expect(stockOnHand([...counted, late])).toBe(10);
    // Whereas a sale after the count does come off.
    expect(stockOnHand([...counted, late, m(-1, '2026-10-01T14:10:00Z')])).toBe(9);
  });

  it('the newest count wins, wherever it sits in the list', () => {
    const ledger = [m(0, '2026-10-02T10:00:00Z', { type: 'adjust', setsQty: 4 }), m(0, '2026-10-01T10:00:00Z', { type: 'adjust', setsQty: 20 }), m(-1, '2026-10-01T11:00:00Z')];
    expect(stockOnHand(ledger)).toBe(4);
  });

  it('stock as of a moment reads the ledger up to then', () => {
    const ledger = [m(12, '2026-10-01T08:00:00Z', { type: 'purchase' }), m(-2, '2026-10-01T13:50:00Z'), m(-1, '2026-10-01T15:00:00Z')];
    expect(stockAsOf(ledger, '2026-10-01T14:05:00Z')).toBe(10);
  });

  it('per product, with counts', () => {
    const totals = stockByProduct([
      m(5, '2026-10-01T08:00:00Z', { type: 'purchase' }),
      m(0, '2026-10-01T09:00:00Z', { type: 'adjust', setsQty: 3 }),
      { ...m(7, '2026-10-01T08:00:00Z', { type: 'purchase' }), productId: 'lipstick' },
    ]);
    expect(totals.get('lotion')).toBe(3);
    expect(totals.get('lipstick')).toBe(7);
  });
});

describe('average cost', () => {
  it('weights every unit received at a known cost, not the latest price', () => {
    const cost = averageUnitCost([
      { qty: 10, unitCost: 9000, type: 'purchase' },
      { qty: 2, unitCost: 12000, type: 'purchase' }, // one dear delivery
      { qty: -3, unitCost: null, type: 'sale' },
      { qty: 5, unitCost: null, type: 'purchase' },
    ]);
    expect(cost).toBe(9500);
  });

  it('falls back to the product’s cost when nothing was ever received with one', () => {
    expect(averageUnitCost([{ qty: -1, unitCost: null, type: 'sale' }], 4000)).toBe(4000);
    expect(averageUnitCost([], null)).toBeNull();
  });
});
