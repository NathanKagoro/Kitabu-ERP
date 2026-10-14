import Dexie, { type EntityTable } from 'dexie';

import type {
  Business,
  BusinessDocument,
  Customer,
  DayClosing,
  DocumentLine,
  Expense,
  Member,
  OutboxEntry,
  Payment,
  PriceHistoryEntry,
  Product,
  ProductPack,
  Purchase,
  PurchaseLine,
  Sale,
  SaleLine,
  StockMovement,
  Supplier,
  WasteEvent,
} from '../types';

/**
 * The local database is not a cache -- it is where the app actually reads and
 * writes. The server is a replica that catches up later. That inversion is what
 * makes "never lose a sale" true rather than aspirational: selling never waits
 * on a network call, and a phone that spends all day out of coverage behaves
 * exactly like one that never leaves wifi.
 */

/** Small key/value store for device state: active business, PIN hash, sync clock. */
export interface MetaRow {
  key: string;
  value: unknown;
}

export class HesabuDB extends Dexie {
  businesses!: EntityTable<Business, 'id'>;
  members!: EntityTable<Member, 'id'>;
  products!: EntityTable<Product, 'id'>;
  productPacks!: EntityTable<ProductPack, 'id'>;
  priceHistory!: EntityTable<PriceHistoryEntry, 'id'>;
  stockMovements!: EntityTable<StockMovement, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  suppliers!: EntityTable<Supplier, 'id'>;
  sales!: EntityTable<Sale, 'id'>;
  saleLines!: EntityTable<SaleLine, 'id'>;
  payments!: EntityTable<Payment, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  purchases!: EntityTable<Purchase, 'id'>;
  purchaseLines!: EntityTable<PurchaseLine, 'id'>;
  wasteEvents!: EntityTable<WasteEvent, 'id'>;
  dayClosings!: EntityTable<DayClosing, 'id'>;
  documents!: EntityTable<BusinessDocument, 'id'>;
  documentLines!: EntityTable<DocumentLine, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'seq'>;
  meta!: EntityTable<MetaRow, 'key'>;

  // Still 'hesabu': renaming the IndexedDB database would strand every record
  // already on a phone. Nobody sees this name.
  constructor(name = 'hesabu') {
    super(name);
    this.version(1).stores({
      businesses: 'id',
      members: 'id, businessId, userId',
      products: 'id, businessId, [businessId+active], sortOrder',
      priceHistory: 'id, businessId, productId, [productId+effectiveDate]',
      stockMovements: 'id, businessId, productId, refId, [businessId+productId], createdAt',
      customers: 'id, businessId, name',
      suppliers: 'id, businessId, name',
      sales: 'id, businessId, receiptToken, clientCreatedAt, [businessId+clientCreatedAt], status',
      saleLines: 'id, businessId, saleId, productId',
      payments:
        'id, businessId, saleId, customerId, supplierId, clientCreatedAt, [businessId+clientCreatedAt]',
      expenses: 'id, businessId, clientCreatedAt, [businessId+clientCreatedAt]',
      purchases: 'id, businessId, supplierId, clientCreatedAt, [businessId+clientCreatedAt]',
      purchaseLines: 'id, businessId, purchaseId, productId',
      wasteEvents: 'id, businessId, productId, clientCreatedAt, [businessId+clientCreatedAt]',
      dayClosings: 'id, businessId, date, [businessId+date]',
      documents: 'id, businessId, kind, customerId, parentId, [businessId+kind]',
      documentLines: 'id, businessId, documentId',
      // ++seq keeps the queue in the order writes happened, which matters when a
      // payment and the sale it belongs to are both waiting.
      outbox: '++seq, [table+rowId], businessId, createdAt',
      meta: 'key',
    });

    // v2 adds the bulk sizes a product is bought in. A phone that already has
    // data keeps it: Dexie only creates the new store.
    this.version(2).stores({
      productPacks: 'id, businessId, productId',
    });
  }
}

let instance: HesabuDB | null = null;

/**
 * Lazily opened so that importing this module on the server (during SSR or a
 * unit test) does not touch IndexedDB.
 */
export function db(): HesabuDB {
  if (!instance) instance = new HesabuDB();
  return instance;
}

/** Test seam: swap in an in-memory/fake-indexeddb instance. */
export function setDb(next: HesabuDB | null): void {
  instance = next;
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db().meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db().meta.put({ key, value });
}

export const META_KEYS = {
  activeBusinessId: 'activeBusinessId',
  userId: 'userId',
  pinHash: 'pinHash',
  unlockedAt: 'unlockedAt',
  lastPulledAt: 'lastPulledAt',
  locale: 'locale',
  /** Signed in with a setup code: the next screen is "choose your password". */
  mustSetPassword: 'mustSetPassword',
  /** This login is the operator (creates shops, issues codes). */
  operator: 'operator',
} as const;
