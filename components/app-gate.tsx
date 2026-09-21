'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useApp } from '@/components/app-provider';

import { isUnlockedThisSession } from '@/lib/auth/unlock';

const PinLock = dynamic(() => import('@/components/pin-lock').then((m) => m.PinLock));

/**
 * Decides, once the local database has answered, whether this device is ready
 * to sell: signed in, onboarded, unlocked. Everything is checked locally, so a
 * phone with no signal opens straight to the sales screen.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { ready, userId, businessId, member } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!userId) router.replace('/ingia');
    else if (!businessId) router.replace('/karibu');
  }, [ready, userId, businessId, router]);

  if (!ready) return <Splash />;
  if (!userId || !businessId) return <Splash />;

  // A PIN is only a gate once one has been set; a new owner is not locked out
  // of their own data by a step they have not reached yet.
  if (member?.pinHash && !isUnlockedThisSession()) {
    return <PinLock mode="unlock" name={member.name ?? ''} />;
  }

  return <>{children}</>;
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-line border-t-brand" />
    </div>
  );
}
