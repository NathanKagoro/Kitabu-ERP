import { CloudOff } from '@/components/icons';
import Link from 'next/link';

import { Logo } from '@/components/brand/logo';
import { getTranslations } from 'next-intl/server';

/** Served by the service worker for a page that was never cached. */
export default async function OfflinePage() {
  const t = await getTranslations('sync');
  const tn = await getTranslations('nav');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={56} />
      <CloudOff size={40} className="text-ink-faint" />
      <p className="max-w-xs text-lg font-semibold">{t('offlineSafe')}</p>
      <Link href="/mauzo" className="flex h-14 items-center rounded-[10px] bg-brand px-6 text-lg font-semibold text-white">
        {tn('sales')}
      </Link>
    </main>
  );
}
