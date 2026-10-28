import { useLiveQuery } from 'dexie-react-hooks';

import { stockAsOf } from '../calc/stock';
import { refreshCountLines, type CountLine } from '../calc/stock-count';
import { statsByCustomer } from '../customers';
import type { StockCount } from '../types';
import { db } from './db';

/*
 * Hooks for the report screens (customers, stock checks). Kept apart from
 * queries.ts, which the sales screen loads, so their maths stays off the
 * first load.
 */

/** Purchases per customer (count, total, last date), for the customer list. */
export function useCustomerStats(businessId: string | null) {
  return useLiveQuery(async () => {
    if (!businessId) return statsByCustomer([]);
    const sales = await db().sales.where('businessId').equals(businessId).toArray();
    return statsByCustomer(sales);
  }, [businessId]);
}

/**
 * Each count's lines with "expected" read again from the ledger as it is now,
 * so a sale from before the count that synced afterwards stops showing as
 * missing (see refreshCountLines).
 */
export function useRefreshedCounts(businessId: string | null, counts: readonly StockCount[] | undefined) {
  return useLiveQuery(async () => {
    const out = new Map<string, { lines: CountLine[]; corrected: number }>();
    if (!businessId || !counts?.length) return out;
    const movements = await db().stockMovements.where('businessId').equals(businessId).toArray();
    for (const count of counts) {
      if (count.kind !== 'check') {
        out.set(count.id, { lines: count.lines, corrected: 0 });
        continue;
      }
      out.set(count.id, refreshCountLines(count.lines, movements, count.id, count.clientCreatedAt, stockAsOf));
    }
    return out;
  }, [businessId, counts]);
}
