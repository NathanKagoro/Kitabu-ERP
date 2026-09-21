import { describe, expect, it } from 'vitest';

import { formatPhone, normalisePhone, whatsappNumber } from '@/lib/auth/phone';
import { addDays, businessDay, dayBounds, daysBetween, recentDays } from '@/lib/date';
import { toCsv } from '@/lib/export';
import { hasFeature, roleCan } from '@/lib/modes';
import { cartReducer, EMPTY_CART } from '@/lib/pos/cart';
import { fillTemplate, receiptItemsText, whatsappLink } from '@/lib/receipt';
import type { Product } from '@/lib/types';
import { allowsDecimals, formatQty, normaliseQty } from '@/lib/units';
import { receiptToken, uuidv7, uuidv7Time } from '@/lib/uuid';

describe('uuidv7', () => {
  it('is a valid v7 uuid carrying its timestamp', () => {
    const id = uuidv7(1_700_000_000_000);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidv7Time(id)).toBe(1_700_000_000_000);
  });

  it('sorts in creation order, even within one millisecond', () => {
    const ids = Array.from({ length: 200 }, () => uuidv7(1_700_000_000_123));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(200);
  });

  it('receipt tokens are long and unambiguous', () => {
    expect(receiptToken()).toMatch(/^[a-km-z2-9]{12}$/);
  });
});

describe('phone numbers', () => {
  it('normalises the ways people write a Tanzanian mobile number', () => {
    for (const input of ['0712 345 678', '+255 712 345 678', '255712345678', '712345678', '0712-345-678']) {
      expect(normalisePhone(input)).toBe('+255712345678');
    }
  });

  it('rejects landlines and wrong lengths', () => {
    expect(normalisePhone('0222 123 456')).toBeNull();
    expect(normalisePhone('07123')).toBeNull();
    expect(normalisePhone('')).toBeNull();
  });

  it('formats for display and for wa.me', () => {
    expect(formatPhone('+255712345678')).toBe('0712 345 678');
    expect(whatsappNumber('0712 345 678')).toBe('255712345678');
  });
});

describe('business day (UTC+3)', () => {
  it('files a 1:30am sale under the right day regardless of device timezone', () => {
    expect(businessDay('2026-03-09T22:30:00Z')).toBe('2026-03-10');
    expect(businessDay('2026-03-09T20:59:59Z')).toBe('2026-03-09');
  });

  it('day bounds start at local midnight', () => {
    expect(dayBounds('2026-03-10')).toEqual({
      start: '2026-03-09T21:00:00.000Z',
      end: '2026-03-10T21:00:00.000Z',
    });
  });

  it('day arithmetic', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7);
    expect(recentDays(3, '2026-03-10')).toEqual(['2026-03-08', '2026-03-09', '2026-03-10']);
  });
});

describe('units', () => {
  it('allows fractions only where they make sense', () => {
    expect(allowsDecimals('kg')).toBe(true);
    expect(allowsDecimals('fungu')).toBe(false);
    expect(normaliseQty(2.6, 'fungu')).toBe(3);
    expect(normaliseQty(1.2345, 'kg')).toBe(1.235);
    expect(formatQty(2)).toBe('2');
    expect(formatQty(0.5)).toBe('0.5');
  });
});

describe('receipts and reminders', () => {
  it('builds a short text receipt and a wa.me link', () => {
    expect(receiptItemsText([{ description: 'Nyanya', qty: 2, lineTotal: 2000 }])).toBe('• Nyanya x2 — 2,000');
    expect(whatsappLink('Habari', '0712345678')).toBe('https://wa.me/255712345678?text=Habari');
    expect(whatsappLink('a b')).toBe('https://wa.me/?text=a%20b');
  });

  it('fills an owner-edited template and leaves unknown placeholders alone', () => {
    expect(fillTemplate('Habari {name}, deni {balance} {x}', { name: 'Asha', balance: '5,000' })).toBe(
      'Habari Asha, deni 5,000 {x}'
    );
  });
});

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', null, 5]])).toBe('a,"b,c","say ""hi""",,5');
  });
});

describe('modes and roles', () => {
  it('genge hides formal features; biashara hides amount-only sales', () => {
    expect(hasFeature('genge', 'documents')).toBe(false);
    expect(hasFeature('genge', 'quickAmountSale')).toBe(true);
    expect(hasFeature('biashara', 'quickAmountSale')).toBe(false);
    expect(hasFeature('biashara', 'vat')).toBe(true);
  });

  it('cashiers can sell but not void or see profit', () => {
    expect(roleCan('cashier', 'sell')).toBe(true);
    expect(roleCan('cashier', 'voidSale')).toBe(false);
    expect(roleCan('cashier', 'viewProfit')).toBe(false);
    expect(roleCan('manager', 'voidSale')).toBe(true);
    expect(roleCan('manager', 'manageStaff')).toBe(false);
    expect(roleCan('manager', 'closeDay')).toBe(true);
    expect(roleCan('cashier', 'closeDay')).toBe(false);
  });
});

describe('cart', () => {
  const product = { id: 'p', name: 'Nyanya', price: 1000, cost: 600, vatType: 'standard' } as Product;

  it('two taps on a tile is one line of 2', () => {
    let state = cartReducer(EMPTY_CART, { type: 'add', product });
    state = cartReducer(state, { type: 'add', product });
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]?.qty).toBe(2);
  });

  it('a bargained line is not merged with list-price taps', () => {
    let state = cartReducer(EMPTY_CART, { type: 'add', product, lineId: 'a' });
    state = cartReducer(state, { type: 'setPrice', lineId: 'a', unitPrice: 800 });
    state = cartReducer(state, { type: 'add', product });
    expect(state.lines).toHaveLength(2);
  });

  it('setting qty to zero removes the line, and the discount with the last line', () => {
    let state = cartReducer(EMPTY_CART, { type: 'add', product, lineId: 'a' });
    state = cartReducer(state, { type: 'setDiscount', discount: 100 });
    state = cartReducer(state, { type: 'setQty', lineId: 'a', qty: 0 });
    expect(state).toEqual({ lines: [], discount: 0 });
  });
});

describe('cn', () => {
  it('lets a later utility override an earlier one of the same kind', async () => {
    const { cn } = await import('@/lib/cn');
    expect(cn('h-14 px-5 text-lg', 'h-12 px-3')).toBe('text-lg h-12 px-3');
    expect(cn('bg-brand text-white', false && 'x', 'bg-loss')).toBe('text-white bg-loss');
  });

  it('keeps text size, colour and alignment apart', async () => {
    const { cn } = await import('@/lib/cn');
    expect(cn('text-lg text-ink text-left', 'text-loss')).toBe('text-lg text-left text-loss');
    expect(cn('text-[15px]', 'text-2xl')).toBe('text-2xl');
  });

  it('keeps border width apart from border colour, and flex parts apart', async () => {
    const { cn } = await import('@/lib/cn');
    expect(cn('border border-line', 'border-brand')).toBe('border border-brand');
    expect(cn('flex flex-1 flex-col', 'flex-row')).toBe('flex flex-1 flex-row');
  });

  it('scopes conflicts by variant', async () => {
    const { cn } = await import('@/lib/cn');
    expect(cn('bg-brand active:bg-brand-dark', 'active:bg-paper')).toBe('bg-brand active:bg-paper');
    expect(cn('-mt-3', 'mt-6')).toBe('mt-6');
  });
});
