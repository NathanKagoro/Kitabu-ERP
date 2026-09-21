import { vatBreakdown, type CartLine } from '../calc/sale';
import { nowIso } from '../date';
import type { BusinessDocument, DocumentKind, DocumentLine, Payment, PaymentMethod } from '../types';
import { uuidv7 } from '../uuid';
import { recordSale } from './actions';
import { db } from './db';
import { persist, persistAll } from './write';

/**
 * Proforma -> delivery note -> invoice. Each conversion copies the lines
 * forward and links back to its parent, so the chain is traceable.
 *
 * The invoice is where money becomes real: issuing one records a credit sale
 * for the customer. That single decision means invoices show up in the daily
 * summary, reduce stock, and land in the daftari -- with no second set of
 * books for biashara mode to drift out of step with.
 */

export const DOC_PREFIX: Record<DocumentKind, string> = {
  proforma: 'PF',
  delivery_note: 'DN',
  invoice: 'INV',
};

export function formatDocNumber(kind: DocumentKind, n: number): string {
  return `${DOC_PREFIX[kind]}-${String(n).padStart(4, '0')}`;
}

export function parseDocNumber(number: string): number {
  const match = /-(\d+)$/.exec(number);
  return match ? Number(match[1]) : 0;
}

async function nextNumber(businessId: string, kind: DocumentKind): Promise<string> {
  const existing = await db().documents.where('[businessId+kind]').equals([businessId, kind]).toArray();
  const highest = existing.reduce((max, d) => Math.max(max, parseDocNumber(d.number)), 0);
  return formatDocNumber(kind, highest + 1);
}

export interface DocLineInput {
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  vatType: DocumentLine['vatType'];
}

export async function createDocument(input: {
  businessId: string;
  userId?: string | null;
  kind: DocumentKind;
  customerId: string;
  lines: readonly DocLineInput[];
  vatRate: number;
  parentId?: string | null;
  notes?: string | null;
  dueDate?: string | null;
}): Promise<BusinessDocument> {
  const at = nowIso();
  const id = uuidv7();
  const lines: DocumentLine[] = input.lines.map((line) => ({
    id: uuidv7(),
    businessId: input.businessId,
    documentId: id,
    productId: line.productId,
    description: line.description,
    qty: line.qty,
    unitPrice: Math.round(line.unitPrice),
    vatType: line.vatType,
    lineTotal: Math.round(line.qty * line.unitPrice),
  }));
  const totals = vatBreakdown(lines, input.vatRate);

  const document: BusinessDocument = {
    id,
    businessId: input.businessId,
    kind: input.kind,
    number: await nextNumber(input.businessId, input.kind),
    customerId: input.customerId,
    parentId: input.parentId ?? null,
    status: 'draft',
    subtotal: totals.subtotal,
    vat: totals.vat,
    total: totals.total,
    notes: input.notes ?? null,
    dueDate: input.dueDate ?? null,
    createdBy: input.userId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };

  await persistAll([
    { table: 'documents', rows: [document] },
    { table: 'documentLines', rows: lines },
  ]);

  if (input.kind === 'invoice') {
    const cart: CartLine[] = lines.map((line) => ({
      id: uuidv7(),
      productId: line.productId ?? null,
      description: line.description,
      qty: line.qty,
      unitPrice: line.unitPrice,
      unitCost: null,
      vatType: line.vatType,
    }));
    // Fill in cost snapshots so invoice profit is as honest as POS profit.
    const products = await db().products.bulkGet(cart.map((c) => c.productId ?? ''));
    cart.forEach((c, i) => (c.unitCost = products[i]?.cost ?? null));
    await recordSale({
      businessId: input.businessId,
      userId: input.userId,
      lines: cart,
      tenders: [],
      customerId: input.customerId,
      note: document.number,
    });
  }

  return document;
}

/** One tap: carry this document's lines into the next kind. */
export async function convertDocument(
  sourceId: string,
  kind: DocumentKind,
  actor: { businessId: string; userId?: string | null; vatRate: number }
): Promise<BusinessDocument> {
  const source = await db().documents.get(sourceId);
  if (!source || !source.customerId) throw new Error('Document not found');
  const lines = await db().documentLines.where('documentId').equals(sourceId).toArray();
  const created = await createDocument({
    ...actor,
    kind,
    customerId: source.customerId,
    parentId: source.id,
    notes: source.notes,
    lines: lines.map((l) => ({
      productId: l.productId ?? null,
      description: l.description,
      qty: l.qty,
      unitPrice: l.unitPrice,
      vatType: l.vatType,
    })),
  });
  await persist('documents', { ...source, status: 'sent', updatedAt: nowIso() });
  return created;
}

/** Payment against an invoice. Also a debt repayment, so the daftari agrees. */
export async function recordDocumentPayment(input: {
  businessId: string;
  userId?: string | null;
  documentId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
}): Promise<void> {
  const document = await db().documents.get(input.documentId);
  if (!document) throw new Error('Document not found');
  const at = nowIso();
  const payment: Payment = {
    id: uuidv7(),
    businessId: input.businessId,
    saleId: null,
    customerId: document.customerId ?? null,
    supplierId: null,
    purchaseId: null,
    documentId: document.id,
    direction: 'in',
    method: input.method,
    amount: Math.round(input.amount),
    reference: input.reference ?? null,
    note: document.number,
    createdBy: input.userId ?? null,
    clientCreatedAt: at,
    createdAt: at,
    deletedAt: null,
  };
  const paid = (await documentPaid(document.id)) + payment.amount;
  const updated: BusinessDocument = { ...document, status: paid >= document.total ? 'paid' : 'part_paid', updatedAt: at };
  await persistAll([
    { table: 'payments', rows: [payment] },
    { table: 'documents', rows: [updated] },
  ]);
}

export async function documentPaid(documentId: string): Promise<number> {
  const rows = await db().payments.filter((p) => p.documentId === documentId && !p.deletedAt).toArray();
  return rows
    .reduce((sum, p) => sum + p.amount, 0);
}
