import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/*
 * Every button is at least 48px tall. Not a guideline here -- a mis-tap at a
 * busy stall costs a sale, and the person tapping is often holding a bag of
 * tomatoes in the other hand.
 */
const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold ' +
    'transition-colors select-none disabled:opacity-45 disabled:pointer-events-none active:scale-[0.99]',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white active:bg-brand-dark',
        secondary: 'bg-surface text-ink border border-line-strong active:bg-paper',
        ghost: 'bg-transparent text-ink-soft active:bg-line/40',
        danger: 'bg-loss text-white active:brightness-90',
        debt: 'bg-debt text-white active:brightness-90',
      },
      size: {
        sm: 'h-11 px-3 text-sm',
        md: 'h-12 px-4',
        lg: 'h-14 px-5 text-lg',
        xl: 'h-16 px-6 text-xl',
        icon: 'h-12 w-12',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  children?: ReactNode;
}

export function Button({ className, variant, size, block, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant, size, block }), className)} {...props} />;
}
