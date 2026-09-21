import { describe, expect, it } from 'vitest';

import { apportion, formatTZS, parseTZS, splitEvenly } from '@/lib/money';

describe('formatTZS', () => {
  it('groups thousands with commas', () => {
    expect(formatTZS(0)).toBe('0');
    expect(formatTZS(500)).toBe('500');
    expect(formatTZS(1500)).toBe('1,500');
    expect(formatTZS(1234567)).toBe('1,234,567');
  });

  it('handles negatives, symbol and explicit sign', () => {
    expect(formatTZS(-2500)).toBe('-2,500');
    expect(formatTZS(2500, { symbol: true })).toBe('TSh 2,500');
    expect(formatTZS(2500, { signed: true })).toBe('+2,500');
    expect(formatTZS(0, { signed: true })).toBe('0');
  });

  it('never prints fractions of a shilling', () => {
    expect(formatTZS(999.6)).toBe('1,000');
  });
});

describe('parseTZS', () => {
  it('reads the ways people type amounts', () => {
    expect(parseTZS('12500')).toBe(12500);
    expect(parseTZS('12,500')).toBe(12500);
    expect(parseTZS('12 500')).toBe(12500);
    expect(parseTZS('12,500/=')).toBe(12500);
    expect(parseTZS('2.5k')).toBe(2500);
  });

  it('distinguishes empty from zero', () => {
    expect(parseTZS('')).toBeNull();
    expect(parseTZS('   ')).toBeNull();
    expect(parseTZS('abc')).toBeNull();
    expect(parseTZS('0')).toBe(0);
  });
});

describe('splitEvenly / apportion', () => {
  it('never loses or invents a shilling', () => {
    const parts = splitEvenly(1000, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });

  it('apportions proportionally and sums exactly', () => {
    const parts = apportion(100, [1000, 2000, 3000]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([17, 33, 50]);
  });

  it('pushes rounding drift onto the largest weight', () => {
    const parts = apportion(10, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
  });
});
