'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2 } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Money, PageHeader, Row } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { businessDay } from '@/lib/date';
import { recordPurchase, type PurchaseLineInput } from '@/lib/local/actions';
import { db } from '@/lib/local/db';
import { loadRange, useProducts } from '@/lib/local/queries';
import { parseTZS } from '@/lib/money';
import { formatQty } from '@/lib/units';

export default function PurchasesPage() {
  const t = useTranslations('purchases');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const { businessId, userId, show } = useApp();
  const products = useProducts(businessId);
  const suppliers = useLiveQuery(
    async () => (businessId ? db().suppliers.where('businessId').equals(businessId).toArray() : []),
    [businessId]
  );

  const [lines, setLines] = useState<PurchaseLineInput[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [paid, setPaid] = useState('');

  const today = businessDay();
  const todays = useLiveQuery(
    async () => (businessId ? (await loadRange(businessId, today, today)).purchases : []),
    [businessId, today]
  );

  const total = lines.reduce((s, l) => s + l.totalCost, 0);
  const name = (id: string) => products?.find((p) => p.id === id)?.name ?? '';

  const addLine = () => {
    const q = Number(qty);
    const c = parseTZS(cost);
    if (!productId) return toast(te('productRequired'), 'warn');
    if (!(q > 0)) return toast(te('qtyPositive'), 'warn');
    if (c == null || c < 0) return toast(te('amountRequired'), 'warn');
    setLines((current) => [...current, { productId, qty: q, totalCost: c }]);
    setProductId('');
    setQty('');
    setCost('');
  };

  const save = async () => {
    if (!businessId || lines.length === 0) return;
    const paidAmount = show('suppliers') && paid.trim() ? Math.min(parseTZS(paid) ?? total, total) : total;
    await recordPurchase({ businessId, userId, lines, supplierId: supplierId || null, paidAmount });
    toast(t('costUpdated'));
    setLines([]);
    setPaid('');
  };

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="space-y-4 p-4">
        <section className="card space-y-3 p-4">
          <Field label={t('chooseProducts')}>
            {(id) => (
              <Select id={id} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">—</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('qtyLabel')}>
              {(id) => <AmountInput id={id} value={qty} onChange={(e) => setQty(e.target.value)} />}
            </Field>
            <Field label={t('totalCostLabel')}>
              {(id) => <AmountInput id={id} value={cost} onChange={(e) => setCost(e.target.value)} />}
            </Field>
          </div>
          <Button variant="secondary" block onClick={addLine}>
            <Plus size={20} />
            {tc('add')}
          </Button>
        </section>

        {lines.length > 0 && (
          <section className="card space-y-3 p-4">
            <ul className="divide-y divide-line">
              {lines.map((line, index) => (
                <li key={index} className="flex items-center gap-2 py-2">
                  <span className="flex-1">
                    {name(line.productId)} × {formatQty(line.qty)}
                  </span>
                  <Money value={line.totalCost} className="font-semibold" />
                  <button aria-label={tc('delete')} className="flex h-12 w-12 items-center justify-center text-loss" onClick={() => setLines((c) => c.filter((_, i) => i !== index))}>
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <Row label={tc('total')} value={<Money value={total} symbol />} strong />

            {show('suppliers') && (
              <>
                <Field label={t('supplierLabel')} hint={tc('optional')}>
                  {(id) => (
                    <Select id={id} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                      <option value="">{t('noSupplier')}</option>
                      {suppliers?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {supplierId && (
                  <Field label={t('paidLabel')}>
                    {(id) => <AmountInput id={id} value={paid} placeholder={String(total)} onChange={(e) => setPaid(e.target.value)} />}
                  </Field>
                )}
              </>
            )}
            <Button size="xl" block onClick={() => void save()}>
              {tc('save')}
            </Button>
          </section>
        )}

        <section className="card px-4 py-2">
          <h2 className="pt-2 text-sm font-bold text-ink-soft">{t('todayTotal')}</h2>
          {todays?.length ? (
            todays.map((p) => (
              <Row
                key={p.id}
                label={p.total > p.paidAmount ? `${t('unpaid')}: ${p.total - p.paidAmount}` : tc('total')}
                value={<Money value={p.total} />}
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
