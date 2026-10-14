'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { SupportButton } from '@/components/support-button';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { normalisePhone } from '@/lib/auth/phone';
import { DEMO_CODE, isDemo, signIn } from '@/lib/auth/session';
import { db, META_KEYS, setMeta } from '@/lib/local/db';

/**
 * Phone number + password. The first time, the "password" is the setup code
 * the shop was given; the next screen asks them to choose their own.
 */
export default function SignInPage() {
  const t = useTranslations('auth');
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [secret, setSecret] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = isDemo();

  const submit = async () => {
    setError(null);
    if (!normalisePhone(phone)) return setError(t('invalidPhone'));
    setBusy(true);
    const result = await signIn(phone, secret);
    if (!result.ok || !result.userId) {
      setBusy(false);
      return setError(t(`errors.${result.error ?? 'wrongPassword'}`));
    }
    if (result.mustSetPassword) return router.replace('/neno-siri');
    const membership = await db().members.where('userId').equals(result.userId).filter((m) => m.active).first();
    if (membership) {
      await setMeta(META_KEYS.activeBusinessId, membership.businessId);
      router.replace('/mauzo');
    } else if (result.operator) {
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
        <h1 className="text-2xl font-bold">{t('signInTitle')}</h1>
        <p className="mt-1.5 mb-8 text-ink-soft">{t('signInSubtitle')}</p>

        <div className="space-y-4">
          <Field label={t('phoneLabel')}>
            {(id) => (
              <TextInput
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="username"
                autoFocus
                placeholder={t('phonePlaceholder')}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="text-lg"
              />
            )}
          </Field>
          <Field label={t('passwordLabel')} hint={t('passwordHint')} error={error}>
            {(id) => (
              <div className="relative">
                <TextInput
                  id={id}
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  className="pr-20 text-lg"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 right-0 flex min-w-16 items-center justify-center px-3 text-sm font-semibold text-brand"
                >
                  {show ? t('hide') : t('show')}
                </button>
              </div>
            )}
          </Field>
        </div>

        {demo ? (
          <p className="mt-4 rounded-[10px] bg-info-tint px-3 py-2.5 text-sm font-medium text-info">
            {t('demoHint', { code: DEMO_CODE })}
          </p>
        ) : null}

        <div className="mt-auto space-y-3 pt-8">
          <Button type="submit" size="lg" block disabled={busy || phone.length < 9 || !secret}>
            {busy ? t('signingIn') : t('signIn')}
          </Button>
          <SupportButton message={t('supportMessage', { phone: phone.trim() || '—' })} label={t('forgot')} />
        </div>
      </form>
    </main>
  );
}
