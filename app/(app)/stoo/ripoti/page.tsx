'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

import { useApp } from '@/components/app-provider';
import { CountReport } from '@/components/stock/count-report';
import { EmptyState, PageHeader } from '@/components/ui/bits';
import { db } from '@/lib/local/db';
import { useRefreshedCounts } from '@/lib/local/report-queries';

/** One stock-check report: /stoo/ripoti/?id=<count id>. */
export default function CountReportRoute() {
  return (
    <Suspense>
      <CountReportPage />
    </Suspense>
  );
}

function CountReportPage() {
  const t = useTranslations('stockCheck');
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  // Straight from setup day: the next stop is the till (or prices).
  const firstRun = params.get('anza') === '1';
  const { business, can } = useApp();
  // undefined while loading, null when there is no such count on this phone.
  const count = useLiveQuery(async () => (id ? ((await db().stockCounts.get(id)) ?? null) : null), [id]);
  const refreshed = useRefreshedCounts(business?.id ?? null, count ? [count] : undefined);

  return (
    <>
      <PageHeader title={t('reportTitle')} />
      {count === undefined ? null : count && count.businessId === business?.id ? (
        <>
          <CountReport
            count={count}
            shopName={business?.name ?? ''}
            lines={refreshed?.get(count.id)?.lines}
            corrected={refreshed?.get(count.id)?.corrected}
          />
          {firstRun ? (
            <div className="px-4 pb-6">
              <Link
                href="/bei?anza=1"
                className="flex h-14 w-full items-center justify-center rounded-[10px] border border-line-strong bg-surface text-lg font-semibold text-brand active:bg-paper"
              >
                {t('continueSetup')}
              </Link>
            </div>
          ) : can('countStock') && (
            <div className="px-4 pb-6">
              <Link
                href="/stoo/hesabu"
                className="flex h-12 w-full items-center justify-center rounded-[10px] border border-line-strong bg-surface font-semibold text-brand active:bg-paper"
              >
                {t('countAnother')}
              </Link>
            </div>
          )}
        </>
      ) : (
        <EmptyState title={t('notFound')} />
      )}
    </>
  );
}
