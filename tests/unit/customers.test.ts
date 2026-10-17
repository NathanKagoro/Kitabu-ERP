import { describe, expect, it } from 'vitest';

import { findByPhone, firstName, inAudience, offerRecipients, statsByCustomer, toCsv, toVCard } from '@/lib/customers';

const c = (id: string, name: string, phone: string | null, over: Record<string, unknown> = {}) => ({
  id,
  name,
  phone,
  noOffers: false,
  deletedAt: null,
  ...over,
});

describe('who gets an offer', () => {
  it('valid numbers only, each person once, never someone who said no', () => {
    const list = offerRecipients([
      c('1', 'Asha', '0712 345 678'),
      c('2', 'Asha (again)', '+255712345678'),
      c('3', 'Neema', '0754000111', { noOffers: true }),
      c('4', 'No phone', null),
      c('5', 'Bad', '12345'),
      c('6', 'Gone', '0655000222', { deletedAt: '2026-10-01' }),
      c('7', 'Juma', '0655000333'),
    ]);
    expect(list.map((x) => [x.id, x.e164])).toEqual([
      ['1', '+255712345678'],
      ['7', '+255655000333'],
    ]);
  });

  it('finds an existing customer by number however it was typed', () => {
    const all = [c('1', 'Asha', '0712 345 678')];
    expect(findByPhone(all, '255712345678')?.id).toBe('1');
    expect(findByPhone(all, '0712000000')).toBeNull();
  });

  it('greets by first name', () => {
    expect(firstName('  Mama Asha Juma ')).toBe('Mama');
  });
});

describe('what each customer bought', () => {
  it('counts completed sales only, and the latest date', () => {
    const stats = statsByCustomer([
      { customerId: 'a', total: 8000, status: 'complete', clientCreatedAt: '2026-10-01T10:00:00Z' },
      { customerId: 'a', total: 12500, status: 'complete', clientCreatedAt: '2026-10-09T10:00:00Z' },
      { customerId: 'a', total: 99999, status: 'void', clientCreatedAt: '2026-10-10T10:00:00Z' },
      { customerId: null, total: 500, status: 'complete', clientCreatedAt: '2026-10-10T10:00:00Z' },
    ]);
    expect(stats.get('a')).toEqual({ sales: 2, spent: 20500, lastAt: '2026-10-09T10:00:00Z' });
    expect(stats.size).toBe(1);
  });
});

describe('exports', () => {
  it('a contacts file the phone can import', () => {
    const vcf = toVCard([{ name: 'Asha, Sinza', e164: '+255712345678' }], 'Neema Cosmetics');
    expect(vcf).toContain('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Asha\\, Sinza');
    expect(vcf).toContain('TEL;TYPE=CELL:+255712345678');
    expect(vcf.trim().endsWith('END:VCARD')).toBe(true);
  });

  it('a spreadsheet, with awkward names quoted', () => {
    const csv = toCsv([{ name: 'Asha "Mama" J', phone: '0712345678', stats: { sales: 2, spent: 20500, lastAt: '2026-10-09T10:00:00Z' } }]);
    expect(csv.split('\n')[1]).toBe('"Asha ""Mama"" J",0712 345 678,2,20500,2026-10-09,');
  });
});

describe('audiences', () => {
  it('recent is the last 30 days; away bought before that; never-bought is in neither', () => {
    expect(inAudience('recent', '2026-10-01T10:00:00Z', '2026-10-17')).toBe(true);
    expect(inAudience('away', '2026-09-01T10:00:00Z', '2026-10-17')).toBe(true);
    expect(inAudience('recent', '2026-09-01T10:00:00Z', '2026-10-17')).toBe(false);
    expect(inAudience('away', null, '2026-10-17')).toBe(false);
    expect(inAudience('all', null, '2026-10-17')).toBe(true);
  });
});
