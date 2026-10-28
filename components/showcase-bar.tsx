'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

import { withBase } from '@/lib/base-path';
import { isShowcase } from '@/lib/showcase';

/**
 * A thin strip on every screen of the demo link: this is a sample shop, and
 * a way out. Leaving goes back to the phone's own sign-in and data.
 */
const noSubscribe = () => () => {};

export function ShowcaseBar() {
  const t = useTranslations('demo');
  // False while the page is built, the browser's answer once it runs.
  const on = useSyncExternalStore(noSubscribe, isShowcase, () => false);
  if (!on) return null;
  return (
    <div className="flex min-h-10 items-center gap-2 bg-ink px-4 text-sm text-white">
      <span className="min-w-0 flex-1 truncate">{t('banner')}</span>
      <button
        className="h-10 shrink-0 px-2 font-semibold underline"
        onClick={() =>
          void (async () => {
            const { signOut } = await import('@/lib/auth/session');
            await signOut();
            window.location.replace(withBase('/ingia/'));
          })()
        }
      >
        {t('leave')}
      </button>
    </div>
  );
}
