import type { Member } from '../types';

/*
 * The light half of the till switch: no PIN hashing, so the app shell and the
 * sales screen can read who is at the till without loading it.
 */

export const activeMemberKey = (businessId: string) => `activeMember:${businessId}`;

/** A display name for the till chip and reports. */
export function personName(member: Pick<Member, 'name' | 'phone'> | null | undefined, fallback: string): string {
  return member?.name?.trim() || member?.phone || fallback;
}
