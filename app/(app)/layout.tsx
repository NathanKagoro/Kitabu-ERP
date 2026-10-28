import type { ReactNode } from 'react';

import { AppGate } from '@/components/app-gate';
import { BottomNav } from '@/components/bottom-nav';
import { ShowcaseBar } from '@/components/showcase-bar';
import { WarmChunks } from '@/components/warm-chunks';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppGate>
      <div className="pb-nav mx-auto min-h-dvh max-w-lg">
        <ShowcaseBar />
        {children}
      </div>
      <BottomNav />
      <WarmChunks />
    </AppGate>
  );
}
