'use client';

import { productLabel } from '@/lib/products';
import { useLiveQuery } from 'dexie-react-hooks';
import { Info, Lock } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { BarChart } from '@/components/summary/bar-chart';
import { Badge, Money, PageHeader, Row } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Keypad, parseKeypad } from '@/components/ui/keypad';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { cashDifference, salesByDay, summariseDay, topProducts } from '@/lib/calc/summary';
import { cn } from '@/lib/cn';
import { addDays, businessDay, recentDays } from '@/lib/date';
import { closeDay, openingCashFor } from '@/lib/local/actions';
import { db } from '@/lib/local/db';
import { loadRange } from '@/lib/local/queries';
import { formatTZS } from '@/lib/money';
import { formatQty } from '@/lib/units';

export default function SummaryPage() {
  const t = useTranslations('summary');
  const toast = useToast();
  const { businessId, userId, can } = useApp();
  const [range, setRange] = useState<7 | 30>(7);
  const [closing, setClosing] = useState(false);
  const [counted, setCounted] = useState('');

  const today = businessDay();

  const data = useLiveQuery(async () => {
    if (!businessId) return null;
    const [todayRows, openingCash, todayClose] = await Promise.all([
      loadRange(businessId, today, today),
      openingCashFor(businessId, today),
      db().dayClosings.where('[businessId+date]').equals([businessId, today]).first(),
    ]);
    return {
      openingCash,
      todayClose: todayClose ?? null,
      summary: summariseDay({ ...todayRows, openingCash }),
    };
  }, [businessId, today]);

  const history = useLiveQuery(async () => {
    if (!businessId) return null;
    const days = recentDays(range, today);
    const rows = await loadRange(businessId, addDays(today, -(range - 1)), today);
    const live = new Set(rows.sales.filter((s) => s.status === 'complete').map((s) => s.id));
    const points = salesByDay(rows.sales, days, (s) => businessDay(s.clientCreatedAt));
    const top = topProducts(rows.saleLines.filter((l) => live.has(l.saleId)), 5);
    const products = await db().products.bulkGet(top.map((p) => p.productId));
    return { points, top: top.map((p, i) => ({ ...p, name: products[i] ? productLabel(products[i]) : '—', icon: products[i]?.icon ?? '' })) };
  }, [businessId, today, range]);

  if (!data) return <PageHeader title={t('title')} back={false} />;
  const { summary, openingCash, todayClose } = data;
  const countedValue = Math.round(parseKeypad(counted));
  const difference = cashDifference(summary.expectedCash, countedValue);
  const total = history?.points.reduce((s, p) => s + p.total, 0) ?? 0;
  const best = history?.points.reduce((a, b) => (b.total > a.total ? b : a), { day: '', total: 0 });

  const saveClose = async () => {
    if (!businessId) return;
    await closeDay({ businessId, userId, day: today, openingCash, expectedCash: summary.expectedCash, countedCash: countedValue });
    toast(t('closed'));
    setClosing(false);
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={new Date().toLocaleDateString('sw-TZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Dar_es_Salaam' })}
        back={false}
      />

      <section className="card m-3 p-4">
        <p className="text-sm font-medium text-ink-soft">{t('salesTotal')}</p>
        <Money value={summary.salesTotal} symbol className="text-4xl font-bold tracking-tight" />
        <p className="text-sm text-ink-soft">{t('salesCount', { count: summary.salesCount })}</p>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <div>
            <p className="text-xs font-medium text-ink-soft">{t('cash')}</p>
            <Money value={summary.cash} className="font-bold" />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-soft">{t('mobile')}</p>
            <Money value={summary.mobile + summary.bank} className="font-bold" />
          </div>
          <div>
            <p className="text-xs font-medium text-ink-soft">{t('credit')}</p>
            <Money value={summary.credit} className="font-bold text-debt" />
          </div>
        </div>
      </section>

      <section className="card mx-3 mb-3 px-4 py-1">
        <Row label={t('debtCollected')} value={<Money value={summary.debtCollected} signed />} tone="brand" />
        <Row label={t('expenses')} value={<Money value={-summary.expensesTotal} />} tone="loss" />
        <Row label={t('purchases')} value={<Money value={-summary.purchasesTotal} />} tone="soft" />
        <Row label={t('waste')} value={<Money value={-summary.wasteTotal} />} tone="loss" />
      </section>

      {can('viewProfit') && (
        <section className="card mx-3 mb-3 p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink-soft">{t('profit')}</p>
            <Badge tone="info">{t('profitEstimate')}</Badge>
          </div>
          <Money value={summary.estimatedProfit} className={cn('text-3xl font-bold', summary.estimatedProfit < 0 ? 'text-loss' : 'text-brand')} />
          <p className="mt-1 text-xs text-ink-faint">
            {t('costOfGoods')}: {formatTZS(summary.costOfGoodsSold)}
          </p>
          {summary.profitIsPartial ? (
            <p className="mt-2 flex gap-1.5 text-xs text-ink-soft">
              <Info size={14} className="mt-0.5 shrink-0" />
              {t('profitPartial')}
            </p>
          ) : null}
        </section>
      )}

      <section className="card mx-3 mb-3 p-4">
        <p className="text-sm font-medium text-ink-soft">{t('expectedCash')}</p>
        <Money value={summary.expectedCash} symbol className="text-3xl font-bold" />
        <p className="text-xs text-ink-faint">
          {t('openingCash')}: {formatTZS(openingCash)} · {t('expectedCashHint')}
        </p>
        {todayClose ? (
          <p className="mt-3 flex items-center gap-2 rounded-[10px] bg-brand-tint px-3 py-2 text-sm font-semibold text-brand-dark">
            <Lock size={16} />
            {t('closed')} · {formatTZS(todayClose.countedCash)} ({formatTZS(todayClose.difference, { signed: true })})
          </p>
        ) : null}
        {can('closeDay') && (
        <Button size="lg" block className="mt-3" variant={todayClose ? 'secondary' : 'primary'} onClick={() => { setCounted(todayClose ? String(todayClose.countedCash) : ''); setClosing(true); }}>
          <Lock size={20} />
          {t('closeDay')}
        </Button>
        )}
      </section>

      <section className="card mx-3 mb-3 p-4">
        <div className="mb-3 flex gap-2">
          {([7, 30] as const).map((days) => (
            <button
              key={days}
              onClick={() => setRange(days)}
              className={cn('h-10 rounded-full border px-4 text-sm font-semibold', range === days ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line-strong text-ink-soft')}
            >
              {days === 7 ? t('last7') : t('last30')}
            </button>
          ))}
        </div>
        {history ? <BarChart points={history.points} today={today} /> : <div className="h-40" />}
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-ink-soft">{t('average')}</p>
            <Money value={Math.round(total / range)} className="font-bold" />
          </div>
          <div>
            <p className="text-ink-soft">{t('best')}</p>
            <Money value={best?.total ?? 0} className="font-bold" />
          </div>
        </div>
      </section>

      {history && history.top.length > 0 && (
        <section className="card mx-3 mb-3 px-4 py-2">
          <h2 className="pt-2 pb-1 text-sm font-bold text-ink-soft">{t('topProducts')}</h2>
          {history.top.map((p) => (
            <Row key={p.productId} label={`${p.icon} ${p.name} · ${formatQty(p.qty)}`} value={<Money value={p.total} />} />
          ))}
        </section>
      )}

      <Sheet open={closing} onClose={() => setClosing(false)} title={t('closeDayTitle', { date: today })}>
        <div className="space-y-4 p-4">
          {todayClose ? <p className="text-sm text-debt">{t('reopenHint')}</p> : null}
          <Row label={t('expectedLabel')} value={<Money value={summary.expectedCash} />} strong />
          <p className="text-sm font-semibold text-ink-soft">{t('countedLabel')}</p>
          <p className="tnum text-center text-4xl font-bold">{formatTZS(countedValue)}</p>
          {counted !== '' && (
            <p className={cn('text-center text-lg font-bold', difference === 0 ? 'text-brand' : difference > 0 ? 'text-info' : 'text-loss')}>
              {difference === 0 ? t('exact') : `${difference > 0 ? t('over') : t('short')}: ${formatTZS(Math.abs(difference))}`}
            </p>
          )}
          <Keypad value={counted} onChange={setCounted} />
          <Button size="xl" block disabled={counted === ''} onClick={() => void saveClose()}>
            {t('closeDay')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
