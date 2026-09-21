import type { Payment } from '../types';

/**
 * The *daftari la madeni* is derived, never stored -- a balance column would be
 * one more thing to go wrong when a payment syncs late.
 *
 * Two kinds of row make up a balance, and they are told apart by `saleId`:
 *   - a `credit` row attached to a sale is what the customer took on tick;
 *   - any other incoming row with no sale is money they came back and paid.
 */
export function isCreditCharge(payment: Payment): boolean {
  return (
    !payment.deletedAt &&
    payment.direction === 'in' &&
    payment.method === 'credit' &&
    payment.saleId != null &&
    payment.customerId != null
  );
}

export function isDebtRepayment(payment: Payment): boolean {
  return (
    !payment.deletedAt &&
    payment.direction === 'in' &&
    payment.method !== 'credit' &&
    payment.saleId == null &&
    payment.customerId != null
  );
}

export function customerBalance(payments: readonly Payment[]): number {
  let balance = 0;
  for (const payment of payments) {
    if (isCreditCharge(payment)) balance += payment.amount;
    else if (isDebtRepayment(payment)) balance -= payment.amount;
  }
  return balance;
}

export function balancesByCustomer(payments: readonly Payment[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const payment of payments) {
    const id = payment.customerId;
    if (!id) continue;
    if (isCreditCharge(payment)) balances.set(id, (balances.get(id) ?? 0) + payment.amount);
    else if (isDebtRepayment(payment)) balances.set(id, (balances.get(id) ?? 0) - payment.amount);
  }
  return balances;
}

/** When each customer last paid something, for the "hajalipa kwa siku N" line. */
export function lastPaymentByCustomer(payments: readonly Payment[]): Map<string, string> {
  const last = new Map<string, string>();
  for (const payment of payments) {
    if (!isDebtRepayment(payment)) continue;
    const id = payment.customerId!;
    const current = last.get(id);
    if (!current || payment.clientCreatedAt > current) last.set(id, payment.clientCreatedAt);
  }
  return last;
}

/** Total owed to the business across everyone. */
export function totalOutstanding(payments: readonly Payment[]): number {
  let total = 0;
  for (const balance of balancesByCustomer(payments).values()) {
    if (balance > 0) total += balance;
  }
  return total;
}

/**
 * Supplier side of the same idea: what we bought on credit minus what we have
 * paid them back.
 */
export function supplierBalance(
  purchases: readonly { supplierId?: string | null; total: number; paidAmount: number; deletedAt?: string | null }[],
  payments: readonly Payment[],
  supplierId: string
): number {
  let owed = 0;
  for (const purchase of purchases) {
    if (purchase.deletedAt || purchase.supplierId !== supplierId) continue;
    owed += purchase.total - purchase.paidAmount;
  }
  for (const payment of payments) {
    if (payment.deletedAt) continue;
    if (payment.direction !== 'out' || payment.supplierId !== supplierId) continue;
    if (payment.purchaseId) continue; // already reflected in paidAmount
    owed -= payment.amount;
  }
  return owed;
}
