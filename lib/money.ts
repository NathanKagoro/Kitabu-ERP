/**
 * Every amount in Hesabu is an integer number of Tanzanian shillings. There is
 * no sub-shilling unit in daily use -- nobody at a genge has ever handled a cent
 * -- so integers are the natural representation, not a workaround.
 */

/** The only place TZS gets turned into text. */
export function formatTZS(
  amount: number,
  options: { symbol?: boolean; signed?: boolean } = {}
): string {
  const { symbol = false, signed = false } = options;
  const rounded = Math.round(amount || 0);
  const negative = rounded < 0;
  const digits = groupThousands(Math.abs(rounded));
  const sign = negative ? '-' : signed && rounded > 0 ? '+' : '';
  return `${sign}${symbol ? 'TSh ' : ''}${digits}`;
}

function groupThousands(value: number): string {
  const s = String(value);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

/**
 * Parses what someone actually types into an amount field: "12,500", "12 500",
 * "12500/=", "2.5k". Returns null when there is no number in there at all, so
 * callers can tell "empty" from "zero".
 */
export function parseTZS(input: string): number | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const thousands = /k$/.test(raw);
  const cleaned = raw
    .replace(/\/=$/, '')
    .replace(/k$/, '')
    .replace(/[,\s]/g, '')
    .replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(thousands ? value * 1000 : value);
}

/**
 * Splits an amount across n parts without losing or inventing a shilling.
 * Used when spreading a discount over lines.
 */
export function splitEvenly(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.trunc(amount / parts);
  const remainder = amount - base * parts;
  const sign = remainder < 0 ? -1 : 1;
  let left = Math.abs(remainder);
  return Array.from({ length: parts }, () => {
    const extra = left > 0 ? sign : 0;
    if (left > 0) left -= 1;
    return base + extra;
  });
}

/**
 * Apportions a total discount across line totals in proportion to each line,
 * with the rounding remainder pushed onto the largest line so the parts always
 * add back up to the discount exactly.
 */
export function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return splitEvenly(total, weights.length);
  const parts = weights.map((w) => Math.round((total * w) / sum));
  const drift = total - parts.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    let biggest = 0;
    for (let i = 1; i < weights.length; i++) {
      if ((weights[i] ?? 0) > (weights[biggest] ?? 0)) biggest = i;
    }
    parts[biggest] = (parts[biggest] ?? 0) + drift;
  }
  return parts;
}
