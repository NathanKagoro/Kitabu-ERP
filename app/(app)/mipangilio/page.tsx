'use client';

import { Download, KeyRound, Sparkles } from '@/components/icons';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { useApp } from '@/components/app-provider';
import { PinLock } from '@/components/pin-lock';
import { OptionGrid, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextArea, TextInput } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { nowIso } from '@/lib/date';
import { createDemoBusiness } from '@/lib/demo';
import { buildExport, downloadText, type ExportKind } from '@/lib/export';
import { LOCALE_NAMES, LOCALES, type Locale } from '@/lib/i18n/config';
import { persist } from '@/lib/local/write';
import type { Business, BusinessMode } from '@/lib/types';
import { setLocale } from '@/server/actions/locale';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { business } = useApp();
  if (!business) return <PageHeader title={t('title')} />;
  return <SettingsForm key={business.id} initial={business} />;
}

function SettingsForm({ initial }: { initial: Business }) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const td = useTranslations('demo');
  const tpin = useTranslations('pin');
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { businessId, userId, show } = useApp();
  const [draft, setDraft] = useState<Business>(initial);
  const [changingPin, setChangingPin] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!businessId) return <PageHeader title={t('title')} />;
  if (changingPin) return <PinLock mode="set" onDone={() => { setChangingPin(false); toast(tc('saved')); }} />;

  const set = <K extends keyof Business>(key: K, value: Business[K]) => setDraft({ ...draft, [key]: value });
  const setSetting = (key: keyof Business['settings'], value: unknown) =>
    setDraft({ ...draft, settings: { ...draft.settings, [key]: value } });

  const save = async (next: Business = draft) => {
    await persist('businesses', { ...next, updatedAt: nowIso() });
    toast(tc('saved'));
  };

  const exportCsv = async (kind: ExportKind) => {
    downloadText(`hesabu-${kind}-${new Date().toISOString().slice(0, 10)}.csv`, await buildExport(businessId, kind));
  };

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="space-y-6 p-4">
        <section className="space-y-3">
          <h2 className="font-bold">{t('language')}</h2>
          <OptionGrid<Locale>
            value={locale as Locale}
            onChange={(next) =>
              startTransition(async () => {
                await setLocale(next);
                await save({ ...draft, locale: next });
                router.refresh();
              })
            }
            options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
          />
          {pending ? <p className="text-sm text-ink-faint">{tc('loading')}</p> : null}
        </section>

        <section className="space-y-3">
          <h2 className="font-bold">{t('mode')}</h2>
          <p className="text-sm text-ink-soft">{t('modeHint')}</p>
          <OptionGrid<BusinessMode>
            columns={1}
            value={draft.mode}
            onChange={(mode) => {
              const next = { ...draft, mode };
              setDraft(next);
              void save(next);
            }}
            options={(['genge', 'duka', 'biashara'] as const).map((m) => ({ value: m, label: t(`modes.${m}`), hint: t(`modeHints.${m}`) }))}
          />
        </section>

        <section className="space-y-3">
          <h2 className="font-bold">{t('business')}</h2>
          <Field label={t('businessName')}>{(id) => <TextInput id={id} value={draft.name} onChange={(e) => set('name', e.target.value)} />}</Field>
          <Field label={tc('phone')}>{(id) => <TextInput id={id} type="tel" value={draft.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />}</Field>
          {show('vat') && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tin')}>{(id) => <TextInput id={id} value={draft.tin ?? ''} onChange={(e) => set('tin', e.target.value)} />}</Field>
              <Field label={t('vrn')}>{(id) => <TextInput id={id} value={draft.vrn ?? ''} onChange={(e) => set('vrn', e.target.value)} />}</Field>
              <Field label={t('vatRate')}>
                {(id) => (
                  <TextInput id={id} inputMode="decimal" value={String(draft.settings.vatRate ?? 18)} onChange={(e) => setSetting('vatRate', Number(e.target.value) || 0)} />
                )}
              </Field>
            </div>
          )}
          <Field label={t('receiptFooter')} hint={tc('optional')}>
            {(id) => <TextInput id={id} placeholder={t('receiptFooterPlaceholder')} value={draft.settings.receiptFooter ?? ''} onChange={(e) => setSetting('receiptFooter', e.target.value)} />}
          </Field>
          <Field label={t('reminderTemplate')} hint="{name} {business} {balance}">
            {(id) => <TextArea id={id} rows={3} value={draft.settings.reminderTemplate ?? ''} onChange={(e) => setSetting('reminderTemplate', e.target.value)} />}
          </Field>
          {show('documents') && (
            <>
              <h3 className="pt-2 font-semibold">{t('bankDetails')}</h3>
              <Field label={t('bankName')}>{(id) => <TextInput id={id} value={draft.settings.bankName ?? ''} onChange={(e) => setSetting('bankName', e.target.value)} />}</Field>
              <Field label={t('bankAccount')}>{(id) => <TextInput id={id} value={draft.settings.bankAccount ?? ''} onChange={(e) => setSetting('bankAccount', e.target.value)} />}</Field>
              <Field label={t('payNumber')}>{(id) => <TextInput id={id} value={draft.settings.payNumber ?? ''} onChange={(e) => setSetting('payNumber', e.target.value)} />}</Field>
            </>
          )}
          <Button size="lg" block onClick={() => void save()}>
            {tc('save')}
          </Button>
        </section>

        <section className="space-y-2">
          <Button variant="secondary" size="lg" block onClick={() => setChangingPin(true)}>
            <KeyRound size={20} />
            {tpin('change')}
          </Button>
        </section>

        {show('export') && (
          <section className="space-y-2">
            <h2 className="font-bold">{t('export')}</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['sales', 'expenses', 'customers', 'stock'] as const).map((kind) => (
                <Button key={kind} variant="secondary" onClick={() => void exportCsv(kind)}>
                  <Download size={18} />
                  {t(`export${kind[0]!.toUpperCase()}${kind.slice(1)}` as 'exportSales')}
                </Button>
              ))}
            </div>
          </section>
        )}

        <section className="card space-y-2 p-4">
          <h2 className="font-bold">{td('title')}</h2>
          <p className="text-sm text-ink-soft">{td('hint')}</p>
          <Button
            variant="secondary"
            block
            disabled={demoBusy || !userId}
            onClick={() =>
              void (async () => {
                if (!userId) return;
                setDemoBusy(true);
                await createDemoBusiness(userId, td('businessName'), locale);
                toast(td('created'));
                router.replace('/hesabu');
              })()
            }
          >
            <Sparkles size={18} />
            {demoBusy ? td('creating') : td('create')}
          </Button>
        </section>

        <p className="text-center text-xs text-ink-faint">{t('version', { version: '0.1.0' })}</p>
      </div>
    </>
  );
}
