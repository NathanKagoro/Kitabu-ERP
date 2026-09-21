'use client';

import { Check, Info, TriangleAlert } from '@/components/icons';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/cn';

type Tone = 'ok' | 'warn' | 'info';

interface ToastState {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

/**
 * Confirmation appears at the top, not the bottom: on this app the bottom of
 * the screen is where the thumb and the primary button live, and a toast there
 * would cover the thing the user is about to tap next.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, tone: Tone = 'ok') => {
    const id = ++counter.current;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 2600);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-[calc(env(safe-area-inset-top,0px)+12px)]"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'fade-in flex max-w-md items-center gap-2.5 rounded-[10px] border px-3.5 py-3 text-[15px] font-semibold',
              toast.tone === 'ok' && 'border-brand bg-brand text-white',
              toast.tone === 'warn' && 'border-loss bg-loss text-white',
              toast.tone === 'info' && 'border-line-strong bg-surface text-ink'
            )}
          >
            {toast.tone === 'ok' && <Check size={20} className="shrink-0" />}
            {toast.tone === 'warn' && <TriangleAlert size={20} className="shrink-0" />}
            {toast.tone === 'info' && <Info size={20} className="shrink-0" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
