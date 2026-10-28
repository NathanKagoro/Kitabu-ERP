'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { useSetLocale } from '@/components/locale-provider';
import { Button } from '@/components/ui/button';
import { withBase } from '@/lib/base-path';
import { businessDay } from '@/lib/date';
import { db, getMeta, META_KEYS, setDb, setMeta } from '@/lib/local/db';
import { setShowcase } from '@/lib/showcase';
import { uuidv7 } from '@/lib/uuid';

const SEEDED_ON = 'showcaseSeededOn';

/**
 * The demo link: open it and a hardware shop with two weeks of trading is
 * there, no sign-in. Everything stays in this browser (see lib/showcase.ts).
 * The shop is rebuilt when the link is opened on a new day, so "today" always
 * has sales in it. ?lang=en opens it in English.
 */
export default function DemoPage() {
  const t = useTranslations('demo');
  const setLocale = useSetLocale();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lang = new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'sw';
        await setLocale(lang);
        setShowcase(true);
        setDb(null);

        const fresh = (await getMeta(SEEDED_ON, null)) === businessDay() && (await getMeta(META_KEYS.activeBusinessId, null));
        if (!fresh) {
          await db().delete();
          setDb(null);
          const userId = uuidv7();
          await setMeta(META_KEYS.userId, userId);
          await setMeta('phone', '+255712000000');
          await setMeta(META_KEYS.mustSetPassword, false);
          await setMeta(META_KEYS.operator, false);
          const { createDemoBusiness } = await import('@/lib/demo');
          await createDemoBusiness(userId, 'Baraka Hardware', lang, 'hardware', {
            owner: 'Baraka',
            staff: [
              { name: 'Neema', role: 'manager' },
              { name: 'Juma', role: 'cashier' },
            ],
          });
          await setMeta(SEEDED_ON, businessDay());
        }
        // A full load, so every screen opens on the demo database.
        if (!cancelled) window.location.replace(withBase('/mauzo/'));
      } catch (error) {
        console.error(error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, setLocale]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper p-6 text-center">
      <Logo size={64} />
      {failed ? (
        <>
          <p className="font-semibold">{t('failed')}</p>
          <Button onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>{t('retry')}</Button>
        </>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-brand" />
          <p className="font-semibold">{t('opening')}</p>
          <p className="max-w-xs text-sm text-ink-soft">{t('openingHint')}</p>
        </>
      )}
    </div>
  );
}
