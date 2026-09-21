'use client';

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink-soft">
        {label}
        {hint ? <span className="ml-1.5 font-normal text-ink-faint">({hint})</span> : null}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="text-sm font-medium text-loss">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputStyles =
  'w-full h-14 px-3.5 rounded-[10px] bg-surface border border-line-strong text-ink ' +
  'placeholder:text-ink-faint focus:border-brand focus:outline-none';

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputStyles, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputStyles, 'h-auto min-h-24 py-3', className)} {...props} />;
}

/**
 * Money and quantity inputs. `inputMode="decimal"` is what actually raises the
 * numeric keypad on Android -- `type="number"` brings spinners nobody wants and
 * rejects the commas people naturally type.
 */
export function AmountInput({
  className,
  big = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { big?: boolean }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn(
        inputStyles,
        'tnum text-right font-semibold',
        big && 'h-16 text-2xl',
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cn(inputStyles, 'appearance-none pr-10', className)} {...props}>
      {children}
    </select>
  );
}
