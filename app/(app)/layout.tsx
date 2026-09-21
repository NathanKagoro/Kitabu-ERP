import type { ReactNode } from 'react';

import { AppGate } from '@/components/app-gate';
import { BottomNav } from '@/components/bottom-nav';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppGate>
      <div className="pb-nav mx-auto min-h-dvh max-w-lg">{children}</div>
      <BottomNav />
    </AppGate>
  );
}
