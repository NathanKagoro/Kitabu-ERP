'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Logo } from '@/components/brand/logo';
import { ChevronLeft, Delete, UserRound } from '@/components/icons';
import { Key } from '@/components/pin-lock';
import { personName, takeTill } from '@/lib/auth/till';
import { cn } from '@/lib/cn';
import type { Member } from '@/lib/types';

/**
 * "Nani anauza?" Pick your name, enter your PIN, and the till is yours: every
 * sale from now on is recorded as yours, and the screens show what your role
 * allows. Shown when the app opens on a phone the shop shares, and from the
 * name chip on the till.
 */
export function WhoSelling({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const t = useTranslations('till');
  const tc = useTranslations('common');
  const tpin = useTranslations('pin');
  const ts = useTranslations('staff');
  const { tillPeople, member } = useApp();
  const [chosen, setChosen] = useState<Member | null>(null);
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = async (digit: string) => {
    if (!chosen || busy || entry.length >= 4) return;
    setError(null);
    const next = entry + digit;
    setEntry(next);
    if (next.length < 4) return;
    setBusy(true);
    const ok = await takeTill(chosen, next);
    setBusy(false);
    if (!ok) {
      setError(tpin('wrong'));
      setEntry('');
      return;
    }
    onDone?.();
  };

  if (!chosen) {
    return (
      <div className="flex min-h-dvh flex-col bg-paper px-5 pt-12 pb-8">
        <Logo size={44} className="mx-auto mb-4" />
        <h1 className="text-center text-2xl font-bold">{t('whoTitle')}</h1>
        <p className="mt-1.5 mb-6 text-center text-ink-soft">{t('whoSubtitle')}</p>
        <ul className="mx-auto grid w-full max-w-sm grid-cols-2 gap-2.5">
          {tillPeople.map((person) => (
            <li key={person.id}>
              <button
                onClick={() => setChosen(person)}
                className={cn(
                  'flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-[12px] border px-2 py-3 text-center',
                  person.id === member?.id ? 'border-brand bg-brand-tint' : 'border-line-strong bg-surface active:bg-paper'
                )}
              >
                <UserRound size={28} className="text-brand" />
                <span className="line-clamp-2 font-bold leading-tight">{personName(person, ts(`roles.${person.role}`))}</span>
                <span className="text-xs text-ink-faint">{ts(`roles.${person.role}`)}</span>
              </button>
            </li>
          ))}
        </ul>
        {onCancel ? (
          <button onClick={onCancel} className="mx-auto mt-6 h-12 px-4 font-semibold text-ink-soft">
            {tc('cancel')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between bg-paper px-6 pt-10 pb-8">
      <div className="flex flex-col items-center text-center">
        <button onClick={() => { setChosen(null); setEntry(''); setError(null); }} className="mb-4 flex h-11 items-center gap-1 self-start font-semibold text-ink-soft">
          <ChevronLeft size={22} />
          {t('notMe')}
        </button>
        <UserRound size={40} className="mb-2 text-brand" />
        <h1 className="text-2xl font-bold">{personName(chosen, ts(`roles.${chosen.role}`))}</h1>
        <p className="mt-1.5 text-ink-soft">{t('enterPin')}</p>
        <div className="mt-8 flex justify-center gap-4" aria-hidden>
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className={cn('h-4 w-4 rounded-full border-2', index < entry.length ? 'border-brand bg-brand' : 'border-line-strong')} />
          ))}
        </div>
        <p role="alert" className="mt-4 min-h-6 font-semibold text-loss">
          {error ?? ''}
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <Key key={digit} onClick={() => void press(digit)} label={digit} />
        ))}
        <div />
        <Key onClick={() => void press('0')} label="0" />
        <Key onClick={() => setEntry((current) => current.slice(0, -1))} label={<Delete size={24} />} ariaLabel={tc('delete')} muted />
      </div>
    </div>
  );
}
