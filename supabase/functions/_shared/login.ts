/**
 * How a phone number and password become a Supabase login, and what a setup
 * code looks like. Shared, byte for byte, by the app, the `accounts` Edge
 * Function (supabase/functions/_shared/login.ts -- a test keeps the two
 * identical) and the operator script. No imports, so it runs in all three.
 *
 * Supabase has no SMS-free "phone + password" sign-in, so each phone number
 * maps to a fixed email-style login that is never sent mail:
 *   0712 345 678  ->  255712345678@phone.kitabu.app
 * Email confirmation and public sign-up are both switched off in Supabase;
 * only the operator's function creates logins.
 */

export const LOGIN_DOMAIN = 'phone.kitabu.app';

/** Accepts 0712 345 678, +255 712 345 678, 255712345678, 712345678. */
export function phoneDigits(input: string): string | null {
  const digits = String(input).replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digits) return null;
  let national = digits;
  if (national.startsWith('255')) national = national.slice(3);
  else if (national.startsWith('0')) national = national.slice(1);
  if (national.length !== 9 || !/^[67]/.test(national)) return null;
  return `255${national}`;
}

export function loginEmail(phone: string): string | null {
  const digits = phoneDigits(phone);
  return digits ? `${digits}@${LOGIN_DOMAIN}` : null;
}

/**
 * Setup codes: 8 characters with nothing that can be misread on a phone
 * screen or over a call (no 0/O, 1/I/L, 5/S). Shown as ABCD-EFGH.
 * 29^8 is about 500 billion, and Supabase rate-limits sign-in attempts.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
export const CODE_LENGTH = 8;

/**
 * Pass 32 random bytes (crypto.getRandomValues). Bytes at or above 232 (= 29 x 8)
 * are skipped so every symbol is equally likely.
 */
export function makeSetupCode(randomBytes: Uint8Array): string {
  const limit = CODE_ALPHABET.length * Math.floor(256 / CODE_ALPHABET.length);
  let code = '';
  for (const byte of randomBytes) {
    if (byte >= limit) continue;
    code += CODE_ALPHABET.charAt(byte % CODE_ALPHABET.length);
    if (code.length === CODE_LENGTH) return code;
  }
  throw new Error('not enough random bytes for a setup code');
}

/** "abcd-efgh", "ABCD EFGH" -> "ABCDEFGH"; anything else -> null. */
export function normaliseSetupCode(input: string): string | null {
  const cleaned = String(input).toUpperCase().replace(/[\s-]/g, '');
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const ch of cleaned) if (!CODE_ALPHABET.includes(ch)) return null;
  return cleaned;
}

export function formatSetupCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Chosen passwords: at least 6 characters (Supabase's own minimum). */
export const MIN_PASSWORD_LENGTH = 6;

export function isAcceptablePassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.trim().length > 0;
}
