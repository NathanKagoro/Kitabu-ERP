'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Download, HandCoins, MessageCircle } from '@/components/icons';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Badge, Money, OptionGrid, PageHeader, Row } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { convertDocument, documentPaid, recordDocumentPayment } from '@/lib/local/documents';
import { db } from '@/lib/local/db';
import { formatTZS, parseTZS } from '@/lib/money';
import { buildDocumentPdf } from '@/lib/pdf';
import { whatsappLink } from '@/lib/receipt';
import { formatQty } from '@/lib/units';
import type { PaymentMethod } from '@/lib/types';

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('documents');
  const tp = useTranslations('payment');
  const tc = useTranslations('common');
  const router = useRouter();
  const toast = useToast();
  const { business, businessId, userId, vatRate } = useApp();
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank');

  const data = useLiveQuery(async () => {
    const doc = await db().documents.get(id);
    if (!doc) return null;
    const [lines, customer, parent, paid] = await Promise.all([
      db().documentLines.where('documentId').equals(id).toArray(),
      doc.customerId ? db().customers.get(doc.customerId) : undefined,
      doc.parentId ? db().documents.get(doc.parentId) : undefined,
      documentPaid(id),
    ]);
    return { doc, lines, customer: customer ?? null, parent: parent ?? null, paid };
  }, [id]);

  if (!data || !business || !businessId) return <PageHeader title={t('title')} />;
  const { doc, lines, customer, parent, paid } = data;
  const due = Math.max(doc.total - paid, 0);

  const convert = async (kind: 'delivery_note' | 'invoice') => {
    const created = await convertDocument(doc.id, kind, { businessId, userId, vatRate });
    router.replace(`/hati/${created.id}`);
  };

  const pdf = async () => {
    const bytes = await buildDocumentPdf({
      business,
      document: doc,
      lines,
      customer,
      labels: {
        title: t(doc.kind).toUpperCase(),
        subtotal: t('subtotal'),
        vat: t('vat', { rate: Math.round(vatRate * 100) }),
        total: t('total'),
        customer: t('customerLabel'),
        payTo: business.name,
      },
    });
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    const file = new File([blob], `${doc.number}.pdf`, { type: 'application/pdf' });
    // Android Chrome can share a file straight into WhatsApp; fall back to download.
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: doc.number }).catch(() => undefined);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.number}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const message = t('message', { kind: t(doc.kind), number: doc.number, business: business.name, total: formatTZS(doc.total) });

  return (
    <>
      <PageHeader title={doc.number} subtitle={customer?.name} />
      <div className="space-y-3 p-3">
        <section className="card px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <Badge>{t(doc.kind)}</Badge>
            <Badge tone={doc.status === 'paid' ? 'brand' : doc.status === 'part_paid' ? 'debt' : 'plain'}>{t(`statuses.${doc.status}`)}</Badge>
            {parent ? <span className="text-xs text-ink-faint">{t('convertedFrom', { number: parent.number })}</span> : null}
          </div>
          {lines.map((line) => (
            <Row key={line.id} label={`${line.description} × ${formatQty(line.qty)}`} value={<Money value={line.lineTotal} />} />
          ))}
          <div className="mt-1 border-t border-line pt-1">
            <Row label={t('subtotal')} value={<Money value={doc.subtotal} />} />
            <Row label={t('vat', { rate: Math.round(vatRate * 100) })} value={<Money value={doc.vat} />} />
            <Row label={t('total')} value={<Money value={doc.total} symbol />} strong />
            {doc.kind === 'invoice' && (
              <>
                <Row label={t('paidAmount')} value={<Money value={paid} />} tone="brand" />
                <Row label={t('balanceDue')} value={<Money value={due} />} tone="debt" strong />
              </>
            )}
          </div>
        </section>

        {doc.kind === 'proforma' && (
          <Button size="lg" block onClick={() => void convert('delivery_note')}>
            <ArrowRight size={20} />
            {t('convertToDelivery')}
          </Button>
        )}
        {doc.kind !== 'invoice' && (
          <Button size="lg" block variant={doc.kind === 'proforma' ? 'secondary' : 'primary'} onClick={() => void convert('invoice')}>
            <ArrowRight size={20} />
            {t('convertToInvoice')}
          </Button>
        )}
        {doc.kind === 'invoice' && due > 0 && (
          <Button size="lg" block onClick={() => { setAmount(String(due)); setPaying(true); }}>
            <HandCoins size={20} />
            {t('recordPayment')}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => void pdf()}>
            <Download size={20} />
            {t('downloadPdf')}
          </Button>
          <a
            href={whatsappLink(message, customer?.phone)}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface font-semibold"
          >
            <MessageCircle size={20} className="text-brand" />
            {t('sendWhatsApp')}
          </a>
        </div>
      </div>

      <Sheet open={paying} onClose={() => setPaying(false)} title={t('recordPayment')}>
        <div className="space-y-3 p-4">
          <Field label={tc('amount')}>{(fid) => <AmountInput id={fid} big value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          <OptionGrid<PaymentMethod>
            value={method}
            onChange={setMethod}
            columns={3}
            options={(['bank', 'cash', 'mpesa', 'mixx', 'airtel', 'halopesa'] as const).map((m) => ({ value: m, label: tp(`methods.${m}`) }))}
          />
          <Button
            size="lg"
            block
            onClick={() =>
              void (async () => {
                const value = parseTZS(amount);
                if (!value || value <= 0) return;
                await recordDocumentPayment({ businessId, userId, documentId: doc.id, amount: value, method });
                toast(tc('saved'));
                setPaying(false);
              })()
            }
          >
            {tc('save')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
