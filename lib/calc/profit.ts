import type { Product, PurchaseLine, SaleLine } from '../types';
import { unitMargin } from './packs';

/**
 * Profit per product line: what a product was bought for in bulk against what
 * it actually sold for. This is the question a trader asks that a daily total
 * cannot answer -- "the day was fine, but is sukuma worth carrying?"
 */

export interface ProductProfit {
  productId: string;
  name: string;
  icon: string | null;
  /** Selling units sold in the period. */
  qtySold: number;
  revenue: number;
  /** Cost of what was sold, from the cost snapshot on each sale line. */
  cost: number;
  profit: number;
  /** Profit as a percentage of revenue. */
  margin: number;
  /** True when some sale had no known cost, so profit is overstated. */
  partial: boolean;
  /** What was spent restocking it in the same period, for context. */
  purchased: number;
  /** Current per-unit buying cost and what it earns at today's price. */
  unitCost: number | null;
  price: number;
  unitProfit: number | null;
}

export function productProfitability(input: {
  saleLines: readonly SaleLine[];
  purchaseLines: readonly PurchaseLine[];
  products: readonly Product[];
  /** Sales that count: void sales are excluded by the caller. */
  liveSaleIds: ReadonlySet<string>;
}): ProductProfit[] {
  const { saleLines, purchaseLines, products, liveSaleIds } = input;
  const byId = new Map(products.map((product) => [product.id, product]));
  const rows = new Map<string, ProductProfit>();

  const rowFor = (productId: string): ProductProfit => {
    const existing = rows.get(productId);
    if (existing) return existing;
    const product = byId.get(productId);
    const price = product?.price ?? 0;
    const unitCost = product?.cost ?? null;
    const row: ProductProfit = {
      productId,
      name: product?.name ?? '—',
      icon: product?.icon ?? null,
      qtySold: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      margin: 0,
      partial: false,
      purchased: 0,
      unitCost,
      price,
      unitProfit: unitCost != null ? unitMargin(price, unitCost).profit : null,
    };
    rows.set(productId, row);
    return row;
  };

  for (const line of saleLines) {
    if (!line.productId || !liveSaleIds.has(line.saleId)) continue;
    const row = rowFor(line.productId);
    row.qtySold += line.qty;
    row.revenue += line.lineTotal;
    if (line.unitCost == null || line.unitCost === 0) row.partial = true;
    else row.cost += Math.round(line.qty * line.unitCost);
  }

  for (const line of purchaseLines) {
    rowFor(line.productId).purchased += line.totalCost;
  }

  for (const row of rows.values()) {
    row.qtySold = Math.round(row.qtySold * 1000) / 1000;
    row.profit = row.revenue - row.cost;
    row.margin = row.revenue > 0 ? Math.round((row.profit / row.revenue) * 1000) / 10 : 0;
  }

  return [...rows.values()].sort((a, b) => b.profit - a.profit || b.revenue - a.revenue);
}

export function totalsOf(rows: readonly ProductProfit[]) {
  return rows.reduce(
    (totals, row) => ({
      revenue: totals.revenue + row.revenue,
      cost: totals.cost + row.cost,
      profit: totals.profit + row.profit,
      purchased: totals.purchased + row.purchased,
    }),
    { revenue: 0, cost: 0, profit: 0, purchased: 0 }
  );
}
