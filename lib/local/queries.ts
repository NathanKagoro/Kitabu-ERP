'use client';

import { useLiveQuery } from 'dexie-react-hooks';

import { balancesByCustomer, lastPaymentByCustomer } from '../calc/credit';
import { stockByProduct } from '../calc/stock';
import { dayBounds } from '../date';
import type { EntityTable } from 'dexie';
import type { Customer, Expense, Payment, Product, Purchase, Sale, SaleLine, WasteEvent } from '../types';
import { db } from './db';

/*
 * Live queries: each re-runs when the tables it reads change, so a sale made on
 * the POS updates the summary and the daftari without any wiring in between.
 */

export function useProducts(businessId: string | null, includeArchived = false) {
  return useLiveQuery(async () => {
    if (!businessId) return [] as Product[];
    const rows = await db().products.where('businessId').equals(businessId).toArray();
    return rows
      .filter((p) => !p.deletedAt && (includeArchived || p.active))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [businessId, includeArchived]);
}

export function useStock(businessId: string | null) {
  return useLiveQuery(async () => {
    if (!businessId) return new Map<string, number>();
    const rows = await db().stockMovements.where('businessId').equals(businessId).toArray();
    return stockByProduct(rows);
  }, [businessId]);
}

export interface CustomerWithBalance extends Customer {
  balance: number;
  lastPaidAt: string | null;
}

export function useCustomers(businessId: string | null) {
  return useLiveQuery(async () => {
    if (!businessId) return [] as CustomerWithBalance[];
    const [customers, payments] = await Promise.all([
      db().customers.where('businessId').equals(businessId).toArray(),
      db().payments.where('businessId').equals(businessId).toArray(),
    ]);
    const balances = balancesByCustomer(payments);
    const lastPaid = lastPaymentByCustomer(payments);
    return customers
      .filter((c) => !c.deletedAt)
      .map((c) => ({ ...c, balance: balances.get(c.id) ?? 0, lastPaidAt: lastPaid.get(c.id) ?? null }))
      .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  }, [businessId]);
}

/** All rows for a date range, by clientCreatedAt -- the moment the phone recorded it. */
export async function loadRange(businessId: string, startDay: string, endDay: string) {
  const start = dayBounds(startDay).start;
  const end = dayBounds(endDay).end;
  const database = db();
  const range = <T extends { id: string }>(table: EntityTable<T, 'id'>) =>
    table
      .where('[businessId+clientCreatedAt]')
      .between([businessId, start], [businessId, end], true, false)
      .toArray();

  const [sales, payments, expenses, purchases, waste] = await Promise.all([
    range<Sale>(database.sales),
    range<Payment>(database.payments),
    range<Expense>(database.expenses),
    range<Purchase>(database.purchases),
    range<WasteEvent>(database.wasteEvents),
  ]);
  const saleIds = sales.map((s) => s.id);
  const saleLines: SaleLine[] = saleIds.length
    ? await database.saleLines.where('saleId').anyOf(saleIds).toArray()
    : [];

  return { sales, payments, expenses, purchases, waste, saleLines };
}
