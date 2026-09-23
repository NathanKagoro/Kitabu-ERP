'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { TriangleAlert } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Badge, EmptyState, Money, PageHeader, Row } from '@/components/ui/bits';
import { cn } from '@/lib/cn';
import { productProfitability, totalsOf } from '@/lib/calc/profit';
import { addDays, businessDay } from '@/lib/date';
import { db } from '@/lib/local/db';
import { loadRange } from '@/lib/local/queries';
import { formatTZS } from '@/lib/money';
import { formatQty } from '@/lib/units';

/**
 * Which products actually earn. A daily total says whether today was good;
 * this says whether a product is worth carrying -- what it cost in bulk
 * against what it brought in over the period.
 */
export default function ProfitPage() {
  const t = useTranslations('profit');
  const ts = useTranslations('summary');
  const { businessId } = useApp();
  const [range, setRange] = useState<7 | 30>(7);
  const today = businessDay();

  const data = useLiveQuery(async () => {
    if (!businessId) return null;
    const from = addDays(today, -(range - 1));
    const rows = await loadRange(businessId, from, today);
    const liveSaleIds = new Set(rows.sales.filter((sale) => sale.status === 'complete').map((s) => s.id));
    const purchaseIds = rows.purchases.filter((p) => !p.deletedAt).map((p) => p.id);
    const [purchaseLines, products] = await Promise.all([
      purchaseIds.length
        ? db().purchaseLines.where('purchaseId').anyOf(purchaseIds).toArray()
        : Promise.resolve([]),
      db().products.where('businessId').equals(businessId).toArray(),
    ]);
    const lines = productProfitability({
      saleLines: rows.saleLines,
      purchaseLines,
      products,
      liveSaleIds,
    });
    return { lines, totals: totalsOf(lines) };
  }, [businessId, today, range]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="flex gap-2 px-3 py-3">
        {([7, 30] as const).map((days) => (
          <button
            key={days}
            onClick={() => setRange(days)}
            className={cn(
              'h-10 rounded-full border px-4 text-sm font-semibold',
              range === days ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line-strong text-ink-soft'
            )}
          >
            {days === 7 ? ts('last7') : ts('last30')}
          </button>
        ))}
      </div>

      {data && data.lines.length === 0 ? <EmptyState title={t('empty')} /> : null}

      {data && data.lines.length > 0 && (
        <>
          <section className="card mx-3 mb-3 px-4 py-2">
            <Row label={t('revenue')} value={<Money value={data.totals.revenue} />} />
            <Row label={t('cost')} value={<Money value={-data.totals.cost} />} tone="loss" />
            <Row label={t('profit')} value={<Money value={data.totals.profit} symbol />} tone="brand" strong />
            <Row label={t('purchased')} value={<Money value={data.totals.purchased} />} tone="soft" />
          </section>

          <ul className="space-y-2 px-3 pb-4">
            {data.lines.map((line, index) => {
              const losing = line.qtySold > 0 && line.profit < 0;
              return (
                <li key={line.productId} className="card p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="text-2xl leading-none" aria-hidden>
                      {line.icon ?? '📦'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{line.name}</p>
                      <p className="text-xs text-ink-faint">
                        {t('sold')} {formatQty(line.qtySold)} · {t('revenue')} {formatTZS(line.revenue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money
                        value={line.profit}
                        className={cn('block font-bold', losing ? 'text-loss' : 'text-brand')}
                      />
                      <span className="tnum text-xs text-ink-faint">{line.margin}%</span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {index === 0 && line.profit > 0 && <Badge tone="brand">{t('bestSeller')}</Badge>}
                    {losing && <Badge tone="loss">{t('losing')}</Badge>}
                    {line.partial && <Badge tone="debt">{t('noCost')}</Badge>}
                    {line.unitCost != null && (
                      <span className="tnum text-xs text-ink-soft">
                        {t('perUnit', { cost: formatTZS(line.unitCost), price: formatTZS(line.price) })}
                        {line.unitProfit != null && (
                          <span className={line.unitProfit >= 0 ? ' text-brand' : ' text-loss'}>
                            {' '}
                            ({formatTZS(line.unitProfit, { signed: true })})
                          </span>
                        )}
                      </span>
                    )}
                    {line.purchased > 0 && (
                      <span className="tnum text-xs text-ink-faint">
                        · {t('purchased')} {formatTZS(line.purchased)}
                      </span>
                    )}
                  </div>

                  {line.partial && (
                    <p className="mt-2 flex gap-1.5 text-xs text-debt">
                      <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                      {t('noCostHint')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
