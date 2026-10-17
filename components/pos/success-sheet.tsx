'use client';

import { CircleCheck, MessageCircle, UserPlus } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Money } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { formatTZS } from '@/lib/money';
import { receiptItemsText, receiptUrl, whatsappLink, type ReceiptLine } from '@/lib/receipt';
import type { Sale } from '@/lib/types';
import { Field, TextInput } from '@/components/ui/field';
import { formatPhone, normalisePhone } from '@/lib/auth/phone';
import { findByPhone } from '@/lib/customers';
import { createCustomer } from '@/lib/local/actions';
import { db } from '@/lib/local/db';

export interface CompletedSale {
  sale: Sale;
  lines: ReceiptLine[];
  customerPhone?: string | null;
}

export function SuccessSheet({ done, onClose }: { done: CompletedSale | null; onClose: () => void }) {
  const t = useTranslations('receipt');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const { business, businessId } = useApp();
  const [capturing, setCapturing] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  if (!done) return null;

  const close = () => {
    setCapturing(false);
    setPhone('');
    setName('');
    onClose();
  };

  /**
   * Sending the receipt to a number the customer gives is the moment to keep
   * them: the number goes on the customer list (once), ready for offers.
   */
  const remember = async () => {
    const e164 = normalisePhone(phone);
    if (!businessId || !e164) return;
    const all = await db().customers.where('businessId').equals(businessId).toArray();
    if (findByPhone(all, e164)) return;
    await createCustomer({ businessId, name: name.trim() || formatPhone(e164), phone: e164 });
  };
  const typedPhone = normalisePhone(phone);

  const link = receiptUrl(window.location.origin, done.sale.receiptToken);
  const text = t('message', {
    business: business?.name ?? '',
    items: receiptItemsText(done.lines),
    total: formatTZS(done.sale.total),
    link,
  });

  return (
    <Sheet open onClose={close} bare>
      <div className="flex flex-col items-center gap-2 px-5 pt-8 pb-5 text-center">
        <CircleCheck size={56} className="text-brand" strokeWidth={2.2} />
        <h2 className="text-2xl font-bold">{t('success')}</h2>
        <Money value={done.sale.total} symbol className="text-3xl font-bold" />
      </div>
      <div className="space-y-2 px-4 pb-5">
        {capturing && !done.customerPhone ? (
          <div className="space-y-2 rounded-[12px] border border-line-strong p-3">
            <Field label={tc('phone')} error={phone.trim().length >= 9 && !typedPhone ? ta('invalidPhone') : null}>
              {(id) => <TextInput id={id} type="tel" inputMode="tel" autoFocus placeholder={ta('phonePlaceholder')} value={phone} onChange={(e) => setPhone(e.target.value)} />}
            </Field>
            <Field label={tc('name')} hint={tc('optional')}>
              {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <a
              href={typedPhone ? whatsappLink(text, typedPhone) : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!typedPhone}
              onClick={() => void remember()}
              className={`flex h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-brand text-lg font-semibold text-white ${typedPhone ? '' : 'pointer-events-none opacity-45'}`}
            >
              <MessageCircle size={22} />
              {t('sendAndSave')}
            </a>
          </div>
        ) : null}
        <a
          href={whatsappLink(text, done.customerPhone)}
          target="_blank"
          rel="noreferrer"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface text-lg font-semibold"
        >
          <MessageCircle size={22} className="text-brand" />
          {t('sendWhatsApp')}
        </a>
        {!capturing && !done.customerPhone ? (
          <button type="button" onClick={() => setCapturing(true)} className="flex h-12 w-full items-center justify-center gap-2 font-semibold text-brand">
            <UserPlus size={20} />
            {t('saveCustomer')}
          </button>
        ) : null}
        <Button size="xl" block autoFocus onClick={close}>
          {t('newSale')}
        </Button>
      </div>
    </Sheet>
  );
}
