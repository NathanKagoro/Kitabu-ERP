import { describe, expect, it } from 'vitest';

import { categoriesOf, groupByCategory, matchesQuery, parseBulkText, productLabel } from '@/lib/products';

const p = (name: string, variant: string | null = null, category: string | null = null) => ({
  name,
  variant,
  category,
  barcode: null,
  sku: null,
});

describe('a product family reads as one', () => {
  it('the label carries the shade or size', () => {
    expect(productLabel(p('Nivea Lotion', '400ml'))).toBe('Nivea Lotion – 400ml');
    expect(productLabel(p('Sukari', '  '))).toBe('Sukari');
    expect(productLabel(p('Sukari'))).toBe('Sukari');
  });

  it('search matches every word, across name, variant and category', () => {
    const lotion = { ...p('Nivea Lotion', '400ml', 'Losheni'), barcode: '6001234' };
    expect(matchesQuery(lotion, 'nivea 400')).toBe(true);
    expect(matchesQuery(lotion, 'losheni')).toBe(true);
    expect(matchesQuery(lotion, '6001234')).toBe(true);
    expect(matchesQuery(lotion, 'nivea 200')).toBe(false);
    expect(matchesQuery(lotion, '  ')).toBe(true);
  });

  it('categories are listed once, whatever their case', () => {
    expect(categoriesOf([p('a', null, 'Nywele'), p('b', null, 'nywele'), p('c', null, 'Losheni'), p('d')])).toEqual([
      'Losheni',
      'Nywele',
    ]);
  });

  it('groups by category, uncategorised last, sizes in natural order', () => {
    const groups = groupByCategory([
      p('Gauni', 'Size 12', 'Magauni'),
      p('Gauni', 'Size 8', 'Magauni'),
      p('Mkoba'),
      p('Viatu', '40', 'Viatu'),
    ]);
    expect(groups.map((g) => g.category)).toEqual(['Magauni', 'Viatu', null]);
    expect(groups[0]!.items.map((i) => i.variant)).toEqual(['Size 8', 'Size 12']);
  });
});

describe('bulk entry from a paste', () => {
  it('reads a spreadsheet paste (tabs), skipping the header', () => {
    const rows = parseBulkText('Jina\tRangi/Saizi\tKundi\tBei\tGharama\tIdadi\nNivea Lotion\t400ml\tLosheni\t12,500\t9,000\t6\n');
    expect(rows).toEqual([{ name: 'Nivea Lotion', variant: '400ml', category: 'Losheni', price: 12500, cost: 9000, qty: 6 }]);
  });

  it('reads commas and semicolons, keeping "12,500" whole', () => {
    expect(parseBulkText('Lipstick, Red 01, Make-up, 8,000, 5,500, 12')).toEqual([
      { name: 'Lipstick', variant: 'Red 01', category: 'Make-up', price: 8000, cost: 5500, qty: 12 },
    ]);
    expect(parseBulkText('Rangi ya ukuta;20L;Rangi;TSh 85 000;;3')).toEqual([
      { name: 'Rangi ya ukuta', variant: '20L', category: 'Rangi', price: 85000, cost: null, qty: 3 },
    ]);
  });

  it('later columns are optional; blank lines are ignored', () => {
    expect(parseBulkText('\nSabuni ya Geisha\n\nOmo,1kg\n')).toEqual([
      { name: 'Sabuni ya Geisha', variant: '', category: '', price: null, cost: null, qty: null },
      { name: 'Omo', variant: '1kg', category: '', price: null, cost: null, qty: null },
    ]);
  });

  it('a quantity can be a fraction (kg, metres)', () => {
    expect(parseBulkText('Waya,2.5mm,Umeme,1500,,12,5')[0]!.qty).toBe(12);
    expect(parseBulkText('Waya\t2.5mm\tUmeme\t1500\t\t12,5')[0]!.qty).toBe(12.5);
  });
});
