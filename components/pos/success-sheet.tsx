'use client';

import { CircleCheck, MessageCircle } from '@/components/icons';
import { useTranslations } from 'next-intl';

import { useApp } from '@/components/app-provider';
import { Money } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { formatTZS } from '@/lib/money';
import { receiptItemsText, receiptUrl, whatsappLink, type ReceiptLine } from '@/lib/receipt';
import type { Sale } from '@/lib/types';

export interface CompletedSale {
  sale: Sale;
  lines: ReceiptLine[];
  customerPhone?: string | null;
}

export function SuccessSheet({ done, onClose }: { done: CompletedSale | null; onClose: () => void }) {
  const t = useTranslations('receipt');
  const { business } = useApp();
  if (!done) return null;

  const link = receiptUrl(window.location.origin, done.sale.receiptToken);
  const text = t('message', {
    business: business?.name ?? '',
    items: receiptItemsText(done.lines),
    total: formatTZS(done.sale.total),
    link,
  });

  return (
    <Sheet open onClose={onClose} bare>
      <div className="flex flex-col items-center gap-2 px-5 pt-8 pb-5 text-center">
        <CircleCheck size={56} className="text-brand" strokeWidth={2.2} />
        <h2 className="text-2xl font-bold">{t('success')}</h2>
        <Money value={done.sale.total} symbol className="text-3xl font-bold" />
      </div>
      <div className="space-y-2 px-4 pb-5">
        <a
          href={whatsappLink(text, done.customerPhone)}
          target="_blank"
          rel="noreferrer"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface text-lg font-semibold"
        >
          <MessageCircle size={22} className="text-brand" />
          {t('sendWhatsApp')}
        </a>
        <Button size="xl" block autoFocus onClick={onClose}>
          {t('newSale')}
        </Button>
      </div>
    </Sheet>
  );
}
