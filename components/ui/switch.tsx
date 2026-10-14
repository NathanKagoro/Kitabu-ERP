'use client';

import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** A whole-row on/off switch: the row is the tap target, not a tiny knob. */
export function SwitchRow({
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={id}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-paper"
    >
      {icon ? <span className="text-brand">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span id={id} className="block font-semibold">
          {label}
        </span>
        {hint ? <span className="block text-sm text-ink-faint">{hint}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-line-strong'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-[left]',
            checked ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </span>
    </button>
  );
}
