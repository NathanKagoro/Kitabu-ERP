'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

import { useApp } from '@/components/app-provider';
import { draftFrom, ProductForm } from '@/components/products/product-form';
import { EmptyState, PageHeader } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';
import { nowIso } from '@/lib/date';
import { saveProduct, saveProductPacks } from '@/lib/local/actions';
import { db } from '@/lib/local/db';
import { uuidv7 } from '@/lib/uuid';
import { presetOf } from '@/lib/shop-config';

/**
 * ?kutoka=<id> starts from an existing product -- "another shade of this" --
 * with the same name, category, prices and unit, and the shade left blank.
 */
export default function NewProductRoute() {
  return (
    <Suspense>
      <NewProductPage />
    </Suspense>
  );
}

function NewProductPage() {
  const t = useTranslations('products');
  const tc = useTranslations('common');
  const router = useRouter();
  const toast = useToast();
  const te = useTranslations('errors');
  const { businessId, can, business, show } = useApp();
  const fromId = useSearchParams().get('kutoka');
  // undefined while loading, null when there is no sibling to copy.
  const sibling = useLiveQuery(async () => (fromId ? ((await db().products.get(fromId)) ?? null) : null), [fromId]);

  if (!can('manageProducts')) return <><PageHeader title={t('add')} /><EmptyState title={te('noAccess')} /></>;

  return (
    <>
      <PageHeader title={t('add')} />
      {sibling === undefined ? null : (
      <ProductForm
        key={sibling?.id ?? 'new'}
        initial={
          sibling
            ? { ...draftFrom({ ...sibling, variant: null, barcode: null, sku: null }), packs: [] }
            : draftFrom(null, [], { unit: presetOf(business).defaultUnit, trackStock: show('stockTracking') })
        }
        submitLabel={tc('save')}
        onSubmit={async (draft) => {
          if (!businessId) return;
          const count = await db().products.where('businessId').equals(businessId).count();
          const at = nowIso();
          const { packs, ...fields } = draft;
          const id = uuidv7();
          await saveProduct({
            ...fields,
            id,
            businessId,
            photoUrl: null,
            sortOrder: count,
            active: true,
            createdAt: at,
            updatedAt: at,
            deletedAt: null,
          });
          await saveProductPacks({
            businessId,
            productId: id,
            packs: packs.map((pack) => ({ id: pack.id, label: pack.label, units: Number(pack.units) })),
          });
          toast(tc('saved'));
          router.back();
        }}
      />
      )}
    </>
  );
}
