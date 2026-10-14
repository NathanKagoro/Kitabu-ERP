'use client';

import { Check } from '@/components/icons';
import { cn } from '@/lib/cn';
import { BRAND_COLOURS } from '@/lib/shop-config';

/** The shop's colour: a row of swatches, each one readable under white text. */
export function ColourPicker({ value, onChange, label }: { value: string; onChange: (colour: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
      {BRAND_COLOURS.map((colour) => {
        const selected = colour.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={colour}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={colour}
            onClick={() => onChange(colour)}
            style={{ backgroundColor: colour }}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full text-white',
              selected ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''
            )}
          >
            {selected ? <Check size={22} /> : null}
          </button>
        );
      })}
    </div>
  );
}
