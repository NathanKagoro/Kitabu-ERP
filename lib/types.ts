/**
 * The shared shape of every record, used identically by the local Dexie store,
 * the sync layer and the UI. Deliberately plain: IndexedDB stores structured
 * clones, so timestamps are ISO strings and money is a plain integer number.
 */

export type BusinessMode = 'genge' | 'duka' | 'biashara';
export type BusinessType =
  | 'cosmetics'
  | 'clothes'
  | 'genge'
  | 'duka'
  | 'pharmacy'
  | 'hardware'
  | 'wholesale'
  | 'services'
  | 'other';
export type MemberRole = 'owner' | 'manager' | 'cashier';

export type ProductUnit =
  | 'fungu'
  | 'kg'
  | 'kipande'
  | 'bunda'
  | 'debe'
  | 'pakti'
  | 'lita'
  | 'dazeni'
  | 'custom';

export type VatType = 'standard' | 'exempt' | 'zero';
export type MovementType = 'sale' | 'purchase' | 'waste' | 'adjust' | 'void';
export type WasteReason = 'imeoza' | 'imeibiwa' | 'imeharibika' | 'nyingine';
export type SaleStatus = 'complete' | 'void';
export type PaymentMethod = 'cash' | 'mpesa' | 'mixx' | 'airtel' | 'halopesa' | 'bank' | 'credit';
export type PaymentDirection = 'in' | 'out';
export type ExpenseCategory =
  | 'nauli'
  | 'ushuru'
  | 'kodi'
  | 'umeme'
  | 'chakula'
  | 'mishahara'
  | 'nyingine';
export type DocumentKind = 'proforma' | 'delivery_note' | 'invoice';
export type DocumentStatus = 'draft' | 'sent' | 'part_paid' | 'paid' | 'cancelled';

/** Payment methods that move physical cash in the drawer. */
export const CASH_METHODS: readonly PaymentMethod[] = ['cash'];
export const MOBILE_MONEY_METHODS: readonly PaymentMethod[] = [
  'mpesa',
  'mixx',
  'airtel',
  'halopesa',
];

export interface BusinessSettings {
  vatRate?: number;
  receiptFooter?: string;
  reminderTemplate?: string;
  bankName?: string;
  bankAccount?: string;
  payNumber?: string;
  docCounters?: Partial<Record<DocumentKind, number>>;
  /** The shop's colour (#rrggbb). Unset: Kitabu green. */
  brandColor?: string;
  /** Street / area, printed on receipts and documents. */
  address?: string;
  /** Payment methods offered at the till. Unset or empty: all of them. */
  paymentMethods?: PaymentMethod[];
  /** Lipa Namba / till number per method, shown on receipts. */
  tillNumbers?: Partial<Record<PaymentMethod, string>>;
  /** Per-shop on/off overrides on top of the shop type's preset. */
  features?: Partial<Record<import('./modes').Feature, boolean>>;
}

/** Operator-controlled. A paused shop can still read its records but not sell. */
export type BusinessStatus = 'active' | 'paused';

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  mode: BusinessMode;
  tin?: string | null;
  vrn?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  locale: string;
  settings: BusinessSettings;
  /** Set only by the operator (see /admin). Absent on records from before 0.3. */
  status?: BusinessStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Member {
  id: string;
  businessId: string;
  /** Null while an invite is waiting for that phone number to sign in. */
  userId: string | null;
  name?: string | null;
  phone?: string | null;
  role: MemberRole;
  pinHash?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  unit: ProductUnit;
  unitLabel?: string | null;
  price: number;
  cost?: number | null;
  trackStock: boolean;
  lowStockLevel?: number | null;
  icon?: string | null;
  photoUrl?: string | null;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  /** Shade, size, colour, gauge -- what tells two of the same product apart. */
  variant?: string | null;
  vatType: VatType;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * A bulk size a product is bought in: a tenga of tomatoes, a 50kg gunia of
 * rice, a carton of soap. `units` is how many selling units it holds, which is
 * what turns "I bought 2 tenga for 60,000" into a cost per fungu.
 */
export interface ProductPack {
  id: string;
  businessId: string;
  productId: string;
  /** What the trader calls it: "tenga", "gunia 50kg", "katoni". */
  label: string;
  /** Selling units in one pack. 1 tenga = 40 fungu -> 40. */
  units: number;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PriceHistoryEntry {
  id: string;
  businessId: string;
  productId: string;
  price: number;
  effectiveDate: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  /** Signed: negative leaves the stall, positive arrives. */
  qty: number;
  type: MovementType;
  reason?: WasteReason | null;
  refId?: string | null;
  unitCost?: number | null;
  note?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  /** Asked not to get offers. Still a customer for credit and receipts. */
  noOffers?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Sale {
  id: string;
  businessId: string;
  customerId?: string | null;
  total: number;
  discount: number;
  status: SaleStatus;
  voidReason?: string | null;
  receiptToken: string;
  note?: string | null;
  createdBy?: string | null;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleLine {
  id: string;
  businessId: string;
  saleId: string;
  productId?: string | null;
  description?: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  unitCost?: number | null;
  vatType: VatType;
}

export interface Payment {
  id: string;
  businessId: string;
  saleId?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  purchaseId?: string | null;
  documentId?: string | null;
  direction: PaymentDirection;
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
  note?: string | null;
  createdBy?: string | null;
  clientCreatedAt: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Expense {
  id: string;
  businessId: string;
  category: ExpenseCategory;
  amount: number;
  method: PaymentMethod;
  note?: string | null;
  createdBy?: string | null;
  clientCreatedAt: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Purchase {
  id: string;
  businessId: string;
  supplierId?: string | null;
  total: number;
  paidAmount: number;
  method: PaymentMethod;
  note?: string | null;
  createdBy?: string | null;
  clientCreatedAt: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface PurchaseLine {
  id: string;
  businessId: string;
  purchaseId: string;
  productId: string;
  /** Always in selling units, so stock maths never has to know about packs. */
  qty: number;
  totalCost: number;
  /** What was actually bought, kept so the purchase can be read back honestly. */
  packId?: string | null;
  packLabel?: string | null;
  packQty?: number | null;
}

export interface WasteEvent {
  id: string;
  businessId: string;
  productId: string;
  qty: number;
  reason: WasteReason;
  costValue: number;
  note?: string | null;
  createdBy?: string | null;
  clientCreatedAt: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface DayClosing {
  id: string;
  businessId: string;
  date: string;
  openingCash: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export type StockCountKind = 'check' | 'opening';

/** One line of a stock check, frozen as it was on the day (see lib/calc/stock-count.ts). */
export interface StockCountLine {
  productId: string;
  name: string;
  expected: number;
  counted: number;
  unitCost: number | null;
  unitPrice: number;
}

export interface StockCount {
  id: string;
  businessId: string;
  kind: StockCountKind;
  /** The shelf or category counted; null for everything. */
  scope?: string | null;
  itemsCounted: number;
  linesShort: number;
  unitsShort: number;
  valueShortCost: number;
  valueShortPrice: number;
  unitsOver: number;
  valueOverCost: number;
  lines: StockCountLine[];
  note?: string | null;
  createdBy?: string | null;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface BusinessDocument {
  id: string;
  businessId: string;
  kind: DocumentKind;
  number: string;
  customerId?: string | null;
  parentId?: string | null;
  status: DocumentStatus;
  subtotal: number;
  vat: number;
  total: number;
  notes?: string | null;
  dueDate?: string | null;
  createdBy?: string | null;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface DocumentLine {
  id: string;
  businessId: string;
  documentId: string;
  productId?: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  vatType: VatType;
  lineTotal: number;
}

/** A write waiting to reach the server. Drained in insertion order. */
export interface OutboxEntry {
  /** Auto-incremented by Dexie; preserves ordering. */
  seq?: number;
  /** Table name, matching the Postgres table. */
  table: string;
  /** Primary key of the row, so a retry upserts rather than duplicates. */
  rowId: string;
  businessId: string;
  /**
   * insert: first write of this row -- pushed as insert-or-ignore, so retrying an
   * already-delivered row is a no-op even for roles with no UPDATE permission.
   * upsert: an edit of a row that already existed.
   */
  op: 'insert' | 'upsert';
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
}
