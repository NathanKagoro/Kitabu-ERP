/**
 * The device unlock PIN. Four digits is 10,000 possibilities, which is fine for
 * a lock on a phone you are holding and useless as a secret -- so it is hashed
 * with PBKDF2 and a per-device salt, and it never leaves the device or reaches
 * the network. Losing it is recoverable by signing in with the phone number
 * again; that is deliberate.
 */

const ITERATIONS = 120_000;

export interface PinHash {
  salt: string;
  hash: string;
  iterations: number;
}

export async function hashPin(pin: string): Promise<PinHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  return { salt: toBase64(salt), hash: toBase64(hash), iterations: ITERATIONS };
}

export async function verifyPin(pin: string, stored: PinHash | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const salt = fromBase64(stored.salt);
  const hash = await derive(pin, salt, stored.iterations || ITERATIONS);
  return timingSafeEqual(toBase64(hash), stored.hash);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

/** Constant-time compare, so a wrong PIN leaks nothing through timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
