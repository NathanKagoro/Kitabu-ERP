'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useState } from 'react';

import { LocalReceipt } from '@/components/receipt/local-receipt';
import { ReceiptView, type ReceiptData } from '@/components/receipt/receipt-view';
import { supabase } from '@/lib/supabase/client';

/**
 * The link a customer gets on WhatsApp: /r/?t=<token>. It is read through a
 * SECURITY DEFINER function that takes the unguessable token and returns only
 * that one receipt -- the anon key can never list sales, only fetch the one it
 * has a token for. Fetched in the browser, because the app is static files.
 */
async function fetchReceipt(token: string): Promise<ReceiptData | null> {
  if (!/^[a-z0-9]{8,64}$/.test(token)) return null;
  const client = await supabase();
  if (!client) return null;
  const { data, error } = await client.rpc('public_receipt', { p_token: token });
  if (error || !data) return null;
  return data as ReceiptData;
}

export default function ReceiptPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-md bg-paper px-4 py-8">
      <Suspense>
        <Receipt />
      </Suspense>
    </main>
  );
}

function Receipt() {
  const token = useSearchParams().get('t') ?? '';
  const t = useTranslations('receipt');
  const [receipt, setReceipt] = useState<ReceiptData | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    fetchReceipt(token)
      .catch(() => null)
      .then((found) => {
        if (live) setReceipt(found);
      });
    return () => {
      live = false;
    };
  }, [token]);

  if (receipt === undefined) {
    return <div className="mx-auto mt-16 h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-brand" />;
  }
  // Not on the server yet (not synced, or no backend): the seller's own phone
  // can still show it from the local store.
  return receipt ? <ReceiptView receipt={receipt} /> : <LocalReceipt token={token} notFound={t('notFound')} />;
}
