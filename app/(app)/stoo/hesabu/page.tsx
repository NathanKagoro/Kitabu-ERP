'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Search } from '@/components/icons';
import { EmptyState, Money, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { lineDifference, summariseCount, type CountLine } from '@/lib/calc/stock-count';
import { cn } from '@/lib/cn';
import { recordStockCount } from '@/lib/local/stock-count';
import { useProducts, useStock } from '@/lib/local/queries';
import { categoriesOf, groupByCategory, matchesQuery, productLabel } from '@/lib/products';
import { formatQty } from '@/lib/units';

/**
 * Count a shelf. Pick a category (or everything), type what is actually there,
 * and the shortfall in shillings adds up at the bottom as you go. Only the
 * products you type a number for are part of the count, so one shelf at a time
 * is fine. The typed numbers survive the phone locking (kept on the phone
 * until saved).
 */

const draftKey = (businessId: string) => `kitabu:countDraft:${businessId}`;

function loadDraft(businessId: string | null): Record<string, string> {
  if (!businessId) return {};
  try {
    return JSON.parse(localStorage.getItem(draftKey(businessId)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function saveDraft(businessId: string, draft: Record<string, string>) {
  try {
    if (Object.keys(draft).length) localStorage.setItem(draftKey(businessId), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(businessId));
  } catch {
    // Private mode: the count still works, it just won't survive a reload.
  }
}

const parseQty = (value: string): number | null => {
  const cleaned = value.replace(',', '.').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export default function CountPage() {
  const t = useTranslations('stockCheck');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const toast = useToast();
  const { businessId, userId, can, show } = useApp();
  const products = useProducts(businessId);
  const stock = useStock(businessId);

  const [counts, setCounts] = useState<Record<string, string>>(() => loadDraft(businessId));
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (businessId) saveDraft(businessId, counts);
  }, [businessId, counts]);

  const tracked = useMemo(() => (products ?? []).filter((p) => p.trackStock), [products]);
  const categories = useMemo(() => categoriesOf(tracked), [tracked]);
  const groups = useMemo(
    () =>
      groupByCategory(
        tracked.filter(
          (p) => matchesQuery(p, query) && (!category || p.category?.trim().toLowerCase() === category.toLowerCase())
        )
      ),
    [tracked, query, category]
  );

  // The running total, exactly as the report will compute it.
  const lines: CountLine[] = useMemo(
    () =>
      tracked.flatMap((p) => {
        const counted = parseQty(counts[p.id] ?? '');
        if (counted === null) return [];
        return [
          {
            productId: p.id,
            name: productLabel(p),
            expected: Math.max(0, stock?.get(p.id) ?? 0),
            counted,
            unitCost: p.cost ?? null,
            unitPrice: p.price,
          },
        ];
      }),
    [tracked, counts, stock]
  );
  const summary = summariseCount(lines);

  if (!can('countStock') || !show('stockTracking')) {
    return (
      <>
        <PageHeader title={t('countTitle')} />
        <EmptyState title={te('noAccess')} />
      </>
    );
  }

  const save = async () => {
    if (!businessId || lines.length === 0) return;
    setSaving(true);
    try {
      const count = await recordStockCount({
        businessId,
        userId,
        kind: 'check',
        scope: category,
        items: lines.map((line) => ({ productId: line.productId, counted: line.counted })),
      });
      saveDraft(businessId, {});
      router.replace(`/stoo/ripoti?id=${count.id}`);
    } catch {
      setSaving(false);
      toast(te('saveFailed'), 'warn');
    }
  };

  return (
    <>
      <PageHeader title={t('countTitle')} subtitle={t('countSubtitle')} />

      <div className="space-y-2 border-b border-line px-3 pt-2 pb-2.5">
        {tracked.length > 8 && (
          <div className="relative">
            <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
            <TextInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
              className="h-12 pl-10"
            />
          </div>
        )}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label={t('shelf')}>
            {[null, ...categories].map((name) => (
              <button
                key={name ?? '__all'}
                onClick={() => setCategory(name)}
                aria-pressed={category === name}
                className={cn(
                  'h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap',
                  category === name ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-ink-soft'
                )}
              >
                {name ?? tc('all')}
              </button>
            ))}
          </div>
        )}
      </div>

      {products && tracked.length === 0 ? <EmptyState title={t('nothingTracked')} body={t('nothingTrackedBody')} /> : null}

      <div className={cn(lines.length > 0 ? 'pb-48' : 'pb-6')}>
        {groups.map((group) => (
          <section key={group.category ?? '__none'} className="pt-3">
            {(groups.length > 1 || group.category) && (
              <h2 className="px-4 pb-1 text-sm font-bold text-ink-soft">{group.category ?? t('noCategory')}</h2>
            )}
            <ul className="divide-y divide-line border-y border-line bg-surface">
              {group.items.map((p) => {
                const expected = Math.max(0, stock?.get(p.id) ?? 0);
                const typed = counts[p.id] ?? '';
                const counted = parseQty(typed);
                const diff = counted === null ? null : lineDifference({ expected, counted });
                return (
                  <li key={p.id} className="flex min-h-16 items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {p.name}
                        {p.variant ? <span className="font-normal text-ink-soft"> · {p.variant}</span> : null}
                      </span>
                      <span className="flex items-center gap-2 text-sm">
                        <span className="text-ink-faint">{t('records', { qty: formatQty(expected) })}</span>
                        {diff === null ? null : diff < 0 ? (
                          <span className="font-semibold text-loss">{t('missing', { qty: formatQty(-diff) })}</span>
                        ) : diff > 0 ? (
                          <span className="font-semibold text-info">{t('extra', { qty: formatQty(diff) })}</span>
                        ) : (
                          <span className="font-semibold text-brand">{t('matches')}</span>
                        )}
                      </span>
                    </span>
                    <TextInput
                      inputMode="decimal"
                      aria-label={t('countedFor', { name: productLabel(p) })}
                      placeholder="—"
                      value={typed}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCounts((current) => {
                          const next = { ...current };
                          if (value.trim()) next[p.id] = value;
                          else delete next[p.id];
                          return next;
                        });
                      }}
                      className={cn(
                        'tnum h-12 w-20 shrink-0 text-center text-lg font-semibold',
                        diff !== null && diff < 0 && 'border-loss',
                        diff === 0 && 'border-brand'
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-surface">
          <div className="mx-auto max-w-lg space-y-2 p-2.5">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <span className="text-sm font-semibold text-ink-soft">{t('countedSoFar', { count: lines.length })}</span>
              {summary.linesShort > 0 ? (
                <span className="text-right font-bold text-loss">
                  {t('shortSoFar', { units: formatQty(summary.unitsShort) })} ·{' '}
                  <Money value={summary.valueShortCost || summary.valueShortPrice} symbol />
                </span>
              ) : (
                <span className="font-bold text-brand">{t('allMatchSoFar')}</span>
              )}
            </div>
            <Button size="lg" block disabled={saving} onClick={() => void save()}>
              {saving ? tc('loading') : t('finish')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
