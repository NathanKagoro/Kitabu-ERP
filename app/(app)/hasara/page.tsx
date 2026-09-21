'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Money, OptionGrid, PageHeader, Row } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Keypad, parseKeypad } from '@/components/ui/keypad';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { businessDay } from '@/lib/date';
import { recordWaste } from '@/lib/local/actions';
import { loadRange, useProducts } from '@/lib/local/queries';
import { allowsDecimals, formatQty } from '@/lib/units';
import type { WasteReason } from '@/lib/types';

const REASONS: WasteReason[] = ['imeoza', 'imeibiwa', 'imeharibika', 'nyingine'];

export default function WastePage() {
  const t = useTranslations('waste');
  const te = useTranslations('errors');
  const toast = useToast();
  const { businessId, userId } = useApp();
  const products = useProducts(businessId);
  const [productId, setProductId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<WasteReason>('imeoza');

  const today = businessDay();
  const todayWaste = useLiveQuery(
    async () => (businessId ? (await loadRange(businessId, today, today)).waste : []),
    [businessId, today]
  );

  const product = products?.find((p) => p.id === productId);
  const value = parseKeypad(qty);

  const save = async () => {
    if (!businessId || !productId) return toast(te('productRequired'), 'warn');
    if (value <= 0) return toast(te('qtyPositive'), 'warn');
    await recordWaste({ businessId, userId, productId, qty: value, reason });
    toast(t('recorded'));
    setQty('');
    setProductId(null);
  };

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="space-y-5 p-4">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink-soft">{t('chooseProduct')}</p>
          <div className="grid grid-cols-3 gap-2">
            {products?.map((p) => (
              <button
                key={p.id}
                onClick={() => setProductId(p.id)}
                className={cn('flex min-h-16 flex-col items-center justify-center rounded-[10px] border px-1 text-sm font-semibold', p.id === productId ? 'border-loss bg-loss-tint' : 'border-line bg-surface')}
              >
                <span className="text-xl">{p.icon}</span>
                <span className="line-clamp-1">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {product && (
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-ink-soft">{t('qtyLost')}</p>
              <p className="tnum text-center text-3xl font-bold">{qty || '0'}</p>
              <Keypad value={qty} onChange={setQty} decimals={allowsDecimals(product.unit)} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-ink-soft">{t('reasonLabel')}</p>
              <OptionGrid<WasteReason> value={reason} onChange={setReason} options={REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) }))} />
            </div>
            <Button size="xl" variant="danger" block onClick={() => void save()}>
              {t('add')}
            </Button>
          </>
        )}

        <section className="card px-4 py-2">
          <h2 className="pt-2 text-sm font-bold text-ink-soft">{t('todayTotal')}</h2>
          {todayWaste?.length ? (
            todayWaste.map((w) => (
              <Row
                key={w.id}
                label={`${products?.find((p) => p.id === w.productId)?.name ?? ''} × ${formatQty(w.qty)} · ${t(`reasons.${w.reason}`)}`}
                value={<Money value={-w.costValue} />}
                tone="loss"
              />
            ))
          ) : (
            <p className="py-3 text-sm text-ink-faint">{t('empty')}</p>
          )}
        </section>
      </div>
    </>
  );
}
