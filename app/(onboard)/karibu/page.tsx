'use client';

import { Building2, Check } from '@/components/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { useApp } from '@/components/app-provider';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { LOCALE_NAMES, LOCALES } from '@/lib/i18n/config';
import { createBusiness } from '@/lib/onboarding/create-business';
import { isDemo, signOut } from '@/lib/auth/session';
import { SupportButton } from '@/components/support-button';
import { STARTER_PRODUCTS } from '@/lib/onboarding/starter-products';
import type { BusinessType } from '@/lib/types';
import { useSetLocale } from '@/components/locale-provider';
import { SHOP_TYPE_OPTIONS } from '@/components/shop-types';

const TYPES = SHOP_TYPE_OPTIONS;

/**
 * Three screens, no more: name (with the language switch on it, so everything
 * after is in the right language), type, and the starter list. Every other
 * setting waits until the owner actually needs it.
 */
/**
 * With a server, shops are created by the operator, so a login that reaches
 * this page belongs to no shop yet: say so and offer the support chat. Only
 * the demo (no server) lets someone set up a shop on the phone itself.
 */
export default function OnboardingRoute() {
  return isDemo() ? <OnboardingPage /> : <NotLinked />;
}

function NotLinked() {
  const t = useTranslations('support');
  const ta = useTranslations('auth');
  const router = useRouter();
  const { ready, userId, businessId } = useApp();

  useEffect(() => {
    if (!ready) return;
    if (!userId) router.replace('/ingia');
    else if (businessId) router.replace('/mauzo');
  }, [ready, userId, businessId, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={56} />
      <h1 className="text-xl font-bold">{t('notLinkedTitle')}</h1>
      <p className="text-ink-soft">{t('notLinkedBody')}</p>
      <SupportButton message={t('notLinkedMessage')} />
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

function OnboardingPage() {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const locale = useLocale();
  const setLocale = useSetLocale();
  const router = useRouter();
  const { ready, userId, businessId } = useApp();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessType | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ready) return;
    if (!userId) router.replace('/ingia');
    else if (businessId && !busy) router.replace('/mauzo');
  }, [ready, userId, businessId, busy, router]);

  const starter = type ? STARTER_PRODUCTS[type] : [];

  const finish = async () => {
    if (!type || !userId) return;
    setBusy(true);
    await createBusiness({
      name: name || t('namePlaceholder'),
      type,
      locale,
      userId,
      starter: starter.filter((item) => !removed.has(item.name)),
    });
    router.replace('/pin');
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-8 pb-8">
      <div className="mb-8 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn('h-1.5 flex-1 rounded-full', index <= step ? 'bg-brand' : 'bg-line')}
          />
        ))}
      </div>

      {step === 0 && (
        <section className="flex flex-1 flex-col">
          <div className="mb-6 flex gap-2">
            {LOCALES.map((option) => (
              <button
                key={option}
                disabled={pending}
                onClick={() => startTransition(async () => {
                  await setLocale(option);
                })}
                className={cn(
                  'h-11 rounded-full border px-4 text-sm font-semibold',
                  option === locale
                    ? 'border-brand bg-brand-tint text-brand-dark'
                    : 'border-line-strong bg-surface text-ink-soft'
                )}
              >
                {LOCALE_NAMES[option]}
              </button>
            ))}
          </div>
          <Logo size={52} className="mb-4" />
          <h1 className="text-2xl font-bold">{t('welcomeTitle')}</h1>
          <p className="mt-1.5 mb-8 text-ink-soft">{t('welcomeBody')}</p>
          <Field label={t('nameTitle')}>
            {(id) => (
              <TextInput
                id={id}
                autoFocus
                placeholder={t('namePlaceholder')}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <div className="mt-auto pt-8">
            <Button size="lg" block disabled={!name.trim()} onClick={() => setStep(1)}>
              {tc('next')}
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-1 flex-col">
          <h1 className="text-2xl font-bold">{t('typeTitle')}</h1>
          <p className="mt-1.5 mb-6 text-ink-soft">{t('typeHelp')}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {TYPES.map(({ type: option, Icon }) => {
              const selected = option === type;
              return (
                <button
                  key={option}
                  onClick={() => {
                    setType(option);
                    setRemoved(new Set());
                  }}
                  aria-pressed={selected}
                  className={cn(
                    'flex min-h-28 flex-col items-start gap-2 rounded-[12px] border p-3.5 text-left',
                    selected ? 'border-brand bg-brand-tint' : 'border-line-strong bg-surface'
                  )}
                >
                  <Icon size={28} className={selected ? 'text-brand' : 'text-ink-soft'} />
                  <span className="leading-tight font-bold">{t(`types.${option}`)}</span>
                  <span className="text-xs leading-tight text-ink-faint">
                    {t(`types.${option}Hint`)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex gap-2 pt-8">
            <Button variant="secondary" size="lg" onClick={() => setStep(0)}>
              {tc('back')}
            </Button>
            <Button size="lg" block disabled={!type} onClick={() => setStep(2)}>
              {tc('next')}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-1 flex-col">
          <h1 className="text-2xl font-bold">{t('starterTitle')}</h1>
          <p className="mt-1.5 mb-6 text-ink-soft">{t('starterBody')}</p>
          <div className="grid grid-cols-2 gap-2">
            {starter.map((item) => {
              const kept = !removed.has(item.name);
              return (
                <button
                  key={item.name}
                  aria-pressed={kept}
                  onClick={() =>
                    setRemoved((current) => {
                      const next = new Set(current);
                      if (next.has(item.name)) next.delete(item.name);
                      else next.add(item.name);
                      return next;
                    })
                  }
                  className={cn(
                    'flex min-h-14 items-center gap-2 rounded-[10px] border px-3 py-2 text-left leading-tight font-semibold',
                    kept
                      ? 'border-brand bg-surface text-ink'
                      : 'border-line bg-paper text-ink-faint line-through'
                  )}
                >
                  <span className="text-xl" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">{item.name}</span>
                  {kept ? <Check size={18} className="shrink-0 text-brand" /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex gap-2 pt-8">
            <Button variant="secondary" size="lg" onClick={() => setStep(1)}>
              {tc('back')}
            </Button>
            <Button size="lg" block disabled={busy} onClick={() => void finish()}>
              {busy ? t('creating') : t('finish')}
              {!busy && <Building2 size={20} />}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
