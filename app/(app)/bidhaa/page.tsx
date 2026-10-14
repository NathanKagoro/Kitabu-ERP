'use client';

import { ChevronRight, Package, Plus, Search } from '@/components/icons';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Badge, EmptyState, Money, PageHeader } from '@/components/ui/bits';
import { TextInput } from '@/components/ui/field';
import { isLowStock } from '@/lib/calc/stock';
import { useProducts, useStock } from '@/lib/local/queries';
import { groupByCategory, matchesQuery } from '@/lib/products';
import { formatQty } from '@/lib/units';

/**
 * Every product, grouped by category, shades and sizes of one product listed
 * together. A cosmetics shop has hundreds of lines; search covers name,
 * shade/size, category and barcode.
 */
export default function ProductsPage() {
  const t = useTranslations('products');
  const { businessId, show, can } = useApp();
  const products = useProducts(businessId);
  const stock = useStock(businessId);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => groupByCategory((products ?? []).filter((p) => matchesQuery(p, query))), [products, query]);
  const showHeadings = groups.length > 1 || groups[0]?.category != null;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={products?.length ? t('count', { count: products.length }) : undefined}
        action={
          can('manageProducts') ? (
            <Link href="/bidhaa/mpya" aria-label={t('add')} className="flex h-12 w-12 items-center justify-center rounded-full text-brand active:bg-line/40">
              <Plus size={26} />
            </Link>
          ) : null
        }
      />

      {can('manageProducts') && (
        <div className="px-3 pt-3">
          <Link
            href="/bidhaa/ingiza"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface font-semibold text-brand active:bg-paper"
          >
            <Package size={20} />
            {t('bulk.open')}
          </Link>
        </div>
      )}

      {(products?.length ?? 0) > 8 && (
        <div className="relative px-3 pt-3">
          <Search size={18} className="absolute top-1/2 left-6 mt-1.5 -translate-y-1/2 text-ink-faint" />
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

      {products && products.length === 0 ? <EmptyState icon={<Package size={44} />} title={t('empty')} /> : null}

      {groups.map((group) => (
        <section key={group.category ?? '__none'} className="pt-3">
          {showHeadings && (
            <h2 className="px-4 pb-1 text-sm font-bold text-ink-soft">{group.category ?? t('noCategory')}</h2>
          )}
          <ul className="divide-y divide-line border-y border-line bg-surface">
            {group.items.map((product) => {
              const onHand = stock?.get(product.id) ?? 0;
              const tracked = product.trackStock && show('stockTracking');
              return (
                <li key={product.id}>
                  <Link href={`/bidhaa/hariri?id=${product.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-paper">
                    <span className="text-2xl" aria-hidden>
                      {product.icon ?? '📦'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {product.name}
                        {product.variant ? <span className="font-normal text-ink-soft"> · {product.variant}</span> : null}
                      </span>
                      <span className="text-sm text-ink-faint">
                        <Money value={product.price} /> / {product.unit === 'custom' ? product.unitLabel : t(`unitsShort.${product.unit}`)}
                      </span>
                    </span>
                    {tracked ? (
                      onHand <= 0 ? (
                        <Badge tone="loss">{t('outOfStock')}</Badge>
                      ) : isLowStock(onHand, product.lowStockLevel) ? (
                        <Badge tone="debt">
                          {t('lowStock')} · {formatQty(onHand)}
                        </Badge>
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
        </section>
      ))}
      {products && products.length > 0 && groups.length === 0 ? <p className="p-6 text-center text-ink-soft">{t('noMatch')}</p> : null}
    </>
  );
}
