'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Logo } from '@/components/brand/logo';
import { Lock } from '@/components/icons';
import { SupportButton } from '@/components/support-button';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth/session';

/** Shown instead of the till when the operator has paused this shop. */
export function PausedNotice({ name }: { name: string }) {
  const t = useTranslations('support');
  const ta = useTranslations('auth');
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={56} />
      <Lock size={36} className="text-ink-faint" />
      <h1 className="text-xl font-bold">{t('pausedTitle')}</h1>
      <p className="text-ink-soft">{t('pausedBody')}</p>
      <SupportButton message={t('pausedMessage', { shop: name })} />
      <Button
        variant="ghost"
        onClick={async () => {
          await signOut();
          router.replace('/ingia');
        }}
      >
        {ta('signOut')}
      </Button>
    </main>
  );
}
