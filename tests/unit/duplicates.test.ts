import { describe, expect, it } from 'vitest';

import { findDuplicates, productKey } from '@/lib/products';

describe('bulk entry duplicates', () => {
  const p = (id: string, name: string, variant: string | null = null, active = true) => ({ id, name, variant, active, deletedAt: null });

  it('case, spaces and accents do not make a new product', () => {
    expect(productKey('  Lotion   NIVEA ')).toBe(productKey('lotion nivea'));
    expect(productKey('Café')).toBe(productKey('cafe'));
  });

  it('flags a product typed twice, pointing at the first row', () => {
    const found = findDuplicates([{ name: 'Sukari' }, { name: 'Mchele' }, { name: 'sukari ' }], [], false);
    expect([...found]).toEqual([[2, { kind: 'repeat', of: 0 }]]);
  });

  it('a different shade is a different product when shades are asked', () => {
    const rows = [
      { name: 'Lipstick', variant: 'Red' },
      { name: 'Lipstick', variant: 'Pink' },
      { name: 'lipstick', variant: 'red' },
    ];
    expect([...findDuplicates(rows, [], true)]).toEqual([[2, { kind: 'repeat', of: 0 }]]);
  });

  it('flags a product already in the shop, but not a removed one', () => {
    const found = findDuplicates(
      [{ name: 'Sukari' }, { name: 'Unga' }],
      [p('a', 'SUKARI'), p('b', 'Unga', null, false)],
      false
    );
    expect([...found]).toEqual([[0, { kind: 'exists', productId: 'a' }]]);
  });

  it('blank rows are ignored', () => {
    expect(findDuplicates([{ name: '' }, { name: '  ' }], [], false).size).toBe(0);
  });
});
