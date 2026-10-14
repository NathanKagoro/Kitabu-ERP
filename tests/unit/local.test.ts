import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The real write path, end to end: domain action -> Dexie -> outbox -> sync
 * engine -> a fake Supabase that behaves like PostgREST's upsert. This is the
 * "never lose a sale, never record one twice" guarantee, tested directly.
 */

interface Call {
  table: string;
  rows: Record<string, unknown>[];
  ignoreDuplicates: boolean;
}

const server = {
  calls: [] as Call[],
  tables: new Map<string, Map<string, Record<string, unknown>>>(),
  failNext: 0,
  /** Commit the write but report a network error -- the nastiest retry case. */
  dropResponseNext: 0,
};

function fakeClient() {
  return {
    from(table: string) {
      return {
        async upsert(rows: Record<string, unknown>[], opts: { ignoreDuplicates?: boolean }) {
          server.calls.push({ table, rows, ignoreDuplicates: !!opts.ignoreDuplicates });
          if (server.failNext > 0) {
            server.failNext--;
            return { error: { message: 'network' } };
          }
          const store = server.tables.get(table) ?? new Map();
          for (const row of rows) {
            const id = row.id as string;
            if (store.has(id) && opts.ignoreDuplicates) continue;
            store.set(id, row);
          }
          server.tables.set(table, store);
          if (server.dropResponseNext > 0) {
            server.dropResponseNext--;
            return { error: { message: 'timeout after commit' } };
          }
          return { error: null };
        },
        select() {
          const query = {
            eq: () => query,
            order: () => query,
            limit: () => query,
            gt: () => query,
            then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }),
          };
          return query;
        },
      };
    },
    rpc: async () => ({ data: null, error: null }),
  };
}

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  supabase: async () => fakeClient(),
}));

const { HesabuDB, setDb, db, setMeta, META_KEYS } = await import('@/lib/local/db');
const actions = await import('@/lib/local/actions');
const { sync } = await import('@/lib/sync/engine');
const { createBusiness } = await import('@/lib/onboarding/create-business');
const { summariseDay } = await import('@/lib/calc/summary');
const { stockOnHand } = await import('@/lib/calc/stock');
const { customerBalance } = await import('@/lib/calc/credit');
const { loadRange } = await import('@/lib/local/queries');
const { businessDay } = await import('@/lib/date');

let businessId = '';

beforeEach(async () => {
  setDb(new HesabuDB(`test-${Math.random()}`));
  server.calls = [];
  server.tables = new Map();
  server.failNext = 0;
  server.dropResponseNext = 0;
  const business = await createBusiness({ name: 'Genge', type: 'duka', locale: 'sw', userId: 'u1' });
  businessId = business.id;
  await setMeta(META_KEYS.activeBusinessId, businessId);
});

afterEach(async () => {
  await db().delete();
});

async function firstProduct() {
  const product = (await db().products.where('businessId').equals(businessId).first())!;
  const priced = { ...product, price: 1000, trackStock: true };
  await actions.saveProduct(priced);
  return priced;
}

const cartLine = (productId: string | null, qty: number, unitPrice: number, unitCost: number | null = null) => ({
  id: crypto.randomUUID(),
  productId,
  description: 'x',
  qty,
  unitPrice,
  unitCost,
  vatType: 'standard' as const,
});

describe('recordSale', () => {
  it('writes the sale, its lines, payments and stock movement in one go', async () => {
    const product = await firstProduct();
    const { sale } = await actions.recordSale({
      businessId,
      lines: [cartLine(product.id, 3, 1000, 600)],
      tenders: [{ method: 'cash', amount: 3000 }],
    });

    expect(sale.total).toBe(3000);
    expect(await db().saleLines.where('saleId').equals(sale.id).count()).toBe(1);
    const payments = await db().payments.where('saleId').equals(sale.id).toArray();
    expect(payments.map((p) => [p.method, p.amount])).toEqual([['cash', 3000]]);
    const movements = await db().stockMovements.where('productId').equals(product.id).toArray();
    expect(stockOnHand(movements)).toBe(-3);
  });

  it('refuses a credit sale with no customer', async () => {
    await expect(
      actions.recordSale({ businessId, lines: [cartLine(null, 1, 500)], tenders: [] })
    ).rejects.toThrow(/customer/);
  });

  it('a split credit sale lands in the daftari, and a repayment reduces it', async () => {
    const customer = await actions.createCustomer({ businessId, name: 'Mama Asha' });
    await actions.recordSale({
      businessId,
      customerId: customer.id,
      lines: [cartLine(null, 1, 10000)],
      tenders: [{ method: 'cash', amount: 4000 }],
    });
    await actions.recordDebtPayment({ businessId, customerId: customer.id, amount: 2500, method: 'mpesa' });
    const payments = await db().payments.where('customerId').equals(customer.id).toArray();
    expect(customerBalance(payments)).toBe(3500);
  });
});

describe('voidSale', () => {
  it('marks it void, hides its money, and puts the stock back -- deleting nothing', async () => {
    const product = await firstProduct();
    const { sale } = await actions.recordSale({
      businessId,
      lines: [cartLine(product.id, 2, 1000)],
      tenders: [{ method: 'cash', amount: 2000 }],
    });
    await actions.voidSale(sale.id, 'nimekosea', { businessId });

    expect((await db().sales.get(sale.id))?.status).toBe('void');
    const payments = await db().payments.where('saleId').equals(sale.id).toArray();
    expect(payments).toHaveLength(1);
    expect(payments[0]?.deletedAt).toBeTruthy();
    const movements = await db().stockMovements.where('productId').equals(product.id).toArray();
    expect(movements.map((m) => m.type).sort()).toEqual(['sale', 'void']);
    expect(stockOnHand(movements)).toBe(0);

    const today = businessDay();
    const summary = summariseDay({ ...(await loadRange(businessId, today, today)), openingCash: 0 });
    expect(summary.salesTotal).toBe(0);
    expect(summary.expectedCash).toBe(0);
  });
});

describe('recordPurchase', () => {
  it('adds stock and re-bases cost by weighted average', async () => {
    const product = await firstProduct();
    await actions.recordPurchase({ businessId, lines: [{ productId: product.id, qty: 10, totalCost: 6000 }] });
    expect((await db().products.get(product.id))?.cost).toBe(600);

    await actions.recordPurchase({ businessId, lines: [{ productId: product.id, qty: 30, totalCost: 24000 }] });
    expect((await db().products.get(product.id))?.cost).toBe(750);

    const movements = await db().stockMovements.where('productId').equals(product.id).toArray();
    expect(stockOnHand(movements)).toBe(40);
  });
});

describe('waste and day closing', () => {
  it('values waste at cost and carries counted cash into tomorrow', async () => {
    const product = await firstProduct();
    await actions.recordPurchase({ businessId, lines: [{ productId: product.id, qty: 10, totalCost: 5000 }] });
    const waste = await actions.recordWaste({ businessId, productId: product.id, qty: 2, reason: 'imeoza' });
    expect(waste.costValue).toBe(1000);

    const closing = await actions.closeDay({
      businessId,
      day: '2026-03-10',
      openingCash: 0,
      expectedCash: 12000,
      countedCash: 11500,
    });
    expect(closing.difference).toBe(-500);
    expect(await actions.openingCashFor(businessId, '2026-03-11')).toBe(11500);
    expect(await actions.openingCashFor(businessId, '2026-03-10')).toBe(0);

    // Closing again replaces the row rather than adding a second one.
    await actions.closeDay({ businessId, day: '2026-03-10', openingCash: 0, expectedCash: 12000, countedCash: 12000 });
    expect(await db().dayClosings.count()).toBe(1);
  });
});

describe('offline outbox and sync', () => {
  it('queues every write while offline, then delivers each row exactly once', async () => {
    const product = await firstProduct();
    for (let i = 0; i < 3; i++) {
      await actions.recordSale({
        businessId,
        lines: [cartLine(product.id, 1, 1000)],
        tenders: [{ method: 'cash', amount: 1000 }],
      });
    }
    expect(await db().outbox.count()).toBeGreaterThan(0);

    // First attempt fails outright; second commits but the response is lost.
    server.failNext = 1;
    await sync();
    expect(await db().outbox.count()).toBeGreaterThan(0);

    server.dropResponseNext = 1;
    await sync();
    await sync();
    await sync();

    expect(await db().outbox.count()).toBe(0);
    expect(server.tables.get('sales')?.size).toBe(3);
    expect(server.tables.get('payments')?.size).toBe(3);
    expect(server.tables.get('sale_lines')?.size).toBe(3);
  });

  it('pushes first writes as insert-or-ignore, so retries need no UPDATE permission', async () => {
    await actions.recordSale({ businessId, lines: [cartLine(null, 1, 500)], tenders: [{ method: 'cash', amount: 500 }] });
    await sync();
    const saleCalls = server.calls.filter((c) => c.table === 'sales');
    expect(saleCalls.length).toBeGreaterThan(0);
    expect(saleCalls.every((c) => c.ignoreDuplicates)).toBe(true);
  });

  it('pushes an edit of an existing row as a real upsert', async () => {
    const product = await firstProduct();
    await sync();
    server.calls = [];
    await actions.saveProduct({ ...product, price: 1200 });
    await sync();
    const productCalls = server.calls.filter((c) => c.table === 'products');
    expect(productCalls.some((c) => !c.ignoreDuplicates)).toBe(true);
    expect(server.tables.get('products')?.get(product.id)?.price).toBe(1200);
  });

  it('never sends the server-owned synced_at column', async () => {
    await actions.createCustomer({ businessId, name: 'X' });
    await sync();
    for (const call of server.calls) for (const row of call.rows) expect(row).not.toHaveProperty('synced_at');
  });
});

describe('buying in bulk', () => {
  it('records a pack purchase in selling units and prices each unit', async () => {
    const product = await firstProduct();
    await actions.saveProductPacks({
      businessId,
      productId: product.id,
      packs: [{ label: 'tenga', units: 40 }],
    });
    const [pack] = await db().productPacks.where('productId').equals(product.id).toArray();
    expect(pack).toMatchObject({ label: 'tenga', units: 40, active: true });

    // "Two tenga for 60,000" -> 80 fungu at 750 each.
    await actions.recordPurchase({
      businessId,
      lines: [
        { productId: product.id, qty: 80, totalCost: 60000, packId: pack!.id, packLabel: 'tenga', packQty: 2 },
      ],
    });

    const movements = await db().stockMovements.where('productId').equals(product.id).toArray();
    expect(stockOnHand(movements)).toBe(80);
    expect((await db().products.get(product.id))?.cost).toBe(750);

    const [line] = await db().purchaseLines.toArray();
    expect(line).toMatchObject({ packLabel: 'tenga', packQty: 2, qty: 80 });
  });

  it('keeps a pack that has been used, deactivating it instead of dropping it', async () => {
    const product = await firstProduct();
    await actions.saveProductPacks({ businessId, productId: product.id, packs: [{ label: 'tenga', units: 40 }] });
    const [pack] = await db().productPacks.where('productId').equals(product.id).toArray();

    await actions.saveProductPacks({ businessId, productId: product.id, packs: [{ label: 'gunia', units: 50 }] });
    const rows = await db().productPacks.where('productId').equals(product.id).toArray();
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === pack!.id)?.active).toBe(false);
    expect(rows.find((row) => row.label === 'gunia')?.active).toBe(true);
  });

  it('an edited pack keeps its id, so past purchases still name it', async () => {
    const product = await firstProduct();
    await actions.saveProductPacks({ businessId, productId: product.id, packs: [{ label: 'tenga', units: 40 }] });
    const [first] = await db().productPacks.where('productId').equals(product.id).toArray();

    await actions.saveProductPacks({
      businessId,
      productId: product.id,
      packs: [{ id: first!.id, label: 'tenga kubwa', units: 45 }],
    });
    const rows = await db().productPacks.where('productId').equals(product.id).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first!.id, label: 'tenga kubwa', units: 45 });
  });
});

describe('addProductsInBulk (setup day)', () => {
  it('adds every shade with its opening stock, in one go', async () => {
    const before = await db().products.where('businessId').equals(businessId).count();
    const added = await actions.addProductsInBulk({
      businessId,
      unit: 'kipande',
      trackStock: true,
      rows: [
        { name: 'Lipstick', variant: 'Red 01', category: 'Make-up', price: 8000, cost: 5500, qty: 12 },
        { name: 'Lipstick', variant: 'Nude 03', category: 'Make-up', price: 8000, cost: 5500, qty: 0 },
        { name: '   ', price: 100 },
      ],
    });
    expect(added).toBe(2);

    const all = await db().products.where('businessId').equals(businessId).toArray();
    expect(all).toHaveLength(before + 2);
    const red = all.find((p) => p.variant === 'Red 01')!;
    expect(red).toMatchObject({ name: 'Lipstick', category: 'Make-up', price: 8000, cost: 5500, trackStock: true });

    const movements = await db().stockMovements.where('productId').equals(red.id).toArray();
    expect(stockOnHand(movements)).toBe(12);
    expect(movements[0]).toMatchObject({ type: 'adjust', unitCost: 5500 });
    // A shade counted at zero gets no movement at all.
    const nude = all.find((p) => p.variant === 'Nude 03')!;
    expect(await db().stockMovements.where('productId').equals(nude.id).count()).toBe(0);
  });

  it('reaches the server like any other write', async () => {
    await actions.addProductsInBulk({ businessId, unit: 'kipande', trackStock: true, rows: [{ name: 'Viatu', variant: '40', price: 25000, qty: 2 }] });
    await sync();
    const pushed = [...(server.tables.get('products')?.values() ?? [])];
    expect(pushed.some((row) => row.name === 'Viatu' && row.variant === '40')).toBe(true);
    expect(server.tables.get('stock_movements')?.size).toBe(1);
  });
});
