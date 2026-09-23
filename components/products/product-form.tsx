'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { OptionGrid } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field, TextInput } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { parseTZS } from '@/lib/money';
import { PRODUCT_ICONS } from '@/lib/onboarding/starter-products';
import { PRODUCT_UNITS } from '@/lib/units';
import type { Product, ProductPack, ProductUnit, VatType } from '@/lib/types';
import { PackEditor, type PackDraft } from './pack-editor';

export interface ProductDraft {
  packs: PackDraft[];
  name: string;
  unit: ProductUnit;
  unitLabel: string | null;
  price: number;
  cost: number | null;
  trackStock: boolean;
  lowStockLevel: number | null;
  icon: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  vatType: VatType;
}

export function draftFrom(product?: Product | null, packs: readonly ProductPack[] = []): ProductDraft {
  return {
    packs: packs
      .filter((pack) => pack.active && !pack.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((pack) => ({ id: pack.id, label: pack.label, units: String(pack.units) })),
    name: product?.name ?? '',
    unit: product?.unit ?? 'kipande',
    unitLabel: product?.unitLabel ?? null,
    price: product?.price ?? 0,
    cost: product?.cost ?? null,
    trackStock: product?.trackStock ?? false,
    lowStockLevel: product?.lowStockLevel ?? null,
    icon: product?.icon ?? '📦',
    sku: product?.sku ?? null,
    barcode: product?.barcode ?? null,
    category: product?.category ?? null,
    vatType: product?.vatType ?? 'standard',
  };
}

/** Fields appear by mode: a genge never sees SKU, barcode, category or VAT. */
export function ProductForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial: ProductDraft;
  onSubmit: (draft: ProductDraft) => void | Promise<void>;
  submitLabel: string;
}) {
  const t = useTranslations('products');
  const tc = useTranslations('common');
  const { show } = useApp();
  const [draft, setDraft] = useState(initial);
  const [price, setPrice] = useState(initial.price ? String(initial.price) : '');
  const [cost, setCost] = useState(initial.cost ? String(initial.cost) : '');
  const [low, setLow] = useState(initial.lowStockLevel != null ? String(initial.lowStockLevel) : '');
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) return setError(t('nameLabel'));
    void onSubmit({
      ...draft,
      name: draft.name.trim(),
      price: parseTZS(price) ?? 0,
      cost: parseTZS(cost),
      lowStockLevel: low.trim() ? Number(low) : null,
      packs: draft.packs.filter((pack) => pack.label.trim() && Number(pack.units) > 0),
    });
  };

  return (
    <div className="space-y-5 p-4">
      <Field label={t('nameLabel')} error={error}>
        {(id) => <TextInput id={id} value={draft.name} placeholder={t('namePlaceholder')} onChange={(e) => set('name', e.target.value)} />}
      </Field>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink-soft">{t('iconLabel')}</p>
        <div className="flex flex-wrap gap-1.5">
          {PRODUCT_ICONS.map((icon) => (
            <button
              key={icon}
              onClick={() => set('icon', icon)}
              aria-pressed={draft.icon === icon}
              className={cn('h-12 w-12 rounded-[10px] border text-2xl', draft.icon === icon ? 'border-brand bg-brand-tint' : 'border-line bg-surface')}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink-soft">{t('unitLabel')}</p>
        <OptionGrid<ProductUnit>
          columns={3}
          value={draft.unit}
          onChange={(unit) => set('unit', unit)}
          options={PRODUCT_UNITS.map((unit) => ({ value: unit, label: t(`unitsShort.${unit}`) }))}
        />
        {draft.unit === 'custom' && (
          <TextInput value={draft.unitLabel ?? ''} placeholder={t('customUnitLabel')} onChange={(e) => set('unitLabel', e.target.value)} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('priceLabel')}>
          {(id) => <AmountInput id={id} value={price} onChange={(e) => setPrice(e.target.value)} />}
        </Field>
        <Field label={t('costLabel')} hint={tc('optional')}>
          {(id) => <AmountInput id={id} value={cost} onChange={(e) => setCost(e.target.value)} />}
        </Field>
      </div>
      <p className="-mt-3 text-xs text-ink-faint">{t('costHint')}</p>

      <PackEditor
        packs={draft.packs}
        unit={draft.unit}
        unitName={draft.unit === 'custom' ? draft.unitLabel || t('unitsShort.custom') : t(`unitsShort.${draft.unit}`)}
        onChange={(packs) => set('packs', packs)}
      />

      <label className="flex min-h-14 items-center gap-3 rounded-[10px] border border-line-strong bg-surface px-3">
        <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={draft.trackStock} onChange={(e) => set('trackStock', e.target.checked)} />
        <span className="flex-1">
          <span className="block font-semibold">{t('trackStock')}</span>
          <span className="block text-xs text-ink-faint">{t('trackStockHint')}</span>
        </span>
      </label>

      {draft.trackStock && (
        <Field label={t('lowStockLabel')} hint={tc('optional')}>
          {(id) => <AmountInput id={id} value={low} onChange={(e) => setLow(e.target.value)} />}
        </Field>
      )}

      {show('productCodes') && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('skuLabel')}>
            {(id) => <TextInput id={id} value={draft.sku ?? ''} onChange={(e) => set('sku', e.target.value || null)} />}
          </Field>
          <Field label={t('barcodeLabel')}>
            {(id) => <TextInput id={id} inputMode="numeric" value={draft.barcode ?? ''} onChange={(e) => set('barcode', e.target.value || null)} />}
          </Field>
          <div className="col-span-2">
            <Field label={t('categoryLabel')}>
              {(id) => <TextInput id={id} value={draft.category ?? ''} onChange={(e) => set('category', e.target.value || null)} />}
            </Field>
          </div>
        </div>
      )}

      {show('vat') && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink-soft">{t('vatLabel')}</p>
          <OptionGrid<VatType>
            value={draft.vatType}
            onChange={(v) => set('vatType', v)}
            options={[
              { value: 'standard', label: t('vatStandard') },
              { value: 'exempt', label: t('vatExempt') },
            ]}
          />
        </div>
      )}

      <Button size="xl" block onClick={submit}>
        {submitLabel}
      </Button>
    </div>
  );
}
