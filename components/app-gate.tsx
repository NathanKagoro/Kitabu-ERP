'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useApp } from '@/components/app-provider';
import { Logo } from '@/components/brand/logo';

import { isUnlockedThisSession } from '@/lib/auth/unlock';
import { isPaused } from '@/lib/shop-config';

const PausedNotice = dynamic(() => import('@/components/paused-notice').then((m) => m.PausedNotice));

const PinLock = dynamic(() => import('@/components/pin-lock').then((m) => m.PinLock));

/**
 * Decides, once the local database has answered, whether this device is ready
 * to sell: signed in, onboarded, unlocked. Everything is checked locally, so a
 * phone with no signal opens straight to the sales screen.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { ready, userId, businessId, member, business, mustSetPassword } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!userId) router.replace('/ingia');
    else if (mustSetPassword) router.replace('/neno-siri');
    else if (!businessId) router.replace('/karibu');
  }, [ready, userId, businessId, mustSetPassword, router]);

  if (!ready) return <Splash />;
  if (!userId || !businessId || mustSetPassword) return <Splash />;

  // The operator's switch, e.g. for an unpaid month. Records stay on the
  // phone and anything not yet synced still syncs; the till is closed.
  if (isPaused(business)) return <PausedNotice name={business?.name ?? ''} />;

  // A PIN is only a gate once one has been set; a new owner is not locked out
  // of their own data by a step they have not reached yet.
  if (member?.pinHash && !isUnlockedThisSession()) {
    return <PinLock mode="unlock" name={member.name ?? ''} />;
  }

  return <>{children}</>;
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper">
      <Logo size={64} />
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-brand" />
    </div>
  );
}
