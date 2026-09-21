'use client';

import { Banknote, BookUser, Smartphone, Split } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { CustomerPicker } from '@/components/customers/customer-picker';
import { Money, OptionGrid, Row } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field, TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { changeDue, creditPortion, type Tender } from '@/lib/calc/sale';
import { parseTZS } from '@/lib/money';
import { MOBILE_MONEY_METHODS, type PaymentMethod } from '@/lib/types';

type Mode = 'cash' | 'mobile' | 'credit' | 'split';

export function PaymentSheet({
  open,
  onClose,
  total,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  onConfirm: (tenders: Tender[], customerId: string | null) => void;
  busy: boolean;
}) {
  const t = useTranslations('payment');

  const [mode, setMode] = useState<Mode>('cash');
  const [tendered, setTendered] = useState('');
  const [provider, setProvider] = useState<PaymentMethod>('mpesa');
  const [reference, setReference] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);

  const tenders: Tender[] = (() => {
    switch (mode) {
      case 'cash':
        return [{ method: 'cash', amount: parseTZS(tendered) ?? total }];
      case 'mobile':
        return [{ method: provider, amount: total, reference: reference.trim() || null }];
      case 'credit':
        return [];
      case 'split':
        return [{ method: 'cash', amount: parseTZS(splitCash) ?? 0 }];
    }
  })();

  const owed = creditPortion(total, tenders);
  const change = changeDue(total, tenders);
  const needsCustomer = owed > 0;
  const cashShort = mode === 'cash' && owed > 0;
  const canConfirm = !busy && !cashShort && (!needsCustomer || customerId !== null);

  return (
    <Sheet open={open} onClose={onClose} title={t('title')}>
      <div className="space-y-5 p-4">
        <div className="text-center">
          <p className="text-sm font-medium text-ink-soft">{t('howPaid')}</p>
          <Money value={total} symbol className="text-3xl font-bold" />
        </div>

        <OptionGrid<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'cash', label: t('cash'), icon: <Banknote size={20} /> },
            { value: 'mobile', label: t('mobile'), icon: <Smartphone size={20} /> },
            { value: 'credit', label: t('credit'), icon: <BookUser size={20} /> },
            { value: 'split', label: t('split'), icon: <Split size={20} /> },
          ]}
        />

        {mode === 'cash' && (
          <Field label={t('amountPaid')} hint={t('referenceHint')}>
            {(id) => (
              <AmountInput id={id} placeholder={String(total)} value={tendered} onChange={(e) => setTendered(e.target.value)} />
            )}
          </Field>
        )}

        {mode === 'mobile' && (
          <>
            <OptionGrid<PaymentMethod>
              value={provider}
              onChange={setProvider}
              options={MOBILE_MONEY_METHODS.map((method) => ({ value: method, label: t(`methods.${method}`) }))}
            />
            <Field label={t('reference')} hint={t('referenceHint')}>
              {(id) => (
                <TextInput id={id} value={reference} autoCapitalize="characters" onChange={(e) => setReference(e.target.value)} />
              )}
            </Field>
          </>
        )}

        {mode === 'split' && (
          <Field label={t('cash')}>
            {(id) => (
              <AmountInput id={id} value={splitCash} onChange={(e) => setSplitCash(e.target.value)} />
            )}
          </Field>
        )}

        {(mode === 'credit' || mode === 'split') && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink-soft">{t('chooseCustomer')}</p>
            <CustomerPicker value={customerId} onChange={setCustomerId} />
          </div>
        )}

        <div className="rounded-[10px] bg-paper px-3">
          {owed > 0 && mode !== 'cash' ? <Row label={t('remaining')} value={<Money value={owed} />} tone="debt" /> : null}
          {change > 0 ? <Row label={t('change')} value={<Money value={change} />} tone="brand" strong /> : null}
        </div>

        {needsCustomer && !customerId && mode !== 'cash' ? (
          <p className="text-sm font-medium text-debt">{t('needCustomer')}</p>
        ) : null}

        <Button size="xl" block disabled={!canConfirm} onClick={() => onConfirm(tenders, customerId)}>
          {t('confirm')}
        </Button>
      </div>
    </Sheet>
  );
}
