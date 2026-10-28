/*
 * The demo link (/demo): a sample shop that opens with no sign-in.
 *
 * While it is on, this browser uses its own database ("hesabu-demo"), so a
 * real shop's records on the same phone are never touched, and Supabase is
 * switched off: nothing is sent anywhere. Leaving the demo turns it off and
 * the real data is there as before.
 *
 * Kept free of imports: the database and the Supabase client both ask it.
 */

const KEY = 'kitabu_showcase';
export const SHOWCASE_DB = 'hesabu-demo';

export function isShowcase(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setShowcase(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode with storage blocked: the demo still runs for this visit.
  }
}
