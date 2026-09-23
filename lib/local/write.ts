import type { Table } from 'dexie';

import { nowIso } from '../date';
import { db, type HesabuDB } from './db';
import type { OutboxEntry } from '../types';

/**
 * Dexie table name -> Postgres table name. The sync layer converts camelCase
 * keys to snake_case generically, so only the table names need a map.
 */
export const PG_TABLE: Record<string, string> = {
  businesses: 'businesses',
  members: 'members',
  products: 'products',
  productPacks: 'product_packs',
  priceHistory: 'price_history',
  stockMovements: 'stock_movements',
  customers: 'customers',
  suppliers: 'suppliers',
  sales: 'sales',
  saleLines: 'sale_lines',
  payments: 'payments',
  expenses: 'expenses',
  purchases: 'purchases',
  purchaseLines: 'purchase_lines',
  wasteEvents: 'waste_events',
  dayClosings: 'day_closings',
  documents: 'documents',
  documentLines: 'document_lines',
};

export type SyncedTable = keyof typeof PG_TABLE;

interface Persistable {
  id: string;
  businessId?: string | null;
}

/**
 * Every write goes through here: the row lands in IndexedDB and an outbox entry
 * is queued in the same transaction. Either both happen or neither does, so the
 * queue can never disagree with what the user sees on screen.
 */
export async function persist<T extends Persistable>(
  tableName: SyncedTable,
  rows: T | readonly T[]
): Promise<void> {
  const list = Array.isArray(rows) ? rows : [rows as T];
  if (list.length === 0) return;

  const database = db();
  const table = database[tableName as keyof HesabuDB] as unknown as Table<T, string>;

  await database.transaction('rw', table, database.outbox, async () => {
    const before = await table.bulkGet(list.map((row) => row.id));
    await table.bulkPut(list as T[]);
    const entries: OutboxEntry[] = list.map((row, i) => ({
      table: PG_TABLE[tableName]!,
      rowId: row.id,
      businessId: row.businessId ?? row.id,
      op: before[i] ? 'upsert' : 'insert',
      payload: row as unknown as Record<string, unknown>,
      createdAt: nowIso(),
      attempts: 0,
    }));
    await database.outbox.bulkAdd(entries);
  });
}

/**
 * Runs several table writes atomically. Used by flows that produce more than
 * one kind of row -- a sale is a sale, its lines, its payments and its stock
 * movements, and a half-written sale would be worse than none.
 */
export async function persistAll(
  groups: readonly { table: SyncedTable; rows: readonly Persistable[] }[]
): Promise<void> {
  const database = db();
  const tables = groups.map(
    (group) => database[group.table as keyof HesabuDB] as unknown as Table<Persistable, string>
  );

  await database.transaction('rw', [...tables, database.outbox], async () => {
    const entries: OutboxEntry[] = [];
    for (const [index, group] of groups.entries()) {
      if (group.rows.length === 0) continue;
      const before = await tables[index]!.bulkGet(group.rows.map((row) => row.id));
      await tables[index]!.bulkPut([...group.rows]);
      for (const [i, row] of group.rows.entries()) {
        entries.push({
          table: PG_TABLE[group.table]!,
          rowId: row.id,
          businessId: row.businessId ?? row.id,
          op: before[i] ? 'upsert' : 'insert',
          payload: row as unknown as Record<string, unknown>,
          createdAt: nowIso(),
          attempts: 0,
        });
      }
    }
    if (entries.length > 0) await database.outbox.bulkAdd(entries);
  });
}

/** How many writes are still waiting for the network. Drives the header indicator. */
export async function pendingCount(): Promise<number> {
  return db().outbox.count();
}
