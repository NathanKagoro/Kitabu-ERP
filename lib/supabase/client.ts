import type { SupabaseClient } from '@supabase/supabase-js';

import { isShowcase } from '../showcase';

/**
 * Supabase is optional. With no keys configured the app still runs end to end
 * on the local Dexie store -- which is both a real deployment mode (a trader
 * with one phone and no account) and what makes `npm run dev` work with zero
 * setup.
 */
export function isSupabaseConfigured(): boolean {
  // The demo link never talks to the server, even on a connected build.
  if (isShowcase()) return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

let client: Promise<SupabaseClient> | null = null;

/**
 * Loaded on demand. The client library is ~70KB gzipped -- a third of the
 * sales screen's budget -- and selling never needs it: only the background
 * sync and sign-in do, so it stays out of the first load entirely.
 */
export async function supabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = import('@supabase/ssr').then(({ createBrowserClient }) =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    );
  }
  return client;
}
