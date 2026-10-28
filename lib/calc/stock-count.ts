/**
 * The stock check: what the records say should be on the shelf, against what
 * was counted. This is the number the pitch leads with -- "12 items missing,
 * worth TZS 85,000" -- so it is pure, rounded once, and unit-tested.
 *
 * "Expected" comes from the stock ledger on a normal count. On a shop's first
 * day there is no ledger yet, so it comes from the owner's estimate or the
 * last delivery note instead (kind 'opening').
 */

export interface CountLine {
  productId: string;
  /** Snapshot of the label at count time, so old reports read back unchanged. */
  name: string;
  expected: number;
  counted: number;
  /** Average cost per unit when counted (integer TZS), or null if unknown. */
  unitCost: number | null;
  /** Selling price per unit when counted (integer TZS). */
  unitPrice: number;
  /** When this line was counted (ISO). */
  countedAt?: string;
}

export interface CountSummary {
  itemsCounted: number;
  /** Product lines with fewer on the shelf than expected. */
  linesShort: number;
  /** Total units missing across those lines. */
  unitsShort: number;
  /** What the missing stock cost the shop. Lines with no known cost add nothing here. */
  valueShortCost: number;
  /** What it would have sold for. */
  valueShortPrice: number;
  /** Lines with no known cost among the short ones, so the report can say so. */
  shortWithoutCost: number;
  linesOver: number;
  unitsOver: number;
  valueOverCost: number;
}

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** Negative: missing. Positive: more than the records say. */
export function lineDifference(line: Pick<CountLine, 'expected' | 'counted'>): number {
  return round3(line.counted - line.expected);
}

export function summariseCount(lines: readonly CountLine[]): CountSummary {
  const summary: CountSummary = {
    itemsCounted: lines.length,
    linesShort: 0,
    unitsShort: 0,
    valueShortCost: 0,
    valueShortPrice: 0,
    shortWithoutCost: 0,
    linesOver: 0,
    unitsOver: 0,
    valueOverCost: 0,
  };
  let shortCost = 0;
  let shortPrice = 0;
  let overCost = 0;

  for (const line of lines) {
    const diff = lineDifference(line);
    if (diff < 0) {
      const missing = -diff;
      summary.linesShort += 1;
      summary.unitsShort += missing;
      if (line.unitCost != null && line.unitCost > 0) shortCost += missing * line.unitCost;
      else summary.shortWithoutCost += 1;
      shortPrice += missing * Math.max(0, line.unitPrice);
    } else if (diff > 0) {
      summary.linesOver += 1;
      summary.unitsOver += diff;
      if (line.unitCost != null && line.unitCost > 0) overCost += diff * line.unitCost;
    }
  }

  summary.unitsShort = round3(summary.unitsShort);
  summary.unitsOver = round3(summary.unitsOver);
  summary.valueShortCost = Math.round(shortCost);
  summary.valueShortPrice = Math.round(shortPrice);
  summary.valueOverCost = Math.round(overCost);
  return summary;
}

/** The short lines, worst first by what they cost the shop. */
export function shortLines(lines: readonly CountLine[]): (CountLine & { missing: number; lostCost: number })[] {
  return lines
    .map((line) => {
      const missing = Math.max(0, -lineDifference(line));
      return { ...line, missing, lostCost: Math.round(missing * (line.unitCost ?? line.unitPrice ?? 0)) };
    })
    .filter((line) => line.missing > 0)
    .sort((a, b) => b.lostCost - a.lostCost || b.missing - a.missing);
}

/**
 * The days since a count, for "last checked 9 days ago" and the two-week
 * nudge. Calendar days in Dar es Salaam, not 24-hour blocks.
 */
export const RECOUNT_AFTER_DAYS = 14;

/**
 * The count's lines with "expected" worked out again from the ledger as it is
 * now. A sale made on another phone before the shelf was counted, but synced
 * after, was missing from the expected figure on the day -- so the report said
 * "2 missing" for two lotions that were sold. Recomputing as of each line's
 * counted moment turns that into what it was: sold, not lost.
 *
 * `movements` are this business's movements for the counted products; the
 * count's own reset movements (refId = countId) are left out.
 */
export function refreshCountLines<
  M extends { id: string; productId: string; qty: number; createdAt: string; refId?: string | null; setsQty?: number | null },
>(
  lines: readonly CountLine[],
  movements: readonly M[],
  countId: string,
  countedAtFallback: string,
  stockAsOf: (ledger: readonly M[], at: string) => number
): { lines: CountLine[]; corrected: number } {
  const byProduct = new Map<string, M[]>();
  for (const m of movements) {
    if (m.refId === countId) continue;
    const list = byProduct.get(m.productId);
    if (list) list.push(m);
    else byProduct.set(m.productId, [m]);
  }
  let corrected = 0;
  const refreshed = lines.map((line) => {
    const ledger = byProduct.get(line.productId);
    if (!ledger) return line;
    const expected = Math.max(0, stockAsOf(ledger, line.countedAt ?? countedAtFallback));
    if (Math.abs(expected - line.expected) < 0.0005) return line;
    corrected += 1;
    return { ...line, expected };
  });
  return { lines: refreshed, corrected };
}
