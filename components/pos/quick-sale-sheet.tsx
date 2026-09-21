'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Money } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Keypad, parseKeypad } from '@/components/ui/keypad';
import { Sheet } from '@/components/ui/sheet';

/**
 * Mauzo ya haraka: an amount and nothing else, for sellers who will not
 * itemise. Cash is one tap; anything else goes to the payment sheet.
 */
export function QuickSaleSheet({
  busy,
  onCash,
  onOther,
  onClose,
}: {
  busy: boolean;
  onCash: (amount: number) => void;
  onOther: (amount: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations('sales');
  const [amount, setAmount] = useState('');
  const value = Math.round(parseKeypad(amount));

  return (
    <Sheet open onClose={onClose} title={t('quickSale')}>
      <div className="space-y-4 p-4">
        <p className="text-sm text-ink-soft">{t('quickSaleHint')}</p>
        <p className="tnum text-center text-4xl font-bold">{amount ? <Money value={value} /> : '0'}</p>
        <Keypad value={amount} onChange={setAmount} />
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" disabled={value <= 0} onClick={() => onOther(value)}>
            {t('otherPayment')}
          </Button>
          <Button size="lg" block disabled={busy || value <= 0} onClick={() => onCash(value)}>
            {t('payCash')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
