import { formatPhone, normalisePhone } from './auth/phone';
import { businessDay, daysBetween } from './date';
import type { Customer, Sale } from './types';

/**
 * The customer list behind "send an offer on WhatsApp". WhatsApp has no way to
 * send one message to many people from a link, so offers go out one tap per
 * customer (each message personalised), or the list is exported as contacts
 * for a WhatsApp Business broadcast list. Both need the same clean list.
 */

export interface CustomerStats {
  sales: number;
  spent: number;
  /** ISO time of the last purchase, or null. */
  lastAt: string | null;
}

export function statsByCustomer(sales: readonly Pick<Sale, 'customerId' | 'total' | 'status' | 'clientCreatedAt'>[]): Map<string, CustomerStats> {
  const out = new Map<string, CustomerStats>();
  for (const sale of sales) {
    if (!sale.customerId || sale.status !== 'complete') continue;
    const s = out.get(sale.customerId) ?? { sales: 0, spent: 0, lastAt: null };
    s.sales += 1;
    s.spent += sale.total;
    if (!s.lastAt || sale.clientCreatedAt > s.lastAt) s.lastAt = sale.clientCreatedAt;
    out.set(sale.customerId, s);
  }
  return out;
}

/**
 * Who gets an offer: someone who agreed to (opt-in, with the date recorded --
 * Tanzania's Personal Data Protection Act 2022 expects consent for marketing),
 * has not since said stop, and has a valid mobile number. Each number once.
 */
export function hasOfferConsent(c: Pick<Customer, 'offersConsentAt' | 'noOffers'>): boolean {
  return Boolean(c.offersConsentAt) && !c.noOffers;
}

export function offerRecipients<T extends Pick<Customer, 'id' | 'name' | 'phone' | 'noOffers' | 'deletedAt' | 'offersConsentAt'>>(
  customers: readonly T[]
): (T & { e164: string })[] {
  const seen = new Set<string>();
  const out: (T & { e164: string })[] = [];
  for (const customer of customers) {
    if (customer.deletedAt || !hasOfferConsent(customer)) continue;
    const e164 = customer.phone ? normalisePhone(customer.phone) : null;
    if (!e164 || seen.has(e164)) continue;
    seen.add(e164);
    out.push({ ...customer, e164 });
  }
  return out;
}

/** An existing customer with this phone number, however it was typed. */
export function findByPhone<T extends Pick<Customer, 'phone' | 'deletedAt'>>(customers: readonly T[], phone: string): T | null {
  const target = normalisePhone(phone);
  if (!target) return null;
  return customers.find((c) => !c.deletedAt && c.phone && normalisePhone(c.phone) === target) ?? null;
}

/** First name for "Habari Asha": the first word of the name. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

const vcardEscape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/**
 * Contacts file (.vcf). Importing it puts every customer in the phone's
 * contacts, which is what a WhatsApp Business broadcast list needs.
 */
export function toVCard(customers: readonly { name: string; e164: string }[], shopName: string): string {
  return customers
    .map((c) =>
      [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${vcardEscape(c.name)}`,
        `N:${vcardEscape(c.name)};;;;`,
        `TEL;TYPE=CELL:${c.e164}`,
        `NOTE:${vcardEscape(shopName)}`,
        'END:VCARD',
      ].join('\r\n')
    )
    .join('\r\n')
    .concat('\r\n');
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function toCsv(
  rows: readonly { name: string; phone: string | null | undefined; stats?: CustomerStats; noOffers?: boolean; offersConsentAt?: string | null }[]
): string {
  const header = ['name', 'phone', 'purchases', 'spent_tzs', 'last_purchase', 'offers_agreed_on'];
  const lines = rows.map((r) =>
    [
      r.name,
      r.phone ? formatPhone(normalisePhone(r.phone) ?? r.phone) : '',
      String(r.stats?.sales ?? 0),
      String(r.stats?.spent ?? 0),
      r.stats?.lastAt?.slice(0, 10) ?? '',
      r.offersConsentAt && !r.noOffers ? r.offersConsentAt.slice(0, 10) : '',
    ]
      .map(csvCell)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n') + '\n';
}

export type Audience = 'all' | 'recent' | 'away';

/** Recent: bought in the last 30 days. Away: bought before, but not in 30 days. */
export function inAudience(audience: Audience, lastAt: string | null | undefined, today: string): boolean {
  if (audience === 'all') return true;
  if (!lastAt) return false;
  const days = daysBetween(businessDay(lastAt), today);
  return audience === 'recent' ? days <= 30 : days > 30;
}
