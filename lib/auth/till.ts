import { setMeta } from '../local/db';
import type { Member } from '../types';
import { verifyPin, type PinHash } from './pin';
import { markUnlocked } from './unlock';
import { activeMemberKey } from './till-person';

export { activeMemberKey, personName } from './till-person';

/**
 * "Nani anauza?" -- who is at the till of a shared phone.
 *
 * Most small shops have one phone. Signing out and in with a phone number and
 * password every shift will not happen, so every sale would be credited to
 * whoever signed in that morning. Instead the phone stays signed in (as the
 * owner, usually) and each person takes the till with their own 4-digit PIN.
 * Sales and payments record that person; the screens follow their role.
 *
 * This is a lock on the till, not a server account: the phone's login still
 * decides what the server accepts. A cashier who needs their own phone gets
 * their own login (Wafanyakazi -> Pata namba).
 */


export function parsePin(member: Pick<Member, 'pinHash'>): PinHash | null {
  if (!member.pinHash) return null;
  try {
    return JSON.parse(member.pinHash) as PinHash;
  } catch {
    return null;
  }
}

/** Checks the PIN and, if right, makes this person the one at the till. */
export async function takeTill(member: Member, pin: string): Promise<boolean> {
  if (!(await verifyPin(pin, parsePin(member)))) return false;
  await setMeta(activeMemberKey(member.businessId), member.id);
  await markUnlocked();
  return true;
}

/** Back to the phone's own login (used when that person leaves the list). */
export async function releaseTill(businessId: string): Promise<void> {
  await setMeta(activeMemberKey(businessId), null);
}
