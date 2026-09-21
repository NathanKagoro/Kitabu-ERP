'use client';

import { Trash2 } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Money } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Keypad, parseKeypad } from '@/components/ui/keypad';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import type { CartLine } from '@/lib/calc/sale';
import { lineTotal } from '@/lib/calc/sale';
import { formatQty } from '@/lib/units';

/**
 * Quantity and price for one line. Price override is a first-class control, not
 * a hidden one: bargaining is how most of these sales actually end.
 */
interface Props {
  line: CartLine | null;
  decimals: boolean;
  onClose: () => void;
  onSave: (qty: number, unitPrice: number) => void;
  onRemove: () => void;
}

export function LineEditor(props: Props) {
  if (!props.line) return null;
  // Keyed by line so the keypad starts from that line's values each time.
  return <Editor key={props.line.id} {...props} line={props.line} />;
}

function Editor({
  line,
  decimals,
  onClose,
  onSave,
  onRemove,
}: {
  line: CartLine;
  decimals: boolean;
  onClose: () => void;
  onSave: (qty: number, unitPrice: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('sales');
  const tc = useTranslations('common');
  const [field, setField] = useState<'qty' | 'price'>(line.unitPrice === 0 ? 'price' : 'qty');
  const [qty, setQty] = useState(formatQty(line.qty));
  const [price, setPrice] = useState(line.unitPrice ? String(line.unitPrice) : '');

  const nextQty = parseKeypad(qty);
  const nextPrice = Math.round(parseKeypad(price));

  return (
    <Sheet open onClose={onClose} title={line.description}>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          {(['qty', 'price'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setField(key)}
              className={cn(
                'rounded-[10px] border px-3 py-2 text-left',
                field === key ? 'border-brand bg-brand-tint' : 'border-line-strong'
              )}
            >
              <span className="block text-xs font-semibold text-ink-soft">
                {key === 'qty' ? t('setQuantity') : t('priceOverride')}
              </span>
              <span className="tnum block text-2xl font-bold">{key === 'qty' ? qty || '0' : price || '0'}</span>
            </button>
          ))}
        </div>

        <p className="text-center text-ink-soft">
          {tc('total')}: <Money value={lineTotal({ qty: nextQty, unitPrice: nextPrice })} className="font-bold text-ink" />
        </p>

        <Keypad
          value={field === 'qty' ? qty : price}
          onChange={field === 'qty' ? setQty : setPrice}
          decimals={field === 'qty' && decimals}
        />

        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={onRemove} aria-label={t('removeLine')}>
            <Trash2 size={20} className="text-loss" />
          </Button>
          <Button size="lg" block disabled={nextQty <= 0} onClick={() => onSave(nextQty, nextPrice)}>
            {tc('save')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
