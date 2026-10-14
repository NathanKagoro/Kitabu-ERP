'use client';

import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '@/lib/local/db';

import { ReceiptView, type ReceiptData } from './receipt-view';

export function LocalReceipt({ token, notFound }: { token: string; notFound: string }) {
  const receipt = useLiveQuery(async (): Promise<ReceiptData | null> => {
    const sale = await db().sales.where('receiptToken').equals(token).first();
    if (!sale) return null;
    const [business, lines] = await Promise.all([
      db().businesses.get(sale.businessId),
      db().saleLines.where('saleId').equals(sale.id).toArray(),
    ]);
    return {
      business: {
        name: business?.name ?? '',
        phone: business?.phone,
        tin: business?.tin,
        footer: business?.settings.receiptFooter,
        address: business?.settings.address,
        brandColor: business?.settings.brandColor,
        tillNumbers: business?.settings.tillNumbers,
      },
      sale: { total: sale.total, discount: sale.discount, status: sale.status, createdAt: sale.clientCreatedAt },
      lines: lines.map((l) => ({ description: l.description ?? '', qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
    };
  }, [token]);

  if (receipt === undefined) return null;
  if (!receipt) return <p className="py-16 text-center font-semibold text-ink-soft">{notFound}</p>;
  return <ReceiptView receipt={receipt} />;
}
