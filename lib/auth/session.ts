import { db, getMeta, META_KEYS, setMeta } from '../local/db';
import { uuidv7 } from '../uuid';
import { supabase } from '../supabase/client';
import type { Business, Member } from '../types';
import { normalisePhone } from './phone';

/**
 * Sign-in has two paths that the rest of the app cannot tell apart:
 *
 *   - Supabase configured: real phone OTP, real user id, data syncs.
 *   - Not configured: a local identity on this device. Everything works, the
 *     data simply stays on the phone until keys are added, at which point the
 *     outbox drains and nothing is lost.
 *
 * The dev OTP (123456) is gated on an explicit env flag so it cannot be the
 * accidental state of a production build.
 */

export const DEV_OTP = '123456';

export function devOtpEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_OTP === '1' || !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export interface SendCodeResult {
  ok: boolean;
  /** Present when the code was not really sent, so the UI can say so. */
  devMode?: boolean;
  error?: string;
}

export async function sendCode(rawPhone: string): Promise<SendCodeResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, error: 'invalidPhone' };

  const client = await supabase();
  if (!client) return { ok: true, devMode: true };

  const { error } = await client.auth.signInWithOtp({ phone });
  if (error) {
    // A misconfigured SMS provider should not lock a trader out of their own
    // records; fall back to the local identity rather than dead-ending.
    if (devOtpEnabled()) return { ok: true, devMode: true };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export interface VerifyResult {
  ok: boolean;
  userId?: string;
  error?: string;
}

export async function verifyCode(rawPhone: string, code: string): Promise<VerifyResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, error: 'invalidPhone' };

  const client = await supabase();
  if (client) {
    const { data, error } = await client.auth.verifyOtp({ phone, token: code, type: 'sms' });
    if (!error && data.user) {
      await adoptUser(data.user.id, phone);
      await pullMemberships(data.user.id);
      return { ok: true, userId: data.user.id };
    }
    if (!devOtpEnabled()) return { ok: false, error: 'invalidCode' };
  }

  if (!devOtpEnabled() || code !== DEV_OTP) return { ok: false, error: 'invalidCode' };

  const userId = await localUserFor(phone);
  await adoptUser(userId, phone);
  return { ok: true, userId };
}

/**
 * A staff member signing in on their own phone: attach any invites made out to
 * this number, then bring down the businesses they now belong to so the app
 * opens on the right till.
 */
async function pullMemberships(userId: string): Promise<void> {
  const client = await supabase();
  if (!client) return;
  await client.rpc('claim_invites');
  const { data: members } = await client.from('members').select('*').eq('user_id', userId).eq('active', true);
  if (!members?.length) return;
  const { toCamelCase } = await import('../sync/engine');
  const rows = members.map((m) => toCamelCase(m) as unknown as Member);
  await db().members.bulkPut(rows);
  const { data: businesses } = await client.from('businesses').select('*').in('id', rows.map((m) => m.businessId));
  if (businesses?.length) await db().businesses.bulkPut(businesses.map((b) => toCamelCase(b) as unknown as Business));
}

/** Stable per-device identity for a phone number, so signing in twice is one user. */
async function localUserFor(phone: string): Promise<string> {
  const key = `localUser:${phone}`;
  const existing = await getMeta<string | null>(key, null);
  if (existing) return existing;
  const userId = uuidv7();
  await setMeta(key, userId);
  return userId;
}

async function adoptUser(userId: string, phone: string): Promise<void> {
  await setMeta(META_KEYS.userId, userId);
  await setMeta('phone', phone);
}

export async function currentUserId(): Promise<string | null> {
  return getMeta<string | null>(META_KEYS.userId, null);
}

export async function currentBusinessId(): Promise<string | null> {
  return getMeta<string | null>(META_KEYS.activeBusinessId, null);
}

export async function signOut(): Promise<void> {
  const client = await supabase();
  if (client) await client.auth.signOut();
  // The local data stays. Signing out is "hand the phone to someone else",
  // not "throw away two weeks of sales".
  await setMeta(META_KEYS.userId, null);
  await setMeta(META_KEYS.unlockedAt, null);
}

export async function memberFor(businessId: string, userId: string) {
  return db()
    .members.where('businessId')
    .equals(businessId)
    .filter((m) => m.userId === userId)
    .first();
}
