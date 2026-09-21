'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useApp } from '@/components/app-provider';
import { draftFrom, ProductForm } from '@/components/products/product-form';
import { EmptyState, PageHeader } from '@/components/ui/bits';
import { useToast } from '@/components/ui/toast';
import { nowIso } from '@/lib/date';
import { saveProduct } from '@/lib/local/actions';
import { db } from '@/lib/local/db';
import { uuidv7 } from '@/lib/uuid';

export default function NewProductPage() {
  const t = useTranslations('products');
  const tc = useTranslations('common');
  const router = useRouter();
  const toast = useToast();
  const te = useTranslations('errors');
  const { businessId, can } = useApp();

  if (!can('manageProducts')) return <><PageHeader title={t('add')} /><EmptyState title={te('noAccess')} /></>;

  return (
    <>
      <PageHeader title={t('add')} />
      <ProductForm
        initial={draftFrom(null)}
        submitLabel={tc('save')}
        onSubmit={async (draft) => {
          if (!businessId) return;
          const count = await db().products.where('businessId').equals(businessId).count();
          const at = nowIso();
          await saveProduct({
            ...draft,
            id: uuidv7(),
            businessId,
            photoUrl: null,
            sortOrder: count,
            active: true,
            createdAt: at,
            updatedAt: at,
            deletedAt: null,
          });
          toast(tc('saved'));
          router.back();
        }}
      />
    </>
  );
}
