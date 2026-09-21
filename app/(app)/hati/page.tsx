'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, FileText, Plus } from '@/components/icons';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Badge, EmptyState, Money, PageHeader } from '@/components/ui/bits';
import { cn } from '@/lib/cn';
import { db } from '@/lib/local/db';
import type { DocumentKind } from '@/lib/types';

const KINDS: DocumentKind[] = ['proforma', 'delivery_note', 'invoice'];

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const { businessId } = useApp();
  const [kind, setKind] = useState<DocumentKind>('proforma');

  const rows = useLiveQuery(async () => {
    if (!businessId) return [];
    const docs = await db().documents.where('[businessId+kind]').equals([businessId, kind]).toArray();
    const customers = await db().customers.bulkGet(docs.map((d) => d.customerId ?? ''));
    return docs
      .map((d, i) => ({ doc: d, customer: customers[i]?.name ?? '' }))
      .sort((a, b) => b.doc.number.localeCompare(a.doc.number));
  }, [businessId, kind]);

  return (
    <>
      <PageHeader
        title={t('title')}
        action={
          <Link href={`/hati/mpya?kind=${kind}`} aria-label={t('new')} className="flex h-12 w-12 items-center justify-center rounded-full text-brand active:bg-line/40">
            <Plus size={26} />
          </Link>
        }
      />
      <div className="flex gap-2 overflow-x-auto px-3 py-3">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn('h-11 shrink-0 rounded-full border px-4 text-sm font-semibold', k === kind ? 'border-brand bg-brand-tint text-brand-dark' : 'border-line-strong text-ink-soft')}
          >
            {t(k)}
          </button>
        ))}
      </div>
      {rows && rows.length === 0 ? <EmptyState icon={<FileText size={44} />} title={t('empty')} /> : null}
      <ul className="divide-y divide-line">
        {rows?.map(({ doc, customer }) => (
          <li key={doc.id}>
            <Link href={`/hati/${doc.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-surface">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{doc.number}</span>
                <span className="block truncate text-sm text-ink-faint">{customer}</span>
              </span>
              <Badge tone={doc.status === 'paid' ? 'brand' : doc.status === 'part_paid' ? 'debt' : 'plain'}>{t(`statuses.${doc.status}`)}</Badge>
              <Money value={doc.total} className="font-bold" />
              <ChevronRight size={20} className="text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
