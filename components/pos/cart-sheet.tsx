'use client';

import { useTranslations } from 'next-intl';
import type { Dispatch } from 'react';

import { Money } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { cartSubtotal, lineTotal } from '@/lib/calc/sale';
import { parseTZS } from '@/lib/money';
import type { CartAction, CartState } from '@/lib/pos/cart';
import { formatQty } from '@/lib/units';

/** The full basket: every line, the discount, and the way to other payments. */
export function CartSheet({
  cart,
  total,
  dispatch,
  onEditLine,
  onCheckout,
  onClose,
}: {
  cart: CartState;
  total: number;
  dispatch: Dispatch<CartAction>;
  onEditLine: (lineId: string) => void;
  onCheckout: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('sales');
  const tc = useTranslations('common');

  return (
    <Sheet open onClose={onClose} title={t('cart')}>
      <ul className="divide-y divide-line">
        {cart.lines.map((line) => (
          <li key={line.id}>
            <button
              onClick={() => onEditLine(line.id)}
              className="flex min-h-16 w-full items-center gap-3 px-4 text-left active:bg-paper"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{line.description}</span>
                <span className="tnum text-sm text-ink-soft">
                  {formatQty(line.qty)} × <Money value={line.unitPrice} />
                </span>
              </span>
              <Money value={lineTotal(line)} className="font-bold" />
            </button>
          </li>
        ))}
      </ul>
      <div className="space-y-3 border-t border-line p-4">
        <div className="flex items-center justify-between text-ink-soft">
          <span>{t('subtotal')}</span>
          <Money value={cartSubtotal(cart.lines)} className="font-semibold" />
        </div>
        <Field label={t('discount')}>
          {(id) => (
            <AmountInput
              id={id}
              value={cart.discount ? String(cart.discount) : ''}
              onChange={(e) => dispatch({ type: 'setDiscount', discount: parseTZS(e.target.value) ?? 0 })}
            />
          )}
        </Field>
        <div className="flex items-center justify-between text-lg">
          <span className="font-semibold">{tc('total')}</span>
          <Money value={total} symbol className="font-bold" />
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              dispatch({ type: 'clear' });
              onClose();
            }}
          >
            {t('clearCart')}
          </Button>
          <Button size="lg" block onClick={onCheckout}>
            {t('checkout')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
