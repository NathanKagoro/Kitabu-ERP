'use client';

import { STARTER_PRODUCTS } from '@/lib/onboarding/starter-products';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useMemo, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Copy, Plus, X } from '@/components/icons';
import { EmptyState, OptionGrid, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field, TextArea, TextInput } from '@/components/ui/field';
import { SwitchRow } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { addProductsWithOpeningCount } from '@/lib/local/stock-count';
import { db } from '@/lib/local/db';
import { useProducts } from '@/lib/local/queries';
import { formatTZS, parseTZS } from '@/lib/money';
import { categoriesOf, parseBulkText } from '@/lib/products';
import { presetOf } from '@/lib/shop-config';
import { iconFor } from '@/lib/onboarding/starter-products';
import { uuidv7 } from '@/lib/uuid';

/**
 * Setup day. The owner (or you, on the visit) counts a shelf and types it in:
 * one row per product, "another shade" copies a row with the shade cleared,
 * and the quantity counted becomes the opening stock. Or paste a whole list
 * from a spreadsheet. Nothing is saved until "Save all".
 *
 * ?anza=1 is the first run, straight after the PIN: there is a way to skip.
 */

interface Row {
  key: string;
  name: string;
  variant: string;
  category: string;
  price: string;
  cost: string;
  qty: string;
  /** What should be there: the owner's estimate or the delivery note. */
  expected: string;
}

const emptyRow = (from?: Partial<Row>): Row => ({
  key: uuidv7(),
  name: '',
  variant: '',
  category: '',
  price: '',
  cost: '',
  qty: '',
  expected: '',
  ...from,
});

export default function BulkEntryRoute() {
  return (
    <Suspense>
      <BulkEntryPage />
    </Suspense>
  );
}

function BulkEntryPage() {
  const t = useTranslations('products');
  const tb = useTranslations('products.bulk');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const toast = useToast();
  const firstRun = useSearchParams().get('anza') === '1';
  const { businessId, userId, business, show, can } = useApp();
  const existing = useProducts(businessId);

  const preset = presetOf(business);
  const asksVariant = preset.productFields.includes('variant') && preset.variantLabel !== null;
  const asksCategory = preset.productFields.includes('category');
  const tracksStock = show('stockTracking');
  const categories = useMemo(() => [...new Set([...preset.categories, ...categoriesOf(existing ?? [])])], [preset, existing]);

  const [tab, setTab] = useState<'type' | 'paste'>('type');
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [pasted, setPasted] = useState('');
  const [saving, setSaving] = useState(false);
  // Off by default: the figure only matters on the first visit, when the owner
  // has an estimate or the last delivery note to compare the shelf against.
  const [withExpected, setWithExpected] = useState(false);

  if (!can('manageProducts')) {
    return (
      <>
        <PageHeader title={tb('title')} />
        <EmptyState title={te('noAccess')} />
      </>
    );
  }

  const update = (key: string, patch: Partial<Row>) => setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key: string) => setRows((list) => (list.length > 1 ? list.filter((row) => row.key !== key) : [emptyRow()]));
  // Same product, next shade: keep name, category and prices, clear the rest.
  const sibling = (row: Row) =>
    setRows((list) => {
      const index = list.findIndex((r) => r.key === row.key);
      const copy = emptyRow({ name: row.name, category: row.category, price: row.price, cost: row.cost });
      return [...list.slice(0, index + 1), copy, ...list.slice(index + 1)];
    });
  const addRow = () => setRows((list) => [...list, emptyRow({ category: list[list.length - 1]?.category ?? '' })]);

  const readPaste = () => {
    const parsed = parseBulkText(pasted);
    if (parsed.length === 0) return toast(tb('pasteNothing'), 'warn');
    const fresh = parsed.map((p) =>
      emptyRow({
        name: p.name,
        variant: p.variant,
        category: p.category,
        price: p.price != null ? String(p.price) : '',
        cost: p.cost != null ? String(p.cost) : '',
        qty: p.qty != null ? String(p.qty) : '',
        expected: p.expected != null ? String(p.expected) : '',
      })
    );
    if (parsed.some((p) => p.expected != null)) setWithExpected(true);
    setRows((list) => [...list.filter((row) => row.name.trim()), ...fresh]);
    setPasted('');
    setTab('type');
    toast(tb('pasteRead', { count: fresh.length }));
  };

  const ready = rows.filter((row) => row.name.trim());
  const missingPrice = ready.filter((row) => !(parseTZS(row.price) ?? 0)).length;

  const save = async () => {
    if (!businessId || ready.length === 0) return;
    setSaving(true);
    const parseQty = (value: string) => {
      const n = Number(value.replace(',', '.'));
      return value.trim() && Number.isFinite(n) && n >= 0 ? n : null;
    };
    const { products, count } = await addProductsWithOpeningCount({
      businessId,
      userId,
      unit: preset.defaultUnit,
      trackStock: tracksStock,
      rows: ready.map((row) => ({
        name: row.name,
        variant: asksVariant ? row.variant : null,
        category: asksCategory ? row.category : null,
        // A fitting picture from the category ("Losheni" -> lotion), else the trade's.
        icon: iconFor(business?.type, asksCategory ? row.category : null),
        price: parseTZS(row.price) ?? 0,
        cost: parseTZS(row.cost),
        qty: parseQty(row.qty),
        expected: withExpected && tracksStock ? parseQty(row.expected) : null,
      })),
    });
    setSaving(false);
    toast(tb('saved', { count: products.length }));
    // Figures were given: the first thing to show is what is missing.
    if (count) return router.replace(`/stoo/ripoti?id=${count.id}${firstRun ? '&anza=1' : ''}`);
    if (!firstRun) return router.back();
    const all = await db().products.where('businessId').equals(businessId).filter((p) => p.active).toArray();
    router.replace(all.some((p) => !p.price) ? '/bei?anza=1' : '/mauzo');
  };

  const variantName = asksVariant && preset.variantLabel ? t(`variantLabels.${preset.variantLabel}`) : '';

  return (
    <>
      <PageHeader title={firstRun ? tb('firstTitle') : tb('title')} subtitle={tb('subtitle')} back={!firstRun} />

      <div className="space-y-4 p-3 pb-40">
        <OptionGrid<'type' | 'paste'>
          columns={2}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'type', label: tb('tabType') },
            { value: 'paste', label: tb('tabPaste') },
          ]}
        />

        {tab === 'paste' ? (
          <section className="space-y-3">
            <p className="text-sm text-ink-soft">{tb('pasteHelp')}</p>
            <pre className="overflow-x-auto rounded-[10px] bg-surface p-3 text-xs text-ink-soft">{tb('pasteExample')}</pre>
            <TextArea rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={tb('pastePlaceholder')} />
            <Button size="lg" block disabled={!pasted.trim()} onClick={readPaste}>
              {tb('pasteRead_button')}
            </Button>
          </section>
        ) : (
          <>
            <datalist id="bulk-categories">
              {categories.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {tracksStock && (
              <div className="card overflow-hidden">
                <SwitchRow
                  checked={withExpected}
                  onChange={setWithExpected}
                  label={tb('withExpected')}
                  hint={tb('withExpectedHint')}
                />
              </div>
            )}
            <ol className="space-y-3">
              {rows.map((row, index) => (
                <li key={row.key} className="card space-y-3 p-3">
                  <div className="flex items-center gap-2">
                    <span className="tnum flex h-7 min-w-7 items-center justify-center rounded-full bg-paper text-sm font-bold text-ink-soft">
                      {index + 1}
                    </span>
                    <span className="flex-1" />
                    {asksVariant && (
                      <Button variant="ghost" size="sm" disabled={!row.name.trim()} onClick={() => sibling(row)}>
                        <Copy size={16} />
                        {t(`anotherVariant.${preset.variantLabel}`)}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => remove(row.key)}>
                      <X size={20} />
                    </Button>
                  </div>
                  <Field label={t('nameLabel')}>
                    {(id) => <TextInput id={id} value={row.name} placeholder={t('namePlaceholder', { example: STARTER_PRODUCTS[business?.type ?? 'other']?.[0]?.name ?? '' })} onChange={(e) => update(row.key, { name: e.target.value })} />}
                  </Field>
                  {(asksVariant || asksCategory) && (
                    <div className="grid grid-cols-2 gap-2">
                      {asksVariant && (
                        <Field label={variantName}>
                          {(id) => (
                            <TextInput
                              id={id}
                              value={row.variant}
                              placeholder={t(`variantPlaceholders.${preset.variantLabel}`)}
                              onChange={(e) => update(row.key, { variant: e.target.value })}
                            />
                          )}
                        </Field>
                      )}
                      {asksCategory && (
                        <div className={asksVariant ? '' : 'col-span-2'}>
                          <Field label={t('categoryLabel')}>
                            {(id) => (
                              <TextInput id={id} list="bulk-categories" value={row.category} onChange={(e) => update(row.key, { category: e.target.value })} />
                            )}
                          </Field>
                        </div>
                      )}
                    </div>
                  )}
                  <div className={tracksStock ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
                    <Field label={t('priceLabel')}>
                      {(id) => <AmountInput id={id} value={row.price} onChange={(e) => update(row.key, { price: e.target.value })} />}
                    </Field>
                    <Field label={tb('costShort')}>
                      {(id) => <AmountInput id={id} value={row.cost} onChange={(e) => update(row.key, { cost: e.target.value })} />}
                    </Field>
                    {tracksStock && (
                      <Field label={tb('qtyShort')}>
                        {(id) => <AmountInput id={id} value={row.qty} onChange={(e) => update(row.key, { qty: e.target.value })} />}
                      </Field>
                    )}
                  </div>
                  {withExpected && tracksStock && (
                    <Field label={tb('expectedLabel')} hint={tb('expectedHint')}>
                      {(id) => <AmountInput id={id} value={row.expected} onChange={(e) => update(row.key, { expected: e.target.value })} />}
                    </Field>
                  )}
                </li>
              ))}
            </ol>
            <Button variant="secondary" size="lg" block onClick={addRow}>
              <Plus size={20} />
              {tb('addRow')}
            </Button>
          </>
        )}

        {firstRun && (
          <Link href="/mauzo" className="block py-3 text-center font-semibold text-ink-soft">
            {tb('skip')}
          </Link>
        )}
      </div>

      {ready.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-surface">
          <div className="mx-auto max-w-lg space-y-1 p-2.5">
            {missingPrice > 0 ? <p className="text-center text-xs font-semibold text-debt">{tb('missingPrice', { count: missingPrice })}</p> : null}
            <Button size="lg" block disabled={saving} onClick={() => void save()}>
              {saving ? tc('loading') : tb('saveAll', { count: ready.length, total: formatTZS(stockValue(ready)) })}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Value of the counted stock at selling price: a number owners like to see. */
function stockValue(rows: readonly Row[]): number {
  return rows.reduce((sum, row) => {
    const qty = Number(row.qty.replace(',', '.'));
    const price = parseTZS(row.price) ?? 0;
    return sum + (Number.isFinite(qty) && qty > 0 ? qty * price : 0);
  }, 0);
}
