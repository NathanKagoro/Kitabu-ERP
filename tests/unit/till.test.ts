import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hashPin } from '@/lib/auth/pin';
import { activeMemberKey, personName, releaseTill, takeTill } from '@/lib/auth/till';
import { db, getMeta, HesabuDB, setDb } from '@/lib/local/db';
import type { Member } from '@/lib/types';

const store = new Map<string, string>();
globalThis.sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

async function person(id: string, pin: string | null): Promise<Member> {
  const at = new Date().toISOString();
  return {
    id,
    businessId: 'shop',
    userId: null,
    name: id,
    phone: null,
    role: 'cashier',
    pinHash: pin ? JSON.stringify(await hashPin(pin)) : null,
    active: true,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };
}

beforeEach(() => {
  setDb(new HesabuDB(`till-${Math.random()}`));
  store.clear();
});
afterEach(async () => {
  await db().delete();
});

describe('who is selling (shared phone)', () => {
  it('the right PIN takes the till and unlocks the phone', async () => {
    const juma = await person('juma', '4821');
    expect(await takeTill(juma, '4821')).toBe(true);
    expect(await getMeta(activeMemberKey('shop'), null)).toBe('juma');
    expect(store.get('hesabu_unlocked')).toBe('1');
  });

  it('a wrong PIN changes nothing', async () => {
    const juma = await person('juma', '4821');
    const neema = await person('neema', '1111');
    await takeTill(neema, '1111');
    expect(await takeTill(juma, '0000')).toBe(false);
    expect(await getMeta(activeMemberKey('shop'), null)).toBe('neema');
  });

  it('someone without a PIN cannot take the till', async () => {
    expect(await takeTill(await person('asha', null), '')).toBe(false);
  });

  it('releasing goes back to the phone’s own login', async () => {
    await takeTill(await person('juma', '4821'), '4821');
    await releaseTill('shop');
    expect(await getMeta(activeMemberKey('shop'), null)).toBeNull();
  });

  it('names: name, else phone, else the fallback', () => {
    expect(personName({ name: ' Juma ', phone: null }, '?')).toBe('Juma');
    expect(personName({ name: '', phone: '+255712000000' }, '?')).toBe('+255712000000');
    expect(personName(null, '?')).toBe('?');
  });
});
