import { db, getMeta, META_KEYS, setDb, setMeta } from '../local/db';
import { isShowcase, setShowcase } from '../showcase';
import { uuidv7 } from '../uuid';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import type { Business, Member } from '../types';
import { isAcceptablePassword, loginEmail, normaliseSetupCode } from './login';
import { normalisePhone } from './phone';
import { hashPin, verifyPin, type PinHash } from './pin';

/**
 * Signing in is a phone number and a password.
 *
 *   - First time: the password is the setup code the operator (or the shop's
 *     owner, for staff) handed over. The next screen asks for a password of
 *     their own, and that is what they use from then on.
 *   - Forgotten password: they ask for a new setup code. Nobody can sign up.
 *
 * Two modes the rest of the app cannot tell apart:
 *   - Supabase configured: a real login, data syncs.
 *   - Demo (no Supabase keys, e.g. the GitHub Pages preview): a login that
 *     lives on this phone only. The setup code is always DEMO_CODE.
 */

export const DEMO_CODE = 'KTAB-2468';

export function isDemo(): boolean {
  return !isSupabaseConfigured();
}

export type SignInError = 'invalidPhone' | 'wrongPassword' | 'offline' | 'server';

export interface SignInResult {
  ok: boolean;
  userId?: string;
  /** Signed in with a setup code: send them to choose a password. */
  mustSetPassword?: boolean;
  operator?: boolean;
  error?: SignInError;
}

export async function signIn(rawPhone: string, secret: string): Promise<SignInResult> {
  const phone = normalisePhone(rawPhone);
  const email = loginEmail(rawPhone);
  if (!phone || !email) return { ok: false, error: 'invalidPhone' };
  if (!secret) return { ok: false, error: 'wrongPassword' };

  const client = await supabase();
  if (!client) return demoSignIn(phone, secret);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'offline' };

  // Try exactly what was typed; if that fails and it looks like a setup code
  // typed loosely ("abcd efgh"), try the code's canonical form.
  const attempts = [secret];
  const asCode = normaliseSetupCode(secret);
  if (asCode && asCode !== secret) attempts.push(asCode);

  for (const password of attempts) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status && error.status >= 500) return { ok: false, error: 'server' };
      continue;
    }
    const user = data.user;
    const mustSetPassword = user.user_metadata?.must_set_password === true;
    const operator = user.app_metadata?.kitabu_admin === true;
    await adoptUser(user.id, phone);
    await setMeta(META_KEYS.mustSetPassword, mustSetPassword);
    await setMeta(META_KEYS.operator, operator);
    await pullMemberships(user.id);
    return { ok: true, userId: user.id, mustSetPassword, operator };
  }
  return { ok: false, error: 'wrongPassword' };
}

export async function setPassword(password: string): Promise<{ ok: boolean; error?: 'tooShort' | 'offline' | 'server' }> {
  if (!isAcceptablePassword(password)) return { ok: false, error: 'tooShort' };
  const client = await supabase();
  if (client) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'offline' };
    const { error } = await client.auth.updateUser({ password, data: { must_set_password: false } });
    if (error) return { ok: false, error: 'server' };
  } else {
    const phone = await getMeta<string | null>('phone', null);
    if (!phone) return { ok: false, error: 'server' };
    await setMeta(demoPasswordKey(phone), await hashPin(password));
  }
  await setMeta(META_KEYS.mustSetPassword, false);
  return { ok: true };
}

/** The demo keeps its passwords on the phone, hashed like the PIN. */
const demoPasswordKey = (phone: string) => `demoPassword:${phone}`;

async function demoSignIn(phone: string, secret: string): Promise<SignInResult> {
  const stored = await getMeta<PinHash | null>(demoPasswordKey(phone), null);
  const typed = normaliseSetupCode(secret);
  const isCode = typed !== null && typed === normaliseSetupCode(DEMO_CODE);
  let mustSetPassword: boolean;
  if (stored && (await verifyPin(secret, stored))) mustSetPassword = false;
  else if (isCode) mustSetPassword = true;
  else return { ok: false, error: 'wrongPassword' };

  const userId = await localUserFor(phone);
  await adoptUser(userId, phone);
  await setMeta(META_KEYS.mustSetPassword, mustSetPassword);
  await setMeta(META_KEYS.operator, false);
  return { ok: true, userId, mustSetPassword, operator: false };
}

/**
 * Bring down the businesses this login belongs to, so the app opens on the
 * right till. Shops and staff are created on the server by the operator's
 * function, so a first sign-in always finds its membership here.
 */
async function pullMemberships(userId: string): Promise<void> {
  const client = await supabase();
  if (!client) return;
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
  await setMeta(META_KEYS.mustSetPassword, false);
  await setMeta(META_KEYS.operator, false);
  // Leaving the demo: back to this phone's own database and server.
  if (isShowcase()) {
    setShowcase(false);
    setDb(null);
  }
}

export async function memberFor(businessId: string, userId: string) {
  return db()
    .members.where('businessId')
    .equals(businessId)
    .filter((m) => m.userId === userId)
    .first();
}
