'use client';

import { Plus, Trash2 } from '@/components/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { CustomerPicker } from '@/components/customers/customer-picker';
import { Money, PageHeader, Row } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field, Select, TextInput } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { vatBreakdown } from '@/lib/calc/sale';
import { createDocument, type DocLineInput } from '@/lib/local/documents';
import { useProducts } from '@/lib/local/queries';
import { parseTZS } from '@/lib/money';
import { formatQty } from '@/lib/units';
import type { DocumentKind } from '@/lib/types';

function NewDocument() {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const kind = (['proforma', 'delivery_note', 'invoice'].includes(params.get('kind') ?? '') ? params.get('kind') : 'proforma') as DocumentKind;
  const { businessId, userId, vatRate } = useApp();
  const products = useProducts(businessId);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [lines, setLines] = useState<DocLineInput[]>([]);
  const [productId, setProductId] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');

  const pickProduct = (id: string) => {
    setProductId(id);
    const product = products?.find((p) => p.id === id);
    if (product) {
      setDescription(product.name);
      setPrice(String(product.price));
    }
  };

  const addLine = () => {
    const q = Number(qty);
    const p = parseTZS(price);
    if (!description.trim()) return toast(te('productRequired'), 'warn');
    if (!(q > 0)) return toast(te('qtyPositive'), 'warn');
    if (p == null) return toast(te('amountRequired'), 'warn');
    const product = products?.find((x) => x.id === productId);
    setLines((c) => [...c, { productId: productId || null, description: description.trim(), qty: q, unitPrice: p, vatType: product?.vatType ?? 'standard' }]);
    setProductId('');
    setDescription('');
    setQty('1');
    setPrice('');
  };

  const totals = vatBreakdown(lines.map((l) => ({ lineTotal: Math.round(l.qty * l.unitPrice), vatType: l.vatType })), vatRate);

  const save = async () => {
    if (!businessId || !customerId || lines.length === 0) return;
    const doc = await createDocument({ businessId, userId, kind, customerId, lines, vatRate, notes: notes || null, dueDate: dueDate || null });
    toast(tc('saved'));
    router.replace(`/hati/${doc.id}`);
  };

  return (
    <>
      <PageHeader title={t('newOf', { kind: t(kind) })} />
      <div className="space-y-5 p-4">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink-soft">{t('customerLabel')}</p>
          <CustomerPicker value={customerId} onChange={setCustomerId} />
        </div>

        <section className="card space-y-3 p-4">
          <p className="font-semibold">{t('addLine')}</p>
          <Select value={productId} onChange={(e) => pickProduct(e.target.value)} aria-label={t('linesLabel')}>
            <option value="">—</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Field label={t('descriptionLabel')}>{(id) => <TextInput id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tc('quantity')}>{(id) => <AmountInput id={id} value={qty} onChange={(e) => setQty(e.target.value)} />}</Field>
            <Field label={tc('price')}>{(id) => <AmountInput id={id} value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
          </div>
          <Button variant="secondary" block onClick={addLine}>
            <Plus size={20} />
            {tc('add')}
          </Button>
        </section>

        {lines.length > 0 && (
          <section className="card px-4 py-2">
            {lines.map((line, index) => (
              <div key={index} className="flex items-center gap-2 border-b border-line py-2 last:border-0">
                <span className="flex-1">
                  {line.description} × {formatQty(line.qty)}
                </span>
                <Money value={Math.round(line.qty * line.unitPrice)} className="font-semibold" />
                <button aria-label={tc('delete')} className="flex h-12 w-10 items-center justify-center text-loss" onClick={() => setLines((c) => c.filter((_, i) => i !== index))}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <Row label={t('subtotal')} value={<Money value={totals.subtotal} />} />
            <Row label={t('vat', { rate: Math.round(vatRate * 100) })} value={<Money value={totals.vat} />} />
            <Row label={t('total')} value={<Money value={totals.total} symbol />} strong />
          </section>
        )}

        {kind === 'invoice' && (
          <Field label={t('dueDate')} hint={tc('optional')}>
            {(id) => <TextInput id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
          </Field>
        )}
        <Field label={t('notes')} hint={tc('optional')}>
          {(id) => <TextInput id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>

        <Button size="xl" block disabled={!customerId || lines.length === 0} onClick={() => void save()}>
          {tc('save')}
        </Button>
      </div>
    </>
  );
}

export default function NewDocumentPage() {
  return (
    <Suspense>
      <NewDocument />
    </Suspense>
  );
}
