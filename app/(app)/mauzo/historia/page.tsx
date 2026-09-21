'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Badge, EmptyState, Money, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { businessDay } from '@/lib/date';
import { voidSale } from '@/lib/local/actions';
import { db } from '@/lib/local/db';
import { loadRange } from '@/lib/local/queries';
import { formatQty } from '@/lib/units';
import type { Sale } from '@/lib/types';

export default function SalesHistoryPage() {
  const t = useTranslations('sales');
  const tp = useTranslations('payment');
  const tc = useTranslations('common');
  const toast = useToast();
  const { businessId, userId, can } = useApp();
  const [selected, setSelected] = useState<Sale | null>(null);
  const [reason, setReason] = useState('');

  const today = businessDay();
  const data = useLiveQuery(async () => {
    if (!businessId) return null;
    const range = await loadRange(businessId, today, today);
    return {
      ...range,
      sales: range.sales.sort((a, b) => b.clientCreatedAt.localeCompare(a.clientCreatedAt)),
    };
  }, [businessId, today]);

  const detail = useLiveQuery(async () => {
    if (!selected) return null;
    const [lines, payments] = await Promise.all([
      db().saleLines.where('saleId').equals(selected.id).toArray(),
      db().payments.where('saleId').equals(selected.id).toArray(),
    ]);
    return { lines, payments };
  }, [selected?.id]);

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam' });

  const confirmVoid = async () => {
    if (!selected || !businessId || !reason.trim()) return;
    await voidSale(selected.id, reason.trim(), { businessId, userId });
    toast(t('voided'));
    setSelected(null);
    setReason('');
  };

  return (
    <>
      <PageHeader title={t('todaySales')} />
      {data && data.sales.length === 0 ? <EmptyState title={t('cartEmpty')} /> : null}
      <ul className="divide-y divide-line">
        {data?.sales.map((sale) => (
          <li key={sale.id}>
            <button onClick={() => setSelected(sale)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left active:bg-surface">
              <span className="tnum w-14 shrink-0 font-semibold text-ink-soft">{time(sale.clientCreatedAt)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
                {data.saleLines.filter((l) => l.saleId === sale.id).map((l) => l.description).join(', ')}
              </span>
              {sale.status === 'void' ? <Badge tone="loss">{t('voided')}</Badge> : null}
              <Money value={sale.total} className={sale.status === 'void' ? 'text-ink-faint line-through' : 'font-bold'} />
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? t('saleNumber', { time: time(selected.clientCreatedAt) }) : ''}>
        {selected && detail ? (
          <div className="space-y-4 p-4">
            <ul className="space-y-1.5">
              {detail.lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-3">
                  <span>{line.description} × {formatQty(line.qty)}</span>
                  <Money value={line.lineTotal} className="font-semibold" />
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t border-line pt-3 text-sm text-ink-soft">
              {detail.payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{tp(`methods.${p.method}`)}</span>
                  <Money value={p.amount} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>{tc('total')}</span>
              <Money value={selected.total} symbol />
            </div>

            {selected.status === 'void' ? (
              <p className="rounded-[10px] bg-loss-tint p-3 text-sm font-medium text-loss">{selected.voidReason}</p>
            ) : can('voidSale') ? (
              <div className="space-y-3 border-t border-line pt-4">
                <Field label={t('voidReason')}>
                  {(id) => <TextInput id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
                </Field>
                <Button variant="danger" block disabled={!reason.trim()} onClick={() => void confirmVoid()}>
                  {t('void')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-ink-faint">{t('voidNotAllowed')}</p>
            )}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
