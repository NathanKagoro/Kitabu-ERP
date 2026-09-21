/**
 * Tanzanian mobile numbers. People write theirs every way imaginable --
 * 0712 345 678, +255 712 345 678, 255712345678, 712345678 -- and all of them
 * are the same number, so normalise rather than scold.
 */

const NATIONAL_LENGTH = 9; // e.g. 712345678
const MOBILE_PREFIX = /^[67]/; // Vodacom, Airtel, Tigo/Yas, Halotel, TTCL

export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digits) return null;

  let national = digits;
  if (national.startsWith('255')) national = national.slice(3);
  else if (national.startsWith('0')) national = national.slice(1);

  if (national.length !== NATIONAL_LENGTH) return null;
  if (!MOBILE_PREFIX.test(national)) return null;

  return `+255${national}`;
}

/** Local display form: 0712 345 678. */
export function formatPhone(e164: string): string {
  const national = e164.replace(/^\+255/, '');
  if (national.length !== NATIONAL_LENGTH) return e164;
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/** wa.me wants the number without a plus and without spaces. */
export function whatsappNumber(phone: string): string | null {
  const normalised = normalisePhone(phone);
  return normalised ? normalised.replace('+', '') : null;
}
