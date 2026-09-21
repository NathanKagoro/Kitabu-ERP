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
  return <PinLock mode="set" onDone={() => router.replace('/mauzo')} />;
}
