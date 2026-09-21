import { db, getMeta, META_KEYS, setMeta } from '../local/db';
import { PG_TABLE } from '../local/write';
import { supabase } from '../supabase/client';
import type { OutboxEntry } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Push-then-pull sync.
 *
 * The contract that makes this safe over a bad connection: every row carries a
 * client-generated UUID v7 primary key, and every push is an upsert on that
 * key. A request that times out after the server committed it is therefore
 * indistinguishable from one that never arrived -- retrying is always correct,
 * and a sale can never be recorded twice.
 */

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 8;

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSyncedAt: string | null;
  error: string | null;
}

type Listener = (state: SyncState) => void;

let state: SyncState = { status: 'idle', pending: 0, lastSyncedAt: null, error: null };
const listeners = new Set<Listener>();
let running = false;
let queuedRun = false;

export function subscribeToSync(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

function update(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

export async function refreshPendingCount(): Promise<void> {
  update({ pending: await db().outbox.count() });
}

/** camelCase -> snake_case. The column names were chosen so this is lossless. */
export function toSnakeCase(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    out[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] = value;
  }
  return out;
}

export function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
  }
  return out;
}

export async function sync(): Promise<void> {
  const client = await supabase();
  if (!client) {
    // No backend configured: the local store is the whole system, and there is
    // nothing pending in any meaningful sense.
    await refreshPendingCount();
    update({ status: 'idle', error: null });
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await refreshPendingCount();
    update({ status: 'offline' });
    return;
  }

  // Collapse concurrent triggers (a sale plus the online event) into one run,
  // then run once more afterwards so nothing queued mid-run is left behind.
  if (running) {
    queuedRun = true;
    return;
  }
  running = true;
  update({ status: 'syncing', error: null });

  try {
    await push(client);
    await pull(client);
    await setMeta('lastSyncedAt', new Date().toISOString());
    update({ status: 'idle', lastSyncedAt: new Date().toISOString(), error: null });
  } catch (error) {
    update({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  } finally {
    await refreshPendingCount();
    running = false;
    if (queuedRun) {
      queuedRun = false;
      void sync();
    }
  }
}

async function push(client: SupabaseClient): Promise<void> {
  const database = db();

  for (;;) {
    const batch = await database.outbox.orderBy('seq').limit(BATCH_SIZE).toArray();
    if (batch.length === 0) return;

    // Group by table, keeping only the last write per row: an edited-then-edited
    // product does not need two round trips. A row stays an 'insert' only if
    // every write to it in this batch was its first.
    const byTable = new Map<string, Map<string, OutboxEntry>>();
    for (const entry of batch) {
      const rows = byTable.get(entry.table) ?? new Map<string, OutboxEntry>();
      const previous = rows.get(entry.rowId);
      const op = previous && previous.op === 'upsert' ? 'upsert' : entry.op;
      rows.set(entry.rowId, { ...entry, op });
      byTable.set(entry.table, rows);
    }

    const settledSeqs: number[] = [];
    const failed: OutboxEntry[] = [];

    for (const [table, rows] of byTable) {
      for (const op of ['insert', 'upsert'] as const) {
      const entries = [...rows.values()].filter((entry) => entry.op === op);
      if (entries.length === 0) continue;
      // synced_at belongs to the server; sending a stale one back would be ignored
      // by the trigger anyway, so leave it out.
      const payload = entries.map((entry) => {
        const { syncedAt: _ignored, ...rest } = entry.payload;
        return toSnakeCase(rest);
      });
      const { error } = await client
        .from(table)
        .upsert(payload, { onConflict: 'id', ignoreDuplicates: op === 'insert' });

      if (error) {
        failed.push(...entries);
        continue;
      }
      const done = new Set(entries.map((entry) => entry.rowId));
      for (const entry of batch) {
        if (entry.table === table && done.has(entry.rowId) && entry.seq != null) {
          settledSeqs.push(entry.seq);
        }
      }
      }
    }

    if (settledSeqs.length > 0) await database.outbox.bulkDelete(settledSeqs);
    await refreshPendingCount();

    if (failed.length > 0) {
      await recordFailures(failed);
      throw new Error(`Sync failed for ${failed.length} row(s)`);
    }
  }
}

/**
 * A row the server keeps rejecting (a validation error, a deleted parent) must
 * not block everything queued behind it forever. After enough tries it is moved
 * aside, and the rest of the queue drains.
 */
async function recordFailures(entries: readonly OutboxEntry[]): Promise<void> {
  const database = db();
  const dead: number[] = [];

  await database.transaction('rw', database.outbox, database.meta, async () => {
    for (const entry of entries) {
      if (entry.seq == null) continue;
      const attempts = entry.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        dead.push(entry.seq);
        const parked = await getMeta<OutboxEntry[]>('outbox:parked', []);
        await setMeta('outbox:parked', [...parked, { ...entry, attempts }].slice(-200));
      } else {
        await database.outbox.update(entry.seq, { attempts });
      }
    }
    if (dead.length > 0) await database.outbox.bulkDelete(dead);
  });
}

/**
 * Pulls rows changed since the last pull, table by table. The cursor is the
 * server's own synced_at (set by a trigger on every write), never the phone's
 * clock -- a phone with the wrong date must not make rows invisible.
 *
 * Financial rows are append-only so they cannot conflict. For editable rows
 * (products, customers, the business itself) the newer updatedAt wins, which is
 * the last-write-wins rule from the spec.
 */
const PAGE = 500;

async function pull(client: SupabaseClient): Promise<void> {
  const database = db();
  const businessId = await getMeta<string | null>(META_KEYS.activeBusinessId, null);
  if (!businessId) return;

  // A local row still waiting in the outbox is newer than anything the server has.
  const pendingIds = new Set((await database.outbox.toArray()).map((entry) => entry.rowId));

  for (const [localTable, remoteTable] of Object.entries(PG_TABLE)) {
    const cursorKey = `${META_KEYS.lastPulledAt}:${businessId}:${remoteTable}`;
    let cursor = await getMeta<string | null>(cursorKey, null);

    for (;;) {
      let query = client
        .from(remoteTable)
        .select('*')
        .eq(localTable === 'businesses' ? 'id' : 'business_id', businessId)
        .order('synced_at', { ascending: true })
        .limit(PAGE);
      if (cursor) query = query.gt('synced_at', cursor);

      const { data, error } = await query;
      if (error) throw new Error(`pull ${remoteTable}: ${error.message}`);
      if (!data || data.length === 0) break;

      const table = database.table(localTable);
      for (const raw of data) {
        const row = toCamelCase(raw as Record<string, unknown>) as { id: string; updatedAt?: string };
        if (pendingIds.has(row.id)) continue;
        const existing = (await table.get(row.id)) as { updatedAt?: string } | undefined;
        if (existing?.updatedAt && row.updatedAt && existing.updatedAt > row.updatedAt) continue;
        await table.put(row);
      }

      cursor = String((data[data.length - 1] as { synced_at: string }).synced_at);
      await setMeta(cursorKey, cursor);
      if (data.length < PAGE) break;
    }
  }
}

let wired = false;

/** Starts the background sync loop. Safe to call more than once. */
export function startSync(): void {
  if (wired || typeof window === 'undefined') return;
  wired = true;

  void refreshPendingCount();
  // The first sync waits until the till is idle: it pulls in the Supabase client
  // (~70KB), which must never compete with the sales screen for a 3G link.
  const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1));
  setTimeout(() => idle(() => void sync()), 3000);

  window.addEventListener('online', () => void sync());
  window.addEventListener('offline', () => update({ status: 'offline' }));
  // Coming back to the app after it was backgrounded is the most common moment
  // for a phone to have regained signal.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync();
  });
  setInterval(() => void sync(), 60_000);
}
