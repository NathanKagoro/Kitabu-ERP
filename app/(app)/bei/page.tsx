'use client';

import { productLabel } from '@/lib/products';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { updatePrices } from '@/lib/local/actions';
import { useProducts } from '@/lib/local/queries';
import { formatTZS, parseTZS } from '@/lib/money';

/**
 * The morning after Kariakoo: one list, every price pre-filled with what it was
 * yesterday, change the ones that moved, one save. Nothing else on the screen.
 */
function DailyPrices() {
  const t = useTranslations('prices');
  const tp = useTranslations('products');
  const toast = useToast();
  const { businessId, userId } = useApp();
  const router = useRouter();
  // First run: this screen is the last step of setting up, so it says so and
  // hands over to the till when it is done.
  const firstRun = useSearchParams().get('anza') === '1';
  const products = useProducts(businessId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Untouched rows read the current price; only edited rows live in state.
  const valueOf = (id: string, price: number) => values[id] ?? (price ? String(price) : '');

  const save = async () => {
    if (!businessId || !products) return;
    setBusy(true);
    const prices = new Map<string, number>();
    for (const p of products) {
      const parsed = parseTZS(valueOf(p.id, p.price));
      if (parsed != null) prices.set(p.id, parsed);
    }
    const changed = await updatePrices({ businessId, userId, prices });
    setBusy(false);
    if (firstRun) return router.replace('/mauzo');
    toast(changed ? t('updated', { count: changed }) : t('noChanges'), changed ? 'ok' : 'info');
  };

  return (
    <>
      <PageHeader
        title={firstRun ? t('firstRunTitle') : t('title')}
        subtitle={firstRun ? t('firstRunBody') : t('subtitle')}
        back={!firstRun}
      />
      <ul className="divide-y divide-line pb-24">
        {products?.map((product) => {
          const parsed = parseTZS(valueOf(product.id, product.price));
          const moved = parsed != null && parsed !== product.price;
          return (
            <li key={product.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-2xl" aria-hidden>{product.icon ?? '📦'}</span>
              <label htmlFor={`price-${product.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{productLabel(product)}</span>
                <span className="text-xs text-ink-faint">
                  /{product.unit === 'custom' ? product.unitLabel : tp(`unitsShort.${product.unit}`)} · {t('yesterday', { price: formatTZS(product.price) })}
                </span>
              </label>
              <AmountInput
                id={`price-${product.id}`}
                value={valueOf(product.id, product.price)}
                onChange={(e) => setValues((v) => ({ ...v, [product.id]: e.target.value }))}
                className={cn('w-32 shrink-0 text-lg', moved && 'border-brand bg-brand-tint')}
              />
            </li>
          );
        })}
      </ul>
      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-surface p-2.5">
        <div className="mx-auto max-w-lg">
          <Button size="xl" block disabled={busy} onClick={() => void save()}>
            {firstRun ? t('firstRunSave') : t('saveAll')}
          </Button>
          {firstRun && (
            <Button variant="ghost" block className="mt-1" onClick={() => router.replace('/mauzo')}>
              {t('firstRunSkip')}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export default function DailyPricesPage() {
  return (
    <Suspense>
      <DailyPrices />
    </Suspense>
  );
}
