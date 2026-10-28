'use client';

import { Delete } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useApp } from '@/components/app-provider';
import { hashPin, verifyPin, type PinHash } from '@/lib/auth/pin';
import { signOut } from '@/lib/auth/session';
import { markUnlocked } from '@/lib/auth/unlock';
import { persist } from '@/lib/local/write';
import { cn } from '@/lib/cn';
import type { Member } from '@/lib/types';

type Mode = 'set' | 'unlock';

/**
 * A 4-digit keypad rather than a text field: it is the same gesture as
 * unlocking M-Pesa, which is the interaction every user here already knows.
 */
export function PinLock({
  mode,
  name,
  onDone,
  target,
  onCancel,
}: {
  mode: Mode;
  name?: string;
  onDone?: () => void;
  /** Whose PIN to set; defaults to the person at the till. Used to give staff their till PIN. */
  target?: Member;
  onCancel?: () => void;
}) {
  const t = useTranslations('pin');
  const tc = useTranslations('common');
  const router = useRouter();
  const { member } = useApp();

  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirming = mode === 'set' && firstPin !== null;

  const complete = useCallback(
    async (pin: string) => {
      setBusy(true);
      try {
        if (mode === 'unlock') {
          const stored = member?.pinHash ? (JSON.parse(member.pinHash) as PinHash) : null;
          if (await verifyPin(pin, stored)) {
            await markUnlocked();
            onDone?.();
            router.refresh();
          } else {
            setError(t('wrong'));
            setEntry('');
          }
          return;
        }

        if (firstPin === null) {
          setFirstPin(pin);
          setEntry('');
          return;
        }

        if (firstPin !== pin) {
          setError(t('mismatch'));
          setFirstPin(null);
          setEntry('');
          return;
        }

        const who = target ?? member;
        if (who) {
          const hash = await hashPin(pin);
          await persist('members', { ...who, pinHash: JSON.stringify(hash), updatedAt: new Date().toISOString() });
        }
        await markUnlocked();
        onDone?.();
      } finally {
        setBusy(false);
      }
    },
    [mode, member, target, firstPin, onDone, router, t]
  );

  const press = (digit: string) => {
    if (busy || entry.length >= 4) return;
    setError(null);
    const next = entry + digit;
    setEntry(next);
    if (next.length === 4) void complete(next);
  };

  const title = mode === 'unlock' ? t('unlockTitle') : confirming ? t('confirmTitle') : t('setTitle');

  return (
    <div className="flex min-h-dvh flex-col justify-between bg-paper px-6 pt-12 pb-8">
      <div className="flex flex-col items-center text-center">
        <Logo size={48} className="mb-4" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1.5 text-ink-soft">
          {mode === 'unlock' ? (name ? t('unlockSubtitle', { name }) : '') : target ? t('setForSubtitle', { name: target.name ?? '' }) : t('setSubtitle')}
        </p>

        <div className="mt-10 flex justify-center gap-4" aria-hidden>
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                'h-4 w-4 rounded-full border-2 transition-colors',
                index < entry.length ? 'border-brand bg-brand' : 'border-line-strong bg-transparent'
              )}
            />
          ))}
        </div>

        <p role="alert" className="mt-4 min-h-6 font-semibold text-loss">
          {error ?? ''}
        </p>
      </div>

      <div>
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <Key key={digit} onClick={() => press(digit)} label={digit} />
          ))}
          <div />
          <Key onClick={() => press('0')} label="0" />
          <Key
            onClick={() => setEntry((current) => current.slice(0, -1))}
            label={<Delete size={24} />}
            ariaLabel={tc('delete')}
            muted
          />
        </div>

        {mode === 'unlock' ? (
          <div className="mt-6 text-center">
            <button
              onClick={() => void signOut().then(() => router.replace('/ingia'))}
              className="h-12 px-4 text-sm font-semibold text-ink-soft underline"
            >
              {t('forgot')}
            </button>
            <p className="mt-1 text-xs text-ink-faint">{t('forgotHelp')}</p>
          </div>
        ) : (
          <Button
            variant="ghost"
            block
            className="mt-6"
            onClick={() => {
              if (onCancel && firstPin === null) return onCancel();
              setFirstPin(null);
              setEntry('');
              setError(null);
            }}
          >
            {tc('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function Key({
  label,
  onClick,
  ariaLabel,
  muted = false,
}: {
  label: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex h-16 items-center justify-center rounded-[10px] text-2xl font-semibold active:bg-line/50',
        muted ? 'text-ink-soft' : 'border border-line-strong bg-surface text-ink'
      )}
    >
      {label}
    </button>
  );
}
