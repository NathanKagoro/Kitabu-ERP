'use client';

import { Phone } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { formatPhone, normalisePhone } from '@/lib/auth/phone';
import { devOtpEnabled, sendCode, verifyCode } from '@/lib/auth/session';
import { db, META_KEYS, setMeta } from '@/lib/local/db';

export default function SignInPage() {
  const t = useTranslations('auth');
  const router = useRouter();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devMode, setDevMode] = useState(devOtpEnabled());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitPhone = async () => {
    setError(null);
    if (!normalisePhone(phone)) return setError(t('invalidPhone'));
    setBusy(true);
    const result = await sendCode(phone);
    setBusy(false);
    if (!result.ok) return setError(result.error === 'invalidPhone' ? t('invalidPhone') : result.error ?? '');
    if (result.devMode) setDevMode(true);
    setStep('code');
  };

  const submitCode = async () => {
    setError(null);
    setBusy(true);
    const result = await verifyCode(phone, code.trim());
    if (!result.ok || !result.userId) {
      setBusy(false);
      return setError(t('invalidCode'));
    }
    // Returning user on this device: go straight back to their business.
    const membership = await db().members.where('userId').equals(result.userId).first();
    if (membership) {
      await setMeta(META_KEYS.activeBusinessId, membership.businessId);
      router.replace('/mauzo');
    } else {
      router.replace('/karibu');
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-16 pb-8">
      <Logo size={56} className="mb-8" />

      {step === 'phone' ? (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPhone();
          }}
        >
          <h1 className="text-2xl font-bold">{t('signInTitle')}</h1>
          <p className="mt-1.5 mb-8 text-ink-soft">{t('signInSubtitle')}</p>
          <Field label={t('phoneLabel')} error={error}>
            {(id) => (
              <TextInput
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                placeholder={t('phonePlaceholder')}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="text-lg"
              />
            )}
          </Field>
          <div className="mt-auto pt-8">
            <Button type="submit" size="lg" block disabled={busy || phone.length < 9}>
              <Phone size={20} />
              {t('sendCode')}
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCode();
          }}
        >
          <h1 className="text-2xl font-bold">{t('codeTitle')}</h1>
          <p className="mt-1.5 mb-8 text-ink-soft">
            {t('codeSubtitle', { phone: formatPhone(normalisePhone(phone) ?? phone) })}
          </p>
          <Field label={t('codeLabel')} error={error}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                className="tnum text-center text-2xl tracking-[0.4em]"
              />
            )}
          </Field>
          {devMode ? (
            <p className="mt-3 rounded-[10px] bg-info-tint px-3 py-2.5 text-sm font-medium text-info">
              {t('devCodeHint')}
            </p>
          ) : null}
          <div className="mt-auto space-y-2 pt-8">
            <Button type="submit" size="lg" block disabled={busy || code.length !== 6}>
              {t('verify')}
            </Button>
            <Button variant="ghost" block onClick={() => setStep('phone')}>
              {t('changeNumber')}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
