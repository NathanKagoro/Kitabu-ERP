import { summariseCount, type CountLine } from '../calc/stock-count';
import { stockOnHand } from '../calc/stock';
import { nowIso } from '../date';
import { productLabel } from '../products';
import type { Product, StockCount, StockCountKind, StockMovement } from '../types';
import { uuidv7 } from '../uuid';
import { addProductsInBulk } from './actions';
import { db } from './db';
import { persistAll } from './write';

/*
 * Stock checks, kept apart from lib/local/actions.ts so the till's first load
 * never carries them: only the stock-check and bulk-entry screens import this.
 */

interface Actor {
  businessId: string;
  userId?: string | null;
}


export interface CountedItem {
  productId: string;
  counted: number;
  /** Only for kind 'opening': the owner's estimate or the delivery note. */
  expected?: number | null;
}

/**
 * Saves a stock check and, for a normal check, sets the ledger to what was
 * counted: one 'adjust' movement per product that differs, pointing back at
 * the count. One transaction, so the report and the stock never disagree.
 *
 * 'opening' (setup day) only records the report: the counted stock was
 * already written as opening stock by addProductsInBulk.
 */
export async function recordStockCount(
  input: Actor & { kind: StockCountKind; scope?: string | null; note?: string | null; items: readonly CountedItem[]; at?: string }
): Promise<StockCount> {
  const database = db();
  const at = input.at ?? nowIso();
  const countId = uuidv7();
  const items = input.items.filter((item) => Number.isFinite(item.counted) && item.counted >= 0);
  const products = await database.products.bulkGet(items.map((item) => item.productId));

  const lines: CountLine[] = [];
  const movements: StockMovement[] = [];
  for (const [index, item] of items.entries()) {
    const product = products[index];
    if (!product || product.businessId !== input.businessId) continue;
    const onHand = stockOnHand(
      await database.stockMovements.where('[businessId+productId]').equals([input.businessId, product.id]).toArray()
    );
    const counted = Math.round(item.counted * 1000) / 1000;
    // A ledger below zero means sales were recorded before the stock was;
    // nothing can be "missing" from a shelf that was never stocked.
    const expected = input.kind === 'opening' ? Math.max(0, item.expected ?? counted) : Math.max(0, onHand);
    lines.push({
      productId: product.id,
      name: productLabel(product),
      expected,
      counted,
      unitCost: product.cost != null && product.cost > 0 ? product.cost : null,
      unitPrice: product.price,
    });

    const delta = Math.round((counted - onHand) * 1000) / 1000;
    if (input.kind === 'check' && delta !== 0) {
      movements.push({
        id: uuidv7(),
        businessId: input.businessId,
        productId: product.id,
        qty: delta,
        type: 'adjust',
        reason: null,
        refId: countId,
        unitCost: product.cost ?? null,
        note: 'count',
        createdAt: at,
        createdBy: input.userId ?? null,
      });
    }
  }

  const summary = summariseCount(lines);
  const count: StockCount = {
    id: countId,
    businessId: input.businessId,
    kind: input.kind,
    scope: input.scope?.trim() || null,
    itemsCounted: summary.itemsCounted,
    linesShort: summary.linesShort,
    unitsShort: summary.unitsShort,
    valueShortCost: summary.valueShortCost,
    valueShortPrice: summary.valueShortPrice,
    unitsOver: summary.unitsOver,
    valueOverCost: summary.valueOverCost,
    lines,
    note: input.note?.trim() || null,
    createdBy: input.userId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };

  await persistAll([
    { table: 'stockCounts', rows: [count] },
    { table: 'stockMovements', rows: movements },
  ]);
  return count;
}

/**
 * Setup day with the owner's figures: the products and their opening stock,
 * then -- if any row carries an expected figure (an estimate, or what the last
 * delivery note says should be there) -- an 'opening' stock count comparing
 * the two. That is the loss a first visit can honestly show.
 */
export async function addProductsWithOpeningCount(
  input: Parameters<typeof addProductsInBulk>[0]
): Promise<{ products: Product[]; count: StockCount | null }> {
  const products = await addProductsInBulk(input);
  const rows = input.rows.filter((row) => row.name.trim());
  const items = products.flatMap((product, index) => {
    const row = rows[index];
    if (!row || row.expected == null || !input.trackStock) return [];
    return [{ productId: product.id, counted: row.qty ?? 0, expected: row.expected }];
  });
  if (items.length === 0) return { products, count: null };
  const count = await recordStockCount({ businessId: input.businessId, userId: input.userId, kind: 'opening', items });
  return { products, count };
}

