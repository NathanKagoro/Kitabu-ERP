'use client';

import { productLabel } from '@/lib/products';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, TriangleAlert } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Money, OptionGrid, PageHeader, Row } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { costPerUnit, LOOSE_PACK_ID, packChoices, packToUnits, unitMargin } from '@/lib/calc/packs';
import { businessDay } from '@/lib/date';
import { recordPurchase, type PurchaseLineInput } from '@/lib/local/actions';
import { db } from '@/lib/local/db';
import { loadRange, usePacks, useProducts } from '@/lib/local/queries';
import { formatTZS, parseTZS } from '@/lib/money';
import { formatQty } from '@/lib/units';

/**
 * Buying stock, in the units stock is actually bought in. A trader says "two
 * tenga for 60,000", not "80 fungu"; the conversion to selling units -- and to
 * a cost per fungu that can be compared with the shelf price -- happens here,
 * in front of them, before they save.
 */
export default function PurchasesPage() {
  const t = useTranslations('purchases');
  const tp = useTranslations('products');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const { businessId, userId, show } = useApp();
  const products = useProducts(businessId);
  const packsByProduct = usePacks(businessId);
  const suppliers = useLiveQuery(
    async () => (businessId ? db().suppliers.where('businessId').equals(businessId).toArray() : []),
    [businessId]
  );

  const [lines, setLines] = useState<PurchaseLineInput[]>([]);
  const [productId, setProductId] = useState('');
  const [packId, setPackId] = useState<string>(LOOSE_PACK_ID);
  const [packQty, setPackQty] = useState('');
  const [cost, setCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [paid, setPaid] = useState('');

  const today = businessDay();
  const todays = useLiveQuery(
    async () => (businessId ? (await loadRange(businessId, today, today)).purchases : []),
    [businessId, today]
  );

  const product = products?.find((p) => p.id === productId) ?? null;
  const unitName = product
    ? product.unit === 'custom'
      ? (product.unitLabel ?? tp('unitsShort.custom'))
      : tp(`unitsShort.${product.unit}`)
    : '';

  const choices = useMemo(
    () => packChoices(packsByProduct?.get(productId) ?? [], t('loosePack')),
    [packsByProduct, productId, t]
  );
  const pack = choices.find((choice) => choice.id === packId) ?? choices[choices.length - 1];

  // What this line works out to, shown live so nobody has to trust the maths.
  const qtyPacks = Number(packQty) || 0;
  const units = pack ? packToUnits(qtyPacks, pack.units) : 0;
  const totalCost = parseTZS(cost) ?? 0;
  const perUnit = costPerUnit(totalCost, units);
  const margin = product ? unitMargin(product.price, perUnit) : null;

  const total = lines.reduce((sum, line) => sum + line.totalCost, 0);
  const nameOf = (id: string) => products?.find((p) => p.id === id)?.name ?? '';
  const unitOf = (id: string) => {
    const found = products?.find((p) => p.id === id);
    if (!found) return '';
    return found.unit === 'custom' ? (found.unitLabel ?? tp('unitsShort.custom')) : tp(`unitsShort.${found.unit}`);
  };

  const pickProduct = (id: string) => {
    setProductId(id);
    // Default to the biggest pack; buying loose is the exception, not the rule.
    const next = packChoices(packsByProduct?.get(id) ?? [], t('loosePack'));
    setPackId(next[0]?.id ?? LOOSE_PACK_ID);
    setPackQty('');
    setCost('');
  };

  const addLine = () => {
    if (!productId || !pack) return toast(te('productRequired'), 'warn');
    if (!(units > 0)) return toast(te('qtyPositive'), 'warn');
    if (totalCost <= 0) return toast(te('amountRequired'), 'warn');
    setLines((current) => [
      ...current,
      {
        productId,
        qty: units,
        totalCost,
        packId: pack.id === LOOSE_PACK_ID ? null : pack.id,
        packLabel: pack.id === LOOSE_PACK_ID ? null : pack.label,
        packQty: pack.id === LOOSE_PACK_ID ? null : qtyPacks,
      },
    ]);
    setProductId('');
    setPackQty('');
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
      <PageHeader title={t('title')} subtitle={t('subtitle')} back={false} />
      <div className="space-y-4 p-3">
        <section className="card space-y-3 p-4">
          <Field label={t('chooseProducts')}>
            {(id) => (
              <Select id={id} value={productId} onChange={(e) => pickProduct(e.target.value)}>
                <option value="">—</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon} {productLabel(p)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {product && (
            <>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-ink-soft">{t('packLabel')}</p>
                <OptionGrid
                  value={packId}
                  onChange={setPackId}
                  options={choices.map((choice) => ({
                    value: choice.id,
                    label: choice.label,
                    hint:
                      choice.id === LOOSE_PACK_ID
                        ? unitName
                        : `${formatQty(choice.units)} ${unitName}`,
                  }))}
                />
                {choices.length === 1 && <p className="text-xs text-ink-faint">{t('addPackHint')}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('packQtyLabel')} hint={pack?.label}>
                  {(id) => (
                    <AmountInput id={id} value={packQty} onChange={(e) => setPackQty(e.target.value)} />
                  )}
                </Field>
                <Field label={t('packCostLabel')}>
                  {(id) => <AmountInput id={id} value={cost} onChange={(e) => setCost(e.target.value)} />}
                </Field>
              </div>

              {units > 0 && (
                <div className="rounded-[10px] bg-brand-tint px-3 py-2.5 text-sm">
                  <p className="font-semibold text-brand-dark">
                    {t('converted', { qty: formatQty(units), unit: unitName })}
                    {totalCost > 0 ? ` · ${t('costEach', { cost: formatTZS(perUnit), unit: unitName })}` : ''}
                  </p>
                  {totalCost > 0 && product.price > 0 && margin && (
                    <p className={margin.profit >= 0 ? 'mt-0.5 text-brand-dark' : 'mt-0.5 flex gap-1.5 font-semibold text-loss'}>
                      {margin.profit < 0 && <TriangleAlert size={16} className="mt-0.5 shrink-0" />}
                      {margin.profit >= 0
                        ? t('marginHint', {
                            price: formatTZS(product.price),
                            profit: formatTZS(margin.profit),
                            unit: unitName,
                          })
                        : t('marginLoss', { price: formatTZS(product.price), cost: formatTZS(perUnit) })}
                    </p>
                  )}
                  {product.price === 0 && <p className="mt-0.5 text-debt">{t('noPrice')}</p>}
                </div>
              )}

              <Button variant="secondary" block onClick={addLine}>
                <Plus size={20} />
                {tc('add')}
              </Button>
            </>
          )}
        </section>

        {lines.length > 0 && (
          <section className="card space-y-3 p-4">
            <ul className="divide-y divide-line">
              {lines.map((line, index) => (
                <li key={index} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{nameOf(line.productId)}</span>
                    <span className="text-xs text-ink-faint">
                      {line.packLabel
                        ? `${formatQty(line.packQty ?? 0)} × ${line.packLabel} = ${formatQty(line.qty)}`
                        : formatQty(line.qty)}
                      {' · '}
                      {t('costEach', {
                        cost: formatTZS(costPerUnit(line.totalCost, line.qty)),
                        unit: unitOf(line.productId),
                      })}
                    </span>
                  </span>
                  <Money value={line.totalCost} className="font-semibold" />
                  <button
                    aria-label={tc('delete')}
                    className="flex h-12 w-10 items-center justify-center text-loss"
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  >
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
                    {(id) => (
                      <AmountInput id={id} value={paid} placeholder={String(total)} onChange={(e) => setPaid(e.target.value)} />
                    )}
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
            todays.map((purchase) => (
              <Row
                key={purchase.id}
                label={
                  purchase.total > purchase.paidAmount
                    ? `${t('unpaid')}: ${formatTZS(purchase.total - purchase.paidAmount)}`
                    : tc('total')
                }
                value={<Money value={purchase.total} />}
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
