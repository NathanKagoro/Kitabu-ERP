'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { useApp } from '@/components/app-provider';
import { ChevronRight, Package } from '@/components/icons';
import { Badge, EmptyState, Money, PageHeader } from '@/components/ui/bits';
import { RECOUNT_AFTER_DAYS } from '@/lib/calc/stock-count';
import { businessDay, daysBetween } from '@/lib/date';
import { useStockCounts } from '@/lib/local/queries';
import { formatQty } from '@/lib/units';

/**
 * Hesabu ya stoo: when the shop was last counted, a button to count now, and
 * every past check with what went missing. The history is the second-visit
 * pitch: "two weeks ago we set you up; today 12 items are missing".
 */
export default function StockCheckPage() {
  const t = useTranslations('stockCheck');
  const te = useTranslations('errors');
  const locale = useLocale();
  const { businessId, can, show } = useApp();
  const counts = useStockCounts(businessId);

  if (!show('stockTracking')) {
    return (
      <>
        <PageHeader title={t('title')} />
        <EmptyState title={te('noAccess')} />
      </>
    );
  }

  const today = businessDay();
  const last = counts?.[0];
  const sinceLast = last ? daysBetween(businessDay(last.clientCreatedAt), today) : null;
  const due = sinceLast === null || sinceLast >= RECOUNT_AFTER_DAYS;
  const dateText = (at: string) =>
    new Date(at).toLocaleDateString(locale === 'sw' ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="space-y-3 p-4">
        <section className={due ? 'card space-y-1 border-debt/50 bg-debt-tint p-4' : 'card space-y-1 p-4'}>
          <p className="font-bold">
            {sinceLast === null ? t('neverCounted') : t('lastCounted', { days: sinceLast })}
          </p>
          <p className="text-sm text-ink-soft">{due ? t('dueHint', { days: RECOUNT_AFTER_DAYS }) : t('notDueHint')}</p>
        </section>
        {can('countStock') && (
          <Link
            href="/stoo/hesabu"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-brand text-lg font-semibold text-white active:bg-brand-dark"
          >
            <Package size={22} />
            {t('startCount')}
          </Link>
        )}
      </div>

      {counts && counts.length === 0 ? <EmptyState title={t('noHistory')} body={t('noHistoryBody')} /> : null}

      {counts && counts.length > 0 && (
        <section>
          <h2 className="px-4 pb-1 text-sm font-bold text-ink-soft">{t('history')}</h2>
          <ul className="divide-y divide-line border-y border-line bg-surface">
            {counts.map((count) => {
              const lead = count.valueShortCost > 0 ? count.valueShortCost : count.valueShortPrice;
              return (
                <li key={count.id}>
                  <Link href={`/stoo/ripoti?id=${count.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-paper">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {dateText(count.clientCreatedAt)}
                        {count.scope ? <span className="font-normal text-ink-soft"> · {count.scope}</span> : null}
                      </span>
                      <span className="text-sm text-ink-faint">
                        {count.kind === 'opening' ? `${t('openingLead')} · ` : ''}
                        {t('itemsCounted', { count: count.itemsCounted })}
                      </span>
                    </span>
                    {count.linesShort > 0 ? (
                      <span className="text-right">
                        <span className="block text-sm font-semibold text-loss">
                          {t('missing', { qty: formatQty(count.unitsShort) })}
                        </span>
                        <Money value={lead} symbol className="font-bold text-loss" />
                      </span>
                    ) : (
                      <Badge tone="brand">{t('matches')}</Badge>
                    )}
                    <ChevronRight size={20} className="shrink-0 text-ink-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
