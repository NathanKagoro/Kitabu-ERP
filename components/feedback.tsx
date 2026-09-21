'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { useApp } from '@/components/app-provider';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { getMeta, setMeta } from '@/lib/local/db';
import { supabase } from '@/lib/supabase/client';
import { uuidv7 } from '@/lib/uuid';

/**
 * "Tuma maoni". Feedback is the one write that is allowed to be lossy-tolerant,
 * but it still should not vanish: without a connection it waits on the device
 * and goes with the next successful send.
 */
export function FeedbackButton({ icon }: { icon: ReactNode }) {
  const t = useTranslations('feedback');
  const toast = useToast();
  const { businessId, userId } = useApp();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const send = async () => {
    const row = {
      id: uuidv7(),
      business_id: businessId,
      user_id: userId,
      message: message.trim(),
      context: { path: window.location.pathname, ua: navigator.userAgent, at: new Date().toISOString() },
    };
    const queued = await getMeta<(typeof row)[]>('feedback:queue', []);
    const all = [...queued, row];
    const client = await supabase();
    if (client && navigator.onLine) {
      const { error } = await client.from('feedback').upsert(all, { onConflict: 'id' });
      await setMeta('feedback:queue', error ? all : []);
    } else {
      await setMeta('feedback:queue', all);
    }
    toast(t('thanks'));
    setMessage('');
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="card flex min-h-14 w-full items-center gap-3 px-4 text-left font-semibold active:bg-paper">
        <span className="text-brand">{icon}</span>
        {t('title')}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('title')}>
        <div className="space-y-3 p-4">
          <p className="text-ink-soft">{t('prompt')}</p>
          <TextArea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('placeholder')} rows={5} />
          <Button size="lg" block disabled={!message.trim()} onClick={() => void send()}>
            {t('send')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
