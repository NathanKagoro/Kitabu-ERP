'use client';

import { Delete } from '@/components/icons';

import { cn } from '@/lib/cn';

/**
 * An on-screen keypad instead of the phone keyboard. The system keyboard covers
 * half the screen, varies by phone, and on many cheap Androids has no decimal
 * key in numeric mode -- which is a problem when selling 1.5 kg of sugar.
 */
export function Keypad({
  value,
  onChange,
  decimals = false,
  maxLength = 10,
}: {
  value: string;
  onChange: (next: string) => void;
  decimals?: boolean;
  maxLength?: number;
}) {
  const press = (key: string) => {
    if (key === 'back') return onChange(value.slice(0, -1));
    if (key === '.') {
      if (!decimals || value.includes('.')) return;
      return onChange(value === '' ? '0.' : `${value}.`);
    }
    if (value.length >= maxLength) return;
    const decimalsSoFar = value.includes('.') ? value.split('.')[1]!.length : 0;
    if (decimalsSoFar >= 3) return;
    onChange(value === '0' ? key : value + key);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals ? '.' : '000', '0', 'back'];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => (key === '000' ? onChange(value && value.length + 3 <= maxLength ? `${value}000` : value) : press(key))}
          aria-label={key === 'back' ? 'Delete' : key}
          className={cn(
            'flex h-14 items-center justify-center rounded-[10px] text-2xl font-semibold active:bg-line/60',
            key === 'back' ? 'text-ink-soft' : 'border border-line bg-paper'
          )}
        >
          {key === 'back' ? <Delete size={24} /> : key}
        </button>
      ))}
    </div>
  );
}

export function parseKeypad(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
