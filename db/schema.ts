import {
  bigint,
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/*
 * Conventions (see CLAUDE.md):
 * - Money is integer TZS in `bigint`. There are no floats anywhere in this file.
 * - Quantities are numeric(12,3) so kg and litres survive round-tripping.
 * - Every tenant table carries business_id and is covered by an RLS policy.
 * - Financial rows are never hard-deleted; `deletedAt` hides them instead.
 */

export const businessMode = pgEnum('business_mode', ['genge', 'duka', 'biashara']);
export const memberRole = pgEnum('member_role', ['owner', 'manager', 'cashier']);
export const productUnit = pgEnum('product_unit', [
  'fungu',
  'kg',
  'kipande',
  'bunda',
  'debe',
  'pakti',
  'lita',
  'dazeni',
  'custom',
]);
export const vatType = pgEnum('vat_type', ['standard', 'exempt', 'zero']);
export const movementType = pgEnum('movement_type', [
  'sale',
  'purchase',
  'waste',
  'adjust',
  'void',
]);
export const wasteReason = pgEnum('waste_reason', ['imeoza', 'imeibiwa', 'imeharibika', 'nyingine']);
export const saleStatus = pgEnum('sale_status', ['complete', 'void']);
export const paymentMethod = pgEnum('payment_method', [
  'cash',
  'mpesa',
  'mixx',
  'airtel',
  'halopesa',
  'bank',
  'credit',
]);
export const paymentDirection = pgEnum('payment_direction', ['in', 'out']);
export const expenseCategory = pgEnum('expense_category', [
  'nauli',
  'ushuru',
  'kodi',
  'umeme',
  'chakula',
  'mishahara',
  'nyingine',
]);
export const documentKind = pgEnum('document_kind', ['proforma', 'delivery_note', 'invoice']);
export const documentStatus = pgEnum('document_status', [
  'draft',
  'sent',
  'part_paid',
  'paid',
  'cancelled',
]);

/** Integer TZS. Never a float. */
const money = (name: string) => bigint(name, { mode: 'number' });
/** kg / litres / heaps all fit in three decimal places. */
const qtyCol = (name: string) => numeric(name, { precision: 12, scale: 3, mode: 'number' });

const rowStamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey(),
  /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
  name: text('name').notNull(),
  /** The onboarding picker value: genge, duka, pharmacy, hardware, wholesale, services, other. */
  type: text('type').notNull(),
  /** Derived from type, but switchable later in settings without touching data. */
  mode: businessMode('mode').notNull().default('genge'),
  tin: text('tin'),
  vrn: text('vrn'),
  phone: text('phone'),
  logoUrl: text('logo_url'),
  locale: text('locale').notNull().default('sw'),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  ...rowStamps,
});

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** Null while an invite is pending; claim_invites() fills it on first sign-in. */
    userId: uuid('user_id'),
    name: text('name'),
    phone: text('phone'),
    role: memberRole('role').notNull().default('cashier'),
    /** Device unlock PIN. Only ever a hash; the PIN itself never leaves the device. */
    pinHash: text('pin_hash'),
    active: boolean('active').notNull().default(true),
    ...rowStamps,
  },
  (t) => [unique('members_business_user_uniq').on(t.businessId, t.userId)]
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    unit: productUnit('unit').notNull().default('kipande'),
    /** Free text when unit = 'custom' (e.g. "ndoo"). */
    unitLabel: text('unit_label'),
    price: money('price').notNull().default(0),
    cost: money('cost'),
    trackStock: boolean('track_stock').notNull().default(false),
    lowStockLevel: qtyCol('low_stock_level'),
    icon: text('icon'),
    photoUrl: text('photo_url'),
    sku: text('sku'),
    barcode: text('barcode'),
    category: text('category'),
    vatType: vatType('vat_type').notNull().default('standard'),
    sortOrder: bigint('sort_order', { mode: 'number' }).notNull().default(0),
    active: boolean('active').notNull().default(true),
    ...rowStamps,
  },
  (t) => [index('products_business_idx').on(t.businessId, t.active)]
);

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    price: money('price').notNull(),
    effectiveDate: date('effective_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('price_history_day_uniq').on(t.productId, t.effectiveDate)]
);

/**
 * Append-only ledger. Current stock is the sum of qty for a product; there is no
 * stock column to drift out of date. Sales write negative qty, purchases positive.
 */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    qty: qtyCol('qty').notNull(),
    type: movementType('type').notNull(),
    reason: wasteReason('reason'),
    /** Sale, purchase or waste row this movement came from. */
    refId: uuid('ref_id'),
    unitCost: money('unit_cost'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by'),
  },
  (t) => [index('stock_movements_product_idx').on(t.businessId, t.productId)]
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    note: text('note'),
    ...rowStamps,
  },
  (t) => [index('customers_business_idx').on(t.businessId)]
);

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    note: text('note'),
    ...rowStamps,
  },
  (t) => [index('suppliers_business_idx').on(t.businessId)]
);

export const sales = pgTable(
  'sales',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id),
    total: money('total').notNull(),
    discount: money('discount').notNull().default(0),
    status: saleStatus('status').notNull().default('complete'),
    voidReason: text('void_reason'),
    /** Unguessable token for the public receipt page. */
    receiptToken: text('receipt_token').notNull().unique(),
    note: text('note'),
    createdBy: uuid('created_by'),
    /** When the phone recorded it. May precede createdAt by days when offline. */
    clientCreatedAt: timestamp('client_created_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('sales_business_time_idx').on(t.businessId, t.clientCreatedAt)]
);

export const saleLines = pgTable(
  'sale_lines',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id),
    /** Free text for amount-only sales, where there is no product. */
    description: text('description'),
    qty: qtyCol('qty').notNull(),
    unitPrice: money('unit_price').notNull(),
    lineTotal: money('line_total').notNull(),
    /** Cost snapshot at sale time, so profit history does not move when costs change. */
    unitCost: money('unit_cost'),
    vatType: vatType('vat_type').notNull().default('standard'),
  },
  (t) => [index('sale_lines_sale_idx').on(t.saleId)]
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    saleId: uuid('sale_id').references(() => sales.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    purchaseId: uuid('purchase_id'),
    documentId: uuid('document_id'),
    direction: paymentDirection('direction').notNull().default('in'),
    method: paymentMethod('method').notNull(),
    amount: money('amount').notNull(),
    reference: text('reference'),
    note: text('note'),
    createdBy: uuid('created_by'),
    clientCreatedAt: timestamp('client_created_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('payments_customer_idx').on(t.businessId, t.customerId),
    index('payments_time_idx').on(t.businessId, t.clientCreatedAt),
  ]
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    category: expenseCategory('category').notNull().default('nyingine'),
    amount: money('amount').notNull(),
    method: paymentMethod('method').notNull().default('cash'),
    note: text('note'),
    createdBy: uuid('created_by'),
    clientCreatedAt: timestamp('client_created_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('expenses_time_idx').on(t.businessId, t.clientCreatedAt)]
);

export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    total: money('total').notNull(),
    paidAmount: money('paid_amount').notNull().default(0),
    method: paymentMethod('method').notNull().default('cash'),
    note: text('note'),
    createdBy: uuid('created_by'),
    clientCreatedAt: timestamp('client_created_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('purchases_time_idx').on(t.businessId, t.clientCreatedAt)]
);

export const purchaseLines = pgTable(
  'purchase_lines',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    qty: qtyCol('qty').notNull(),
    totalCost: money('total_cost').notNull(),
  },
  (t) => [index('purchase_lines_purchase_idx').on(t.purchaseId)]
);

export const wasteEvents = pgTable(
  'waste_events',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    qty: qtyCol('qty').notNull(),
    reason: wasteReason('reason').notNull().default('nyingine'),
    /** Cost of what was lost, snapshotted. Feeds the daily summary. */
    costValue: money('cost_value').notNull().default(0),
    note: text('note'),
    createdBy: uuid('created_by'),
    clientCreatedAt: timestamp('client_created_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('waste_time_idx').on(t.businessId, t.clientCreatedAt)]
);

export const dayClosings = pgTable(
  'day_closings',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    openingCash: money('opening_cash').notNull().default(0),
    expectedCash: money('expected_cash').notNull(),
    countedCash: money('counted_cash').notNull(),
    /** counted - expected. Negative is *pungufu*, positive is *zaidi*. */
    difference: money('difference').notNull(),
    note: text('note'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('day_closings_day_uniq').on(t.businessId, t.date)]
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    kind: documentKind('kind').notNull(),
    /** PF-0001 / DN-0001 / INV-0001, sequential per business per kind. */
    number: text('number').notNull(),
    customerId: uuid('customer_id').references(() => customers.id),
    /** The document this one was converted from. */
    parentId: uuid('parent_id'),
    status: documentStatus('status').notNull().default('draft'),
    subtotal: money('subtotal').notNull().default(0),
    vat: money('vat').notNull().default(0),
    total: money('total').notNull().default(0),
    notes: text('notes'),
    dueDate: date('due_date'),
    createdBy: uuid('created_by'),
    clientCreatedAt: timestamp('client_created_at', { withTimezone: true }).notNull(),
    ...rowStamps,
  },
  (t) => [unique('documents_number_uniq').on(t.businessId, t.kind, t.number)]
);

export const documentLines = pgTable(
  'document_lines',
  {
    id: uuid('id').primaryKey(),
    /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id),
    description: text('description').notNull(),
    qty: qtyCol('qty').notNull(),
    unitPrice: money('unit_price').notNull(),
    vatType: vatType('vat_type').notNull().default('standard'),
    lineTotal: money('line_total').notNull(),
  },
  (t) => [index('document_lines_doc_idx').on(t.documentId)]
);

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey(),
  /** Set by the database on every write; the pull cursor. Never trusted from a phone clock. */
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
  businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'),
  message: text('message').notNull(),
  context: jsonb('context').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
