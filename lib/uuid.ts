/**
 * UUID v7 -- time-ordered, so rows created offline sort correctly once they
 * reach the server, and an upsert of the same id is idempotent no matter how
 * many times a flaky 3G connection retries it.
 *
 * Layout (RFC 9562): 48-bit big-endian unix millis | version 7 | 12 bits of
 * sequence | variant 10 | 62 bits of randomness.
 */

let lastMillis = 0;
let sequence = 0;

export function uuidv7(now: number = Date.now()): string {
  // Within the same millisecond, keep incrementing so ids stay strictly ordered
  // (a fast till can record two sales inside one tick).
  if (now === lastMillis) {
    sequence = (sequence + 1) & 0xfff;
    if (sequence === 0) now = ++lastMillis;
  } else {
    lastMillis = now;
    sequence = randomBytes(2)[0]! & 0x0fff;
  }

  const bytes = new Uint8Array(16);
  const millis = BigInt(now);
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((millis >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = 0x70 | ((sequence >> 8) & 0x0f);
  bytes[7] = sequence & 0xff;

  const rand = randomBytes(8);
  bytes[8] = 0x80 | (rand[0]! & 0x3f);
  for (let i = 1; i < 8; i++) bytes[8 + i] = rand[i]!;

  return format(bytes);
}

/** Extracts the creation time back out of a v7 id. Handy for debugging sync. */
export function uuidv7Time(id: string): number {
  const hex = id.replace(/-/g, '').slice(0, 12);
  return Number.parseInt(hex, 16);
}

/**
 * A receipt token that cannot be guessed by walking numbers -- the public
 * receipt page has no other protection.
 */
export function receiptToken(): string {
  const bytes = randomBytes(12);
  let out = '';
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const webcrypto = globalThis.crypto;
  if (webcrypto?.getRandomValues) {
    webcrypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < length; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

function format(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (const byte of bytes) hex.push(byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
