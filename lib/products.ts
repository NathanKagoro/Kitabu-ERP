import { parseTZS } from './money';
import type { Product } from './types';

/**
 * Products with shades and sizes. A variant is simply its own product row
 * ("Nivea Lotion" / "400ml", "Gauni la kitenge" / "M · Bluu") so stock, price
 * and profit per variant need nothing new: the ledger already works per row.
 * These helpers make the rows read and search as one family.
 */

/** "Nivea Lotion – 400ml": what appears on a sale line and a receipt. */
export function productLabel(product: Pick<Product, 'name' | 'variant'>): string {
  const variant = product.variant?.trim();
  return variant ? `${product.name} – ${variant}` : product.name;
}

/** Search by name, shade/size, category, barcode or code. */
export function matchesQuery(product: Pick<Product, 'name' | 'variant' | 'category' | 'barcode' | 'sku'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [product.name, product.variant, product.category, product.barcode, product.sku]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  // Every word must match somewhere: "nivea 400" finds "Nivea Lotion – 400ml".
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/** Categories in use, alphabetical, for filter chips and pickers. */
export function categoriesOf(products: readonly Pick<Product, 'category'>[]): string[] {
  const seen = new Map<string, string>();
  for (const p of products) {
    const name = p.category?.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Products grouped under their category, uncategorised last, families together. */
export function groupByCategory<T extends Pick<Product, 'category' | 'name' | 'variant'>>(products: readonly T[]): { category: string | null; items: T[] }[] {
  const groups = new Map<string, { category: string | null; items: T[] }>();
  for (const p of products) {
    const key = p.category?.trim().toLowerCase() ?? '';
    const group = groups.get(key) ?? { category: p.category?.trim() || null, items: [] };
    group.items.push(p);
    groups.set(key, group);
  }
  const sorted = [...groups.values()].sort((a, b) => {
    if (!a.category) return 1;
    if (!b.category) return -1;
    return a.category.localeCompare(b.category);
  });
  for (const group of sorted) {
    group.items.sort((a, b) => a.name.localeCompare(b.name) || (a.variant ?? '').localeCompare(b.variant ?? '', undefined, { numeric: true }));
  }
  return sorted;
}

/** One row of the setup-day bulk entry. Money in integer TZS, qty in selling units. */
export interface BulkRow {
  name: string;
  variant: string;
  category: string;
  price: number | null;
  cost: number | null;
  qty: number | null;
  /** What should be there (owner's estimate / delivery note), if known. */
  expected: number | null;
}

/**
 * Turns text pasted from a spreadsheet or typed in WhatsApp into rows:
 *
 *   name, shade/size, category, price, cost, quantity, expected
 *
 * Tabs (copied from Excel / Google Sheets), commas or semicolons all work.
 * Later columns may be left off. A header row is skipped. Numbers may carry
 * thousands separators or a "TSh" ("12,500" or "TSh 12 500").
 */
export function parseBulkText(text: string): BulkRow[] {
  const rows: BulkRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = splitCells(line);
    const [name = '', variant = '', category = '', price = '', cost = '', qty = '', expected = ''] = cells;
    if (!name) continue;
    if (rows.length === 0 && isHeader(name, price)) continue;
    rows.push({
      name,
      variant,
      category,
      price: money(price),
      cost: money(cost),
      qty: quantity(qty),
      expected: quantity(expected),
    });
  }
  return rows;
}

/**
 * Tabs win when present (a spreadsheet paste). Otherwise ; and , separate
 * cells -- except a comma between digits followed by exactly three digits,
 * which is a thousands separator ("12,500").
 */
function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((cell) => cell.trim());
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const thousands =
      ch === ',' && /\d/.test(line[i - 1] ?? '') && /^\d{3}(?!\d)/.test(line.slice(i + 1));
    if ((ch === ';' || ch === ',') && !thousands) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isHeader(name: string, price: string): boolean {
  return /^(jina|bidhaa|name|product|item)s?$/i.test(name) || /^(bei|price)$/i.test(price);
}

function money(cell: string): number | null {
  const cleaned = cell.replace(/tsh|tzs|\s/gi, '');
  if (!cleaned) return null;
  return parseTZS(cleaned);
}

function quantity(cell: string): number | null {
  const cleaned = cell.replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) / 1000 : null;
}
