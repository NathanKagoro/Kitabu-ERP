import { nowIso } from '../date';
import { receiptToken, uuidv7 } from '../uuid';
import { buildSaleLines, cartTotal, clampDiscount, settleSale, type CartLine, type Tender } from '../calc/sale';
import type { Payment, Sale, StockMovement } from '../types';
import { db } from './db';
import { persistAll } from './write';

/*
 * Taking a sale: the one thing the till screen writes. Split from actions.ts
 * (which re-exports it) to keep the sales screen's first load small.
 */

export interface Actor {
  businessId: string;
  userId?: string | null;
  /** The person at the till (members.id), when it differs from the login. */
  memberId?: string | null;
}

export interface RecordSaleInput extends Actor {
  lines: readonly CartLine[];
  discount?: number;
  tenders: readonly Tender[];
  customerId?: string | null;
  note?: string | null;
  /** Injected in tests; defaults to now. */
  at?: string;
}

export interface RecordSaleResult {
  sale: Sale;
  total: number;
}

export async function recordSale(input: RecordSaleInput): Promise<RecordSaleResult> {
  const { businessId, userId = null, lines, tenders, customerId = null, note = null } = input;
  if (lines.length === 0) throw new Error('A sale needs at least one line');

  const at = input.at ?? nowIso();
  const saleId = uuidv7();
  const discount = clampDiscount(
    lines.reduce((sum, line) => sum + Math.round(line.qty * line.unitPrice), 0),
    input.discount ?? 0
  );
  const total = cartTotal(lines, discount);

  const sale: Sale = {
    id: saleId,
    businessId,
    customerId,
    total,
    discount,
    status: 'complete',
    voidReason: null,
    receiptToken: receiptToken(),
    note,
    createdBy: userId,
    memberId: input.memberId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    updatedAt: at,
  };

  const saleLines = buildSaleLines(lines, discount, {
    saleId,
    businessId,
    lineId: () => uuidv7(),
  });

  const settled = settleSale(total, tenders);
  const payments: Payment[] = settled.map((tender) => ({
    id: uuidv7(),
    businessId,
    saleId,
    customerId,
    supplierId: null,
    purchaseId: null,
    documentId: null,
    direction: 'in',
    method: tender.method,
    amount: tender.amount,
    reference: tender.reference ?? null,
    note: null,
    createdBy: userId,
    memberId: input.memberId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    deletedAt: null,
  }));

  if (payments.some((p) => p.method === 'credit' && !p.customerId)) {
    throw new Error('A credit sale needs a customer');
  }

  const tracked = await trackedProducts(
    businessId,
    lines.map((line) => line.productId).filter((id): id is string => !!id)
  );

  const movements: StockMovement[] = [];
  for (const line of lines) {
    if (!line.productId || !tracked.has(line.productId)) continue;
    movements.push({
      id: uuidv7(),
      businessId,
      productId: line.productId,
      qty: -line.qty,
      type: 'sale',
      reason: null,
      refId: saleId,
      unitCost: line.unitCost ?? null,
      note: null,
      createdAt: at,
      createdBy: userId,
    });
  }

  await persistAll([
    { table: 'sales', rows: [sale] },
    { table: 'saleLines', rows: saleLines },
    { table: 'payments', rows: payments },
    { table: 'stockMovements', rows: movements },
  ]);

  return { sale, total };
}

export async function trackedProducts(
  businessId: string,
  productIds: readonly string[]
): Promise<Set<string>> {
  if (productIds.length === 0) return new Set();
  const rows = await db().products.bulkGet([...new Set(productIds)]);
  const tracked = new Set<string>();
  for (const row of rows) {
    if (row && row.businessId === businessId && row.trackStock) tracked.add(row.id);
  }
  return tracked;
}
