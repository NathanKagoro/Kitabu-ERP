'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useApp } from '@/components/app-provider';
import { PinLock } from '@/components/pin-lock';

export default function SetPinPage() {
  const router = useRouter();
  const { ready, member, userId } = useApp();

  useEffect(() => {
    if (ready && !userId) router.replace('/ingia');
  }, [ready, userId, router]);

  if (!ready || !member) return null;
  // Prices come before the first sale: a tile with no price cannot be sold.
  return <PinLock mode="set" onDone={() => router.replace('/bei?anza=1')} />;
}
