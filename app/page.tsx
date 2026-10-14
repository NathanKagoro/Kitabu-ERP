'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Logo } from '@/components/brand/logo';

/** The app has one home, and it is the till. */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/mauzo');
  }, [router]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <Logo size={64} />
    </div>
  );
}
