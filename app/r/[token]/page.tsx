import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LocalReceipt } from '@/components/receipt/local-receipt';
import { ReceiptView, type ReceiptData } from '@/components/receipt/receipt-view';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The link a customer gets on WhatsApp. It is read through a SECURITY DEFINER
 * function that takes the unguessable token and returns only that one receipt
 * -- the anon key can never list sales, only fetch the one it has a token for.
 */
async function fetchReceipt(token: string): Promise<ReceiptData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[a-z0-9]{8,64}$/.test(token)) return null;
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.rpc('public_receipt', { p_token: token });
  if (error || !data) return null;
  return data as ReceiptData;
}

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const receipt = await fetchReceipt(token);
  const t = await getTranslations('receipt');

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-paper px-4 py-8">
      {receipt ? (
        <ReceiptView receipt={receipt} />
      ) : (
        // Not on the server yet (not synced, or no backend): the seller's own
        // phone can still show it from the local store.
        <LocalReceipt token={token} notFound={t('notFound')} />
      )}
    </main>
  );
}
