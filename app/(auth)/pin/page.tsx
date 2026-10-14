'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useApp } from '@/components/app-provider';
import { PinLock } from '@/components/pin-lock';
import { db } from '@/lib/local/db';

export default function SetPinPage() {
  const router = useRouter();
  const { ready, member, userId, businessId, can } = useApp();

  useEffect(() => {
    if (ready && !userId) router.replace('/ingia');
  }, [ready, userId, router]);

  /**
   * Where a new phone goes next. A shop with no products starts on bulk entry
   * (the setup visit: count a shelf, type it in). Products without prices go
   * to the price screen, because a tile with no price cannot be sold. Staff go
   * straight to the till.
   */
  const next = async () => {
    if (!businessId || !can('manageProducts')) return router.replace('/mauzo');
    const products = await db().products.where('businessId').equals(businessId).filter((p) => p.active && !p.deletedAt).toArray();
    if (products.length === 0) return router.replace('/bidhaa/ingiza?anza=1');
    if (products.some((p) => !p.price)) return router.replace('/bei?anza=1');
    router.replace('/mauzo');
  };

  if (!ready || !member) return null;
  return <PinLock mode="set" onDone={() => void next()} />;
}
