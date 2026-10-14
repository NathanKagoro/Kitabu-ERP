import { useTranslations } from 'next-intl';

import { Logo } from '@/components/brand/logo';
import { formatTZS } from '@/lib/money';
import { formatQty } from '@/lib/units';
import { brandColorOf } from '@/lib/shop-config';
import type { PaymentMethod } from '@/lib/types';

export interface ReceiptData {
  business: {
    name: string;
    phone?: string | null;
    tin?: string | null;
    footer?: string | null;
    address?: string | null;
    brandColor?: string | null;
    tillNumbers?: Partial<Record<PaymentMethod, string>> | null;
  };
  sale: { total: number; discount: number; status: string; createdAt: string };
  lines: { description: string; qty: number; unitPrice: number; lineTotal: number }[];
}

/** Rendered on the server for customers, and on the seller's phone offline. */
export function ReceiptView({ receipt }: { receipt: ReceiptData }) {
  const t = useTranslations('receipt');
  const tc = useTranslations('common');
  const tsales = useTranslations('sales');
  const tpay = useTranslations('payment');
  const tills = Object.entries(receipt.business.tillNumbers ?? {}).filter(
    (entry): entry is [PaymentMethod, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''
  );
  const date = new Date(receipt.sale.createdAt).toLocaleString('sw-TZ', { timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short' });

  return (
    <article className="card overflow-hidden">
      {/* The shop's own colour: a customer opening this link has no theme loaded. */}
      <header
        className="border-b border-line px-5 py-4 text-white"
        style={{ backgroundColor: brandColorOf({ settings: { brandColor: receipt.business.brandColor ?? undefined } }) }}
      >
        <h1 className="text-xl font-bold">{receipt.business.name}</h1>
        {receipt.business.address ? <p className="text-sm opacity-90">{receipt.business.address}</p> : null}
        {receipt.business.phone ? <p className="text-sm opacity-90">{receipt.business.phone}</p> : null}
        {receipt.business.tin ? <p className="text-sm opacity-90">TIN {receipt.business.tin}</p> : null}
      </header>
      <div className="px-5 py-4">
        <p className="text-sm font-semibold text-ink-soft">{t('header')}</p>
        <p className="text-sm text-ink-faint">{date}</p>
        {receipt.sale.status === 'void' ? (
          <p className="mt-3 rounded-[10px] bg-loss-tint px-3 py-2 font-semibold text-loss">{t('voidedNotice')}</p>
        ) : null}
        <ul className="mt-4 space-y-2">
          {receipt.lines.map((line, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span>
                {line.description}
                <span className="text-ink-faint"> × {formatQty(line.qty)}</span>
              </span>
              <span className="tnum font-semibold">{formatTZS(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {receipt.sale.discount > 0 ? (
          <p className="mt-3 flex justify-between text-sm text-ink-soft">
            <span>{tsales('discount')}</span>
            <span className="tnum">-{formatTZS(receipt.sale.discount)}</span>
          </p>
        ) : null}
        <p className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-bold">
          <span>{tc('total')}</span>
          <span className="tnum">TSh {formatTZS(receipt.sale.total)}</span>
        </p>
        {tills.length ? (
          <ul className="mt-5 space-y-1 rounded-[10px] bg-paper px-3 py-2.5 text-sm">
            {tills.map(([method, number]) => (
              <li key={method} className="flex justify-between gap-3">
                <span className="text-ink-soft">{tpay(`methods.${method}`)}</span>
                <span className="tnum font-semibold">{number}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-6 text-center text-sm text-ink-soft">{receipt.business.footer || t('thanks')}</p>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <Logo size={16} />
          Kitabu
        </p>
      </div>
    </article>
  );
}
