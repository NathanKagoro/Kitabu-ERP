import { businessDay, nowIso } from '../date';
import { uuidv7 } from '../uuid';
import { stockOnHand, wasteCost, weightedAverageCost } from '../calc/stock';
import type {
  Customer,
  DayClosing,
  Expense,
  ExpenseCategory,
  Payment,
  PaymentMethod,
  PriceHistoryEntry,
  Product,
  ProductPack,
  Purchase,
  PurchaseLine,
  Sale,
  StockMovement,
  Supplier,
  WasteEvent,
  WasteReason,
} from '../types';
import { db } from './db';
import { persist, persistAll } from './write';

/*
 * Domain operations. Everything the user can do to their data happens here, so
 * there is exactly one place where a sale becomes rows -- the POS, the demo
 * seeder and any future import all go through the same door.
 */

// --- Sales -----------------------------------------------------------------
// recordSale and the Actor type live in ./sale, so the sales screen loads only
// what it needs to take a sale.
export { recordSale, type Actor, type RecordSaleInput, type RecordSaleResult } from './sale';
import type { Actor } from './sale';

/**
 * Voiding never deletes. The sale is marked void, its payments are hidden from
 * reports, and a compensating movement puts the stock back -- so the ledger
 * still shows that something happened and was undone.
 */
export async function voidSale(
  saleId: string,
  reason: string,
  actor: Actor & { at?: string }
): Promise<void> {
  const database = db();
  const sale = await database.sales.get(saleId);
  if (!sale) throw new Error('Sale not found');
  if (sale.status === 'void') return;

  const at = actor.at ?? nowIso();
  const [payments, movements] = await Promise.all([
    database.payments.where('saleId').equals(saleId).toArray(),
    database.stockMovements.where('refId').equals(saleId).toArray(),
  ]);

  const voided: Sale = { ...sale, status: 'void', voidReason: reason, updatedAt: at };
  const hiddenPayments: Payment[] = payments.map((p) => ({ ...p, deletedAt: at }));
  const reversals: StockMovement[] = movements
    .filter((m) => m.type === 'sale')
    .map((m) => ({
      id: uuidv7(),
      businessId: m.businessId,
      productId: m.productId,
      qty: -m.qty,
      type: 'void',
      reason: null,
      refId: saleId,
      unitCost: m.unitCost ?? null,
      note: reason,
      createdAt: at,
      createdBy: actor.userId ?? null,
    }));

  await persistAll([
    { table: 'sales', rows: [voided] },
    { table: 'payments', rows: hiddenPayments },
    { table: 'stockMovements', rows: reversals },
  ]);
}

// --- Customers & credit ----------------------------------------------------

export async function createCustomer(
  input: Actor & { name: string; phone?: string | null; note?: string | null; offersConsent?: boolean }
): Promise<Customer> {
  const at = nowIso();
  const customer: Customer = {
    id: uuidv7(),
    businessId: input.businessId,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    note: input.note?.trim() || null,
    // Opt-in: only when the person at the till ticked that they agreed.
    offersConsentAt: input.offersConsent && input.phone?.trim() ? at : null,
    noOffers: false,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };
  await persist('customers', customer);
  return customer;
}

export async function updateCustomer(customer: Customer): Promise<void> {
  await persist('customers', { ...customer, updatedAt: nowIso() });
}

/**
 * Money a customer came back and paid against their daftari. Deliberately not
 * tied to a specific sale: people pay down what they owe, not invoice 14.
 */
export async function recordDebtPayment(
  input: Actor & {
    customerId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string | null;
    note?: string | null;
    at?: string;
  }
): Promise<Payment> {
  if (input.method === 'credit') throw new Error('A repayment cannot itself be credit');
  const at = input.at ?? nowIso();
  const payment: Payment = {
    id: uuidv7(),
    businessId: input.businessId,
    saleId: null,
    customerId: input.customerId,
    supplierId: null,
    purchaseId: null,
    documentId: null,
    direction: 'in',
    method: input.method,
    amount: Math.round(input.amount),
    reference: input.reference ?? null,
    note: input.note ?? null,
    createdBy: input.userId ?? null,
    memberId: input.memberId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    deletedAt: null,
  };
  await persist('payments', payment);
  return payment;
}

// --- Products, prices, stock ----------------------------------------------

export async function saveProduct(product: Product): Promise<void> {
  await persist('products', { ...product, updatedAt: nowIso() });
}

/**
 * Replaces a product's bulk sizes. Packs already used by a past purchase are
 * deactivated rather than dropped, so an old purchase still reads back as
 * "2 tenga" years later.
 */
export async function saveProductPacks(
  input: Actor & { productId: string; packs: readonly { id?: string; label: string; units: number }[] }
): Promise<void> {
  const at = nowIso();
  const existing = await db().productPacks.where('productId').equals(input.productId).toArray();
  const kept = new Set(input.packs.map((pack) => pack.id).filter(Boolean) as string[]);

  const rows: ProductPack[] = input.packs.map((pack, index) => {
    const previous = pack.id ? existing.find((row) => row.id === pack.id) : undefined;
    return {
      id: previous?.id ?? uuidv7(),
      businessId: input.businessId,
      productId: input.productId,
      label: pack.label.trim(),
      units: pack.units,
      sortOrder: index,
      active: true,
      createdAt: previous?.createdAt ?? at,
      updatedAt: at,
      deletedAt: null,
    };
  });

  for (const row of existing) {
    if (!kept.has(row.id) && row.active) rows.push({ ...row, active: false, updatedAt: at });
  }

  if (rows.length > 0) await persist('productPacks', rows);
}

/** One product from the setup-day bulk entry. Money in integer TZS. */
export interface NewProductRow {
  name: string;
  variant?: string | null;
  category?: string | null;
  price: number;
  cost?: number | null;
  /** Counted on the shelf today; becomes the opening stock. */
  qty?: number | null;
  /** The owner's estimate or the delivery note, for the first-visit report. */
  expected?: number | null;
  /** A picture for the till tile; defaults to the batch's icon. */
  icon?: string | null;
}

/**
 * Setup day: many products at once, each with the stock counted on the shelf.
 * One transaction, so a half-saved shelf never syncs. Opening stock is an
 * 'adjust' movement carrying the cost, so profit is right from the first sale.
 */
export async function addProductsInBulk(
  input: Actor & {
    rows: readonly NewProductRow[];
    unit: Product['unit'];
    trackStock: boolean;
    icon?: string | null;
  }
): Promise<Product[]> {
  const rows = input.rows.filter((row) => row.name.trim());
  if (rows.length === 0) return [];
  const at = nowIso();
  const start = await db().products.where('businessId').equals(input.businessId).count();

  const products: Product[] = [];
  const movements: StockMovement[] = [];
  rows.forEach((row, index) => {
    const id = uuidv7();
    const cost = row.cost != null && row.cost > 0 ? Math.round(row.cost) : null;
    products.push({
      id,
      businessId: input.businessId,
      name: row.name.trim(),
      variant: row.variant?.trim() || null,
      category: row.category?.trim() || null,
      unit: input.unit,
      unitLabel: null,
      price: Math.max(0, Math.round(row.price)),
      cost,
      trackStock: input.trackStock,
      lowStockLevel: null,
      icon: row.icon ?? input.icon ?? '📦',
      photoUrl: null,
      sku: null,
      barcode: null,
      vatType: 'standard',
      sortOrder: start + index,
      active: true,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    });
    if (input.trackStock && row.qty != null && row.qty > 0) {
      movements.push({
        id: uuidv7(),
        businessId: input.businessId,
        productId: id,
        qty: Math.round(row.qty * 1000) / 1000,
        type: 'adjust',
        reason: null,
        refId: null,
        unitCost: cost,
        note: 'opening',
        createdAt: at,
        createdBy: input.userId ?? null,
      });
    }
  });

  await persistAll([
    { table: 'products', rows: products },
    { table: 'stockMovements', rows: movements },
  ]);
  return products;
}

export async function archiveProduct(product: Product): Promise<void> {
  await persist('products', { ...product, active: false, updatedAt: nowIso() });
}

/**
 * The daily price update. Only products whose price actually moved are written,
 * so tapping save without changing anything costs nothing and does not fill the
 * history with noise.
 */
export async function updatePrices(
  input: Actor & { prices: ReadonlyMap<string, number>; day?: string }
): Promise<number> {
  const database = db();
  const day = input.day ?? businessDay();
  const at = nowIso();
  const products = await database.products.where('businessId').equals(input.businessId).toArray();

  const changed: Product[] = [];
  const history: PriceHistoryEntry[] = [];

  for (const product of products) {
    const next = input.prices.get(product.id);
    if (next == null || next === product.price) continue;
    changed.push({ ...product, price: next, updatedAt: at });
    history.push({
      id: uuidv7(),
      businessId: input.businessId,
      productId: product.id,
      price: next,
      effectiveDate: day,
      createdAt: at,
    });
  }

  if (changed.length === 0) return 0;
  await persistAll([
    { table: 'products', rows: changed },
    { table: 'priceHistory', rows: history },
  ]);
  return changed.length;
}

export async function recordWaste(
  input: Actor & {
    productId: string;
    qty: number;
    reason: WasteReason;
    note?: string | null;
    at?: string;
  }
): Promise<WasteEvent> {
  const database = db();
  const product = await database.products.get(input.productId);
  const at = input.at ?? nowIso();
  const id = uuidv7();

  const waste: WasteEvent = {
    id,
    businessId: input.businessId,
    productId: input.productId,
    qty: input.qty,
    reason: input.reason,
    costValue: wasteCost(input.qty, product?.cost),
    note: input.note ?? null,
    createdBy: input.userId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    deletedAt: null,
  };

  const movements: StockMovement[] = product?.trackStock
    ? [
        {
          id: uuidv7(),
          businessId: input.businessId,
          productId: input.productId,
          qty: -input.qty,
          type: 'waste',
          reason: input.reason,
          refId: id,
          unitCost: product.cost ?? null,
          note: input.note ?? null,
          createdAt: at,
          createdBy: input.userId ?? null,
        },
      ]
    : [];

  await persistAll([
    { table: 'wasteEvents', rows: [waste] },
    { table: 'stockMovements', rows: movements },
  ]);
  return waste;
}

/**
 * A manual stock correction ("I counted, there are actually 12"). A reset to
 * that number as of now, like a stock count (see lib/calc/stock.ts).
 */
export async function adjustStock(
  input: Actor & { productId: string; countedQty: number; note?: string | null }
): Promise<void> {
  const database = db();
  const movements = await database.stockMovements
    .where('[businessId+productId]')
    .equals([input.businessId, input.productId])
    .toArray();
  const current = stockOnHand(movements);
  const counted = Math.round(input.countedQty * 1000) / 1000;
  const delta = Math.round((counted - current) * 1000) / 1000;
  if (delta === 0) return;

  const at = nowIso();
  await persist('stockMovements', {
    id: uuidv7(),
    businessId: input.businessId,
    productId: input.productId,
    qty: delta,
    type: 'adjust',
    reason: null,
    refId: null,
    unitCost: null,
    note: input.note ?? null,
    setsQty: counted,
    createdAt: at,
    createdBy: input.userId ?? null,
  } satisfies StockMovement);
}

// --- Expenses & purchases --------------------------------------------------

export async function recordExpense(
  input: Actor & {
    category: ExpenseCategory;
    amount: number;
    method?: PaymentMethod;
    note?: string | null;
    at?: string;
  }
): Promise<Expense> {
  const at = input.at ?? nowIso();
  const expense: Expense = {
    id: uuidv7(),
    businessId: input.businessId,
    category: input.category,
    amount: Math.round(input.amount),
    method: input.method ?? 'cash',
    note: input.note ?? null,
    createdBy: input.userId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    deletedAt: null,
  };
  await persist('expenses', expense);
  return expense;
}

export interface PurchaseLineInput {
  productId: string;
  /** In selling units. Use packToUnits() when the trader bought a bulk pack. */
  qty: number;
  totalCost: number;
  /** What was bought, when it was a pack: "2 tenga" rather than "80 fungu". */
  packId?: string | null;
  packLabel?: string | null;
  packQty?: number | null;
}

/**
 * Buying stock. Beyond adding to the ledger this re-bases each product's cost
 * using a weighted average, which is what later makes the profit estimate mean
 * anything.
 */
export async function recordPurchase(
  input: Actor & {
    lines: readonly PurchaseLineInput[];
    supplierId?: string | null;
    paidAmount?: number;
    method?: PaymentMethod;
    note?: string | null;
    at?: string;
  }
): Promise<Purchase> {
  if (input.lines.length === 0) throw new Error('A purchase needs at least one line');

  const database = db();
  const at = input.at ?? nowIso();
  const purchaseId = uuidv7();
  const total = input.lines.reduce((sum, line) => sum + Math.round(line.totalCost), 0);

  const purchase: Purchase = {
    id: purchaseId,
    businessId: input.businessId,
    supplierId: input.supplierId ?? null,
    total,
    paidAmount: Math.round(input.paidAmount ?? total),
    method: input.method ?? 'cash',
    note: input.note ?? null,
    createdBy: input.userId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    deletedAt: null,
  };

  const lines: PurchaseLine[] = input.lines.map((line) => ({
    id: uuidv7(),
    businessId: input.businessId,
    purchaseId,
    productId: line.productId,
    qty: line.qty,
    totalCost: Math.round(line.totalCost),
    packId: line.packId ?? null,
    packLabel: line.packLabel ?? null,
    packQty: line.packQty ?? null,
  }));

  const movements: StockMovement[] = [];
  const updatedProducts: Product[] = [];

  for (const line of input.lines) {
    const product = await database.products.get(line.productId);
    if (!product) continue;

    const existing = await database.stockMovements
      .where('[businessId+productId]')
      .equals([input.businessId, line.productId])
      .toArray();

    const newCost = weightedAverageCost({
      currentQty: stockOnHand(existing),
      currentCost: product.cost,
      incomingQty: line.qty,
      incomingTotalCost: Math.round(line.totalCost),
    });

    updatedProducts.push({ ...product, cost: newCost, updatedAt: at });
    movements.push({
      id: uuidv7(),
      businessId: input.businessId,
      productId: line.productId,
      qty: line.qty,
      type: 'purchase',
      reason: null,
      refId: purchaseId,
      unitCost: line.qty > 0 ? Math.round(line.totalCost / line.qty) : null,
      note: null,
      createdAt: at,
      createdBy: input.userId ?? null,
    });
  }

  await persistAll([
    { table: 'purchases', rows: [purchase] },
    { table: 'purchaseLines', rows: lines },
    { table: 'stockMovements', rows: movements },
    { table: 'products', rows: updatedProducts },
  ]);

  return purchase;
}

export async function createSupplier(
  input: Actor & { name: string; phone?: string | null; note?: string | null }
): Promise<Supplier> {
  const at = nowIso();
  const supplier: Supplier = {
    id: uuidv7(),
    businessId: input.businessId,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    note: input.note?.trim() || null,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };
  await persist('suppliers', supplier);
  return supplier;
}

// --- Closing the day -------------------------------------------------------

/**
 * *Funga siku*. Stores what was counted against what was expected. Tomorrow's
 * opening cash is read back from this row -- the counted amount, not the
 * expected one, because the money in the tin is the fact and the expectation
 * is the estimate. Closing the same day again replaces the earlier count.
 */
export async function closeDay(
  input: Actor & {
    day: string;
    openingCash: number;
    expectedCash: number;
    countedCash: number;
    note?: string | null;
  }
): Promise<DayClosing> {
  const existing = await db()
    .dayClosings.where('[businessId+date]')
    .equals([input.businessId, input.day])
    .first();

  const closing: DayClosing = {
    id: existing?.id ?? uuidv7(),
    businessId: input.businessId,
    date: input.day,
    openingCash: Math.round(input.openingCash),
    expectedCash: Math.round(input.expectedCash),
    countedCash: Math.round(input.countedCash),
    difference: Math.round(input.countedCash) - Math.round(input.expectedCash),
    note: input.note ?? null,
    createdBy: input.userId ?? null,
    createdAt: existing?.createdAt ?? nowIso(),
  };

  await persist('dayClosings', closing);
  return closing;
}

/** Opening cash for a day: what was counted at the most recent earlier close. */
export async function openingCashFor(businessId: string, day: string): Promise<number> {
  const closes = await db()
    .dayClosings.where('businessId')
    .equals(businessId)
    .filter((c) => c.date < day)
    .toArray();
  closes.sort((x, y) => y.date.localeCompare(x.date));
  return closes[0]?.countedCash ?? 0;
}

/** Money we paid a supplier against what we owe them, not against one purchase. */
export async function recordSupplierPayment(
  input: Actor & { supplierId: string; amount: number; method: PaymentMethod; reference?: string | null }
): Promise<Payment> {
  const at = nowIso();
  const payment: Payment = {
    id: uuidv7(),
    businessId: input.businessId,
    saleId: null,
    customerId: null,
    supplierId: input.supplierId,
    purchaseId: null,
    documentId: null,
    direction: 'out',
    method: input.method,
    amount: Math.round(input.amount),
    reference: input.reference ?? null,
    note: null,
    createdBy: input.userId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    deletedAt: null,
  };
  await persist('payments', payment);
  return payment;
}
