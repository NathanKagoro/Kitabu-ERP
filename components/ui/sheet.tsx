'use client';

import { X } from '@/components/icons';
import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Hides the header entirely, for sheets that are their own heading. */
  bare?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A bottom sheet rather than a centre dialog: the bottom of the screen is the
 * only part of a 6" phone a thumb reaches without re-gripping.
 *
 * Hand-rolled instead of pulling in a dialog library -- this is the one
 * interactive primitive the sales screen needs, and it is about forty lines.
 */
export function Sheet({ open, onClose, title, bare = false, children, className }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    // Stop the page behind from scrolling under the sheet.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus in, so a screen reader and a keyboard both land in the sheet.
    const focusable = panel.current?.querySelector<HTMLElement>(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-ink/45"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'sheet-enter relative w-full max-w-lg rounded-t-2xl bg-surface',
          'max-h-[92vh] overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]',
          className
        )}
      >
        {!bare && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 flex h-12 w-12 items-center justify-center rounded-full text-ink-soft active:bg-paper"
            >
              <X size={22} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
