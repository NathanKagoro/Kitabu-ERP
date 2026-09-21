'use client';

import { ChevronRight, Package, Plus } from '@/components/icons';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { useApp } from '@/components/app-provider';
import { Badge, EmptyState, Money, PageHeader } from '@/components/ui/bits';
import { isLowStock } from '@/lib/calc/stock';
import { useProducts, useStock } from '@/lib/local/queries';
import { formatQty } from '@/lib/units';

export default function ProductsPage() {
  const t = useTranslations('products');
  const { businessId, show, can } = useApp();
  const products = useProducts(businessId);
  const stock = useStock(businessId);

  return (
    <>
      <PageHeader
        title={t('title')}
        action={
          can('manageProducts') ? (
            <Link href="/bidhaa/mpya" aria-label={t('add')} className="flex h-12 w-12 items-center justify-center rounded-full text-brand active:bg-line/40">
              <Plus size={26} />
            </Link>
          ) : null
        }
      />
      {products && products.length === 0 ? <EmptyState icon={<Package size={44} />} title={t('empty')} /> : null}
      <ul className="divide-y divide-line">
        {products?.map((product) => {
          const onHand = stock?.get(product.id) ?? 0;
          const tracked = product.trackStock && show('stockTracking');
          return (
            <li key={product.id}>
              <Link href={`/bidhaa/${product.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-surface">
                <span className="text-2xl" aria-hidden>{product.icon ?? '📦'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{product.name}</span>
                  <span className="text-sm text-ink-faint">
                    <Money value={product.price} /> / {product.unit === 'custom' ? product.unitLabel : t(`unitsShort.${product.unit}`)}
                  </span>
                </span>
                {tracked ? (
                  onHand <= 0 ? (
                    <Badge tone="loss">{t('outOfStock')}</Badge>
                  ) : isLowStock(onHand, product.lowStockLevel) ? (
                    <Badge tone="debt">{t('lowStock')} · {formatQty(onHand)}</Badge>
                  ) : (
                    <Badge>{formatQty(onHand)}</Badge>
                  )
                ) : null}
                <ChevronRight size={20} className="shrink-0 text-ink-faint" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
