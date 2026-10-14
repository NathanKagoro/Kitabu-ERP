import { formatTZS } from './money';
import { formatQty } from './units';
import { whatsappNumber } from './auth/phone';
import { BASE_PATH } from './base-path';

export interface ReceiptLine {
  description: string;
  qty: number;
  lineTotal: number;
}

/** Short enough to read on a lock screen, and useful without opening the link. */
export function receiptItemsText(lines: readonly ReceiptLine[]): string {
  return lines
    .map((line) => `• ${line.description} x${formatQty(line.qty)} — ${formatTZS(line.lineTotal)}`)
    .join('\n');
}

/** origin + base path, e.g. https://nathankagoro.github.io/Kitabu-ERP */
export function receiptUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}${BASE_PATH}/r/?t=${token}`;
}

/**
 * wa.me with no number opens WhatsApp's contact picker, which is exactly right
 * when the customer is standing there and the seller just needs to pick them.
 */
export function whatsappLink(text: string, phone?: string | null): string {
  const number = phone ? whatsappNumber(phone) : null;
  const base = number ? `https://wa.me/${number}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** Fills {name}-style placeholders in an owner-editable template. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
