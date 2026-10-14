'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/login';
import { setPassword } from '@/lib/auth/session';
import { db, getMeta, META_KEYS, setMeta } from '@/lib/local/db';

/** After signing in with a setup code: choose the password used from now on. */
export default function SetPasswordPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { ready, userId } = useApp();
  const [password, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !userId) router.replace('/ingia');
  }, [ready, userId, router]);

  const submit = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t('errors.tooShort', { min: MIN_PASSWORD_LENGTH }));
    if (password !== confirm) return setError(t('errors.mismatch'));
    setBusy(true);
    const result = await setPassword(password);
    if (!result.ok) {
      setBusy(false);
      return setError(t(`errors.${result.error ?? 'server'}`, { min: MIN_PASSWORD_LENGTH }));
    }
    if (!userId) return router.replace('/ingia');
    const membership = await db().members.where('userId').equals(userId).filter((m) => m.active).first();
    if (membership) {
      await setMeta(META_KEYS.activeBusinessId, membership.businessId);
      // New on this phone: a PIN for quick unlocking comes next.
      router.replace(membership.pinHash ? '/mauzo' : '/pin');
    } else if (await getMeta<boolean>(META_KEYS.operator, false)) {
      router.replace('/admin');
    } else {
      router.replace('/karibu');
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-16 pb-8">
      <Logo size={56} className="mb-8" />
      <form
        className="flex flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1 className="text-2xl font-bold">{t('newPasswordTitle')}</h1>
        <p className="mt-1.5 mb-8 text-ink-soft">{t('newPasswordSubtitle', { min: MIN_PASSWORD_LENGTH })}</p>
        <div className="space-y-4">
          <Field label={t('newPassword')}>
            {(id) => (
              <TextInput
                id={id}
                type="password"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(event) => setPw(event.target.value)}
                className="text-lg"
              />
            )}
          </Field>
          <Field label={t('confirmPassword')} error={error}>
            {(id) => (
              <TextInput
                id={id}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="text-lg"
              />
            )}
          </Field>
        </div>
        <div className="mt-auto pt-8">
          <Button type="submit" size="lg" block disabled={busy || !password || !confirm}>
            {t('savePassword')}
          </Button>
        </div>
      </form>
    </main>
  );
}
