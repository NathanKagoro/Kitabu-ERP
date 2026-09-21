import { META_KEYS, setMeta } from '../local/db';

/*
 * The PIN gate's session flag, split out of session.ts so that the app shell
 * does not pull the whole sign-in module (OTP, invites) into every page load.
 */

const KEY = 'hesabu_unlocked';

export async function markUnlocked(): Promise<void> {
  await setMeta(META_KEYS.unlockedAt, Date.now());
  sessionStorage.setItem(KEY, '1');
}

export function isUnlockedThisSession(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(KEY) === '1';
}

export function clearUnlocked(): void {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(KEY);
}
