import { supabase } from '../supabase/client';
import type { BusinessStatus, BusinessType } from '../types';

/**
 * Calls to the `accounts` Edge Function (supabase/functions/accounts). These
 * need a connection: making a login can only happen on the server.
 */

export type AccountsError =
  | 'noBackend'
  | 'offline'
  | 'signedOut'
  | 'notOperator'
  | 'notAllowed'
  | 'noMember'
  | 'noShop'
  | 'badName'
  | 'badType'
  | 'badPhone'
  | 'server';

export type AccountsResult<T> = ({ ok: true } & T) | { ok: false; error: AccountsError };

const KNOWN = new Set<string>([
  'signedOut', 'notOperator', 'notAllowed', 'noMember', 'noShop', 'badName', 'badType', 'badPhone',
]);

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<AccountsResult<T>> {
  const client = await supabase();
  if (!client) return { ok: false, error: 'noBackend' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'offline' };
  const { data, error } = await client.functions.invoke('accounts', { body: { action, ...payload } });
  if (error) {
    // A non-2xx reply still carries our { ok:false, error } body.
    const context = (error as { context?: Response }).context;
    try {
      const body = context ? ((await context.json()) as { error?: string }) : null;
      if (body?.error && KNOWN.has(body.error)) return { ok: false, error: body.error as AccountsError };
    } catch {
      // fall through
    }
    return { ok: false, error: 'server' };
  }
  const body = data as { ok?: boolean; error?: string } & T;
  if (!body?.ok) return { ok: false, error: KNOWN.has(body?.error ?? '') ? (body.error as AccountsError) : 'server' };
  return body as { ok: true } & T;
}

export interface NewShopInput {
  name: string;
  type: BusinessType;
  ownerName: string;
  ownerPhone: string;
  locale: 'sw' | 'en';
  brandColor: string | null;
}

/** code is null when the owner already had a login (they keep their password). */
export function createShop(input: NewShopInput) {
  return call<{ businessId: string; code: string | null }>('create_shop', { ...input });
}

export interface ShopSummary {
  id: string;
  name: string;
  type: BusinessType;
  status: BusinessStatus;
  brandColor: string | null;
  createdAt: string;
  owner: { memberId: string; name: string | null; phone: string | null; hasLogin: boolean } | null;
  staff: number;
}

export function listShops() {
  return call<{ shops: ShopSummary[] }>('list_shops');
}

export function updateShop(businessId: string, patch: { name?: string; type?: BusinessType; status?: BusinessStatus; settings?: { brandColor?: string } }) {
  return call<Record<string, never>>('update_shop', { businessId, ...patch });
}

/** A first login or a fresh code for a member. code is null when they already had a login. */
export function issueCode(businessId: string, memberId: string) {
  return call<{ code: string | null }>('issue_code', { businessId, memberId });
}
