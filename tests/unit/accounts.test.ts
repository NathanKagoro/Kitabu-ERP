import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CODE_ALPHABET,
  formatSetupCode,
  isAcceptablePassword,
  loginEmail,
  makeSetupCode,
  normaliseSetupCode,
  phoneDigits,
} from '@/lib/auth/login';
import { MODE_FOR_TYPE as APP_MODES } from '@/lib/modes';
import { cleanSettingsPatch, mayIssueCode, MODE_FOR_TYPE, parseShopInput } from '@/supabase/functions/accounts/rules';

describe('phone number -> login', () => {
  it('every way of writing a number is the same login', () => {
    for (const written of ['0712 345 678', '+255 712 345 678', '255712345678', '712345678', '0712-345-678']) {
      expect(loginEmail(written)).toBe('255712345678@phone.kitabu.app');
    }
  });

  it('refuses numbers that are not Tanzanian mobiles', () => {
    expect(phoneDigits('0212345678')).toBeNull();
    expect(phoneDigits('071234567')).toBeNull();
    expect(loginEmail('')).toBeNull();
  });
});

describe('setup codes', () => {
  const random = (seed: number) => {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (seed * 31 + i * 97) % 256;
    return bytes;
  };

  it('are 8 characters from the unambiguous alphabet', () => {
    for (let seed = 0; seed < 200; seed++) {
      const code = makeSetupCode(random(seed));
      expect(code).toHaveLength(8);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it('never contain characters that are easy to misread', () => {
    for (const ch of '0O1IL5S') expect(CODE_ALPHABET).not.toContain(ch);
  });

  it('skip bytes that would bias the alphabet', () => {
    const bytes = new Uint8Array(32).fill(250); // all above the cut-off
    bytes.set([0, 1, 2, 3, 4, 5, 6, 7], 20);
    expect(makeSetupCode(bytes)).toBe('ABCDEFGH');
    expect(() => makeSetupCode(new Uint8Array(32).fill(255))).toThrow();
  });

  it('are accepted however they are typed', () => {
    expect(normaliseSetupCode('abcd-efgh')).toBe('ABCDEFGH');
    expect(normaliseSetupCode(' ABCD EFGH ')).toBe('ABCDEFGH');
    expect(normaliseSetupCode('ABCD-EFG')).toBeNull();
    expect(normaliseSetupCode('ABCD-EFG0')).toBeNull();
    expect(formatSetupCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });

  it('a chosen password must be at least 6 characters', () => {
    expect(isAcceptablePassword('12345')).toBe(false);
    expect(isAcceptablePassword('      ')).toBe(false);
    expect(isAcceptablePassword('mama2026')).toBe(true);
  });
});

describe('who may issue a setup code', () => {
  const owner = { userId: 'o', isOperator: false, roleThere: 'owner' as const };
  const cashierCaller = { userId: 'c', isOperator: false, roleThere: 'cashier' as const };
  const operator = { userId: 'x', isOperator: true, roleThere: null };

  it('the operator, for anyone', () => {
    expect(mayIssueCode(operator, { userId: 'o', role: 'owner', active: true })).toBe(true);
  });

  it('an owner, for their own staff only', () => {
    expect(mayIssueCode(owner, { userId: null, role: 'cashier', active: true })).toBe(true);
    expect(mayIssueCode(owner, { userId: 'm', role: 'manager', active: true })).toBe(true);
    expect(mayIssueCode(owner, { userId: 'o2', role: 'owner', active: true })).toBe(false);
    expect(mayIssueCode({ ...owner, roleThere: null }, { userId: null, role: 'cashier', active: true })).toBe(false);
  });

  it('not staff, not for removed people, not for yourself', () => {
    expect(mayIssueCode(cashierCaller, { userId: null, role: 'cashier', active: true })).toBe(false);
    expect(mayIssueCode(owner, { userId: null, role: 'cashier', active: false })).toBe(false);
    expect(mayIssueCode({ ...owner, roleThere: 'owner' }, { userId: 'o', role: 'manager', active: true })).toBe(false);
  });
});

describe('the operator’s new-shop form', () => {
  it('accepts a complete form and cleans it', () => {
    expect(parseShopInput({ name: '  Neema Cosmetics ', type: 'cosmetics', ownerPhone: '0712345678', brandColor: '#b0225f' })).toEqual({
      name: 'Neema Cosmetics',
      type: 'cosmetics',
      ownerName: null,
      ownerPhone: '0712345678',
      locale: 'sw',
      brandColor: '#b0225f',
    });
  });

  it('refuses a missing name, an unknown type or no phone', () => {
    expect(parseShopInput({ name: 'x', type: 'cosmetics', ownerPhone: '0712345678' })).toEqual({ error: 'badName' });
    expect(parseShopInput({ name: 'Duka', type: 'bakery', ownerPhone: '0712345678' })).toEqual({ error: 'badType' });
    expect(parseShopInput({ name: 'Duka', type: 'duka' })).toEqual({ error: 'badPhone' });
  });

  it('only lets a real colour through to settings', () => {
    expect(cleanSettingsPatch({ brandColor: '#123abc', vatRate: 0 })).toEqual({ brandColor: '#123abc' });
    expect(cleanSettingsPatch({ brandColor: 'red' })).toEqual({});
  });
});

describe('the function and the app agree', () => {
  it('on shop type -> mode', () => {
    expect(MODE_FOR_TYPE).toEqual(APP_MODES);
  });

  it('on login rules: the shared copy is identical to lib/auth/login.ts', () => {
    const app = readFileSync(join(process.cwd(), 'lib/auth/login.ts'), 'utf8');
    const fn = readFileSync(join(process.cwd(), 'supabase/functions/_shared/login.ts'), 'utf8');
    expect(fn).toBe(app);
  });
});
