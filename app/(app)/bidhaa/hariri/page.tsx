'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { draftFrom, ProductForm } from '@/components/products/product-form';
import { EmptyState, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { stockOnHand } from '@/lib/calc/stock';
import { adjustStock, archiveProduct, saveProduct, saveProductPacks } from '@/lib/local/actions';
import { db } from '@/lib/local/db';
import { formatQty } from '@/lib/units';
import Link from 'next/link';
import { Plus } from '@/components/icons';
import { productLabel } from '@/lib/products';
import { presetOf } from '@/lib/shop-config';

/** Static hosting has no per-record pages, so the record comes in as ?id=. */
export default function EditProductPageRoute() {
  return (
    <Suspense>
      <EditProductPage />
    </Suspense>
  );
}

function EditProductPage() {
  const id = useSearchParams().get('id') ?? '';
  const t = useTranslations('products');
  const tc = useTranslations('common');
  const router = useRouter();
  const toast = useToast();
  const te = useTranslations('errors');
  const { businessId, userId, show, can, business } = useApp();
  const [counted, setCounted] = useState('');

  const data = useLiveQuery(async () => {
    const product = await db().products.get(id);
    if (!product) return null;
    const [movements, packs] = await Promise.all([
      db().stockMovements.where('productId').equals(id).toArray(),
      db().productPacks.where('productId').equals(id).toArray(),
    ]);
    return { product, packs, onHand: stockOnHand(movements) };
  }, [id]);

  if (!data) return <PageHeader title={t('edit')} />;
  // Mirrors RLS: an edit the server would refuse must not look saved here.
  if (!can('manageProducts')) return <><PageHeader title={data.product.name} /><EmptyState title={te('noAccess')} /></>;
  const { product, onHand } = data;
  const variantLabel = presetOf(business).productFields.includes('variant') ? presetOf(business).variantLabel : null;

  return (
    <>
      <PageHeader title={productLabel(product)} />
      <ProductForm
        key={product.id}
        initial={draftFrom(product, data.packs)}
        submitLabel={tc('save')}
        onSubmit={async (draft) => {
          const { packs, ...fields } = draft;
          await saveProduct({ ...product, ...fields });
          if (businessId) {
            await saveProductPacks({
              businessId,
              productId: product.id,
              packs: packs.map((pack) => ({ id: pack.id, label: pack.label, units: Number(pack.units) })),
            });
          }
          toast(tc('saved'));
          router.back();
        }}
      />

      {product.trackStock && show('stockTracking') && businessId && (
        <section className="card mx-4 mb-4 space-y-3 p-4">
          <p className="font-semibold">{t('inStock', { qty: formatQty(onHand) })}</p>
          <Field label={tc('quantity')}>
            {(fieldId) => <AmountInput id={fieldId} value={counted} placeholder={formatQty(onHand)} onChange={(e) => setCounted(e.target.value)} />}
          </Field>
          <Button
            variant="secondary"
            block
            disabled={counted.trim() === '' || !Number.isFinite(Number(counted))}
            onClick={() =>
              void adjustStock({ businessId, userId, productId: product.id, countedQty: Number(counted) }).then(() => {
                setCounted('');
                toast(tc('saved'));
              })
            }
          >
            {tc('save')}
          </Button>
        </section>
      )}

      {variantLabel && (
        <div className="px-4 pb-2">
          <Link
            href={`/bidhaa/mpya?kutoka=${product.id}`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface font-semibold text-brand active:bg-paper"
          >
            <Plus size={20} />
            {t(`anotherVariant.${variantLabel}`)}
          </Link>
        </div>
      )}

      <div className="px-4 pb-6">
        <Button
          variant="ghost"
          block
          className="text-loss"
          onClick={() =>
            void archiveProduct(product).then(() => {
              toast(t('archived'));
              router.back();
            })
          }
        >
          {t('archive')}
        </Button>
      </div>
    </>
  );
}
