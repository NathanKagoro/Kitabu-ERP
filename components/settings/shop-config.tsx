'use client';

import { useTranslations } from 'next-intl';

import { ColourPicker } from '@/components/colour-picker';
import { SHOP_TYPE_OPTIONS } from '@/components/shop-types';
import { OptionGrid } from '@/components/ui/bits';
import { Field, TextInput } from '@/components/ui/field';
import { SwitchRow } from '@/components/ui/switch';
import type { Feature } from '@/lib/modes';
import { MODE_FOR_TYPE } from '@/lib/modes';
import { ALL_PAYMENT_METHODS, brandColorOf, paymentMethodsOf, shopHasFeature } from '@/lib/shop-config';
import type { Business, BusinessType, PaymentMethod } from '@/lib/types';

/**
 * The per-shop configuration an owner (or the operator on the setup visit)
 * changes in Mipangilio: what kind of shop it is, how it looks, which payment
 * methods it takes, and which parts of the app are switched on.
 *
 * Each control saves on its own, like the language switch: there is nothing
 * to "forget to save" while standing in a shop.
 */

/** The parts of the app an owner can switch on and off, in the order shown. */
const OWNER_FEATURES: readonly Feature[] = [
  'stockTracking',
  'credit',
  'purchases',
  'expenses',
  'suppliers',
  'waste',
  'dailyPriceUpdate',
  'staff',
  'documents',
  'vat',
];

export function ShopConfigSections({ draft, onSave }: { draft: Business; onSave: (next: Business) => void }) {
  const t = useTranslations('settings');
  const to = useTranslations('onboarding');
  const tp = useTranslations('payment');

  const setSettings = (patch: Partial<Business['settings']>) => onSave({ ...draft, settings: { ...draft.settings, ...patch } });

  const methods = paymentMethodsOf(draft);
  const toggleMethod = (method: Exclude<PaymentMethod, 'credit'>, on: boolean) => {
    const next = on ? [...methods, method] : methods.filter((m) => m !== method);
    // Cash is always possible; never leave a till with nothing to take money by.
    if (next.length === 0) return;
    // A method switched off takes its till number off the receipts too.
    const tillNumbers = { ...(draft.settings.tillNumbers ?? {}) };
    if (!on) delete tillNumbers[method];
    setSettings({ paymentMethods: ALL_PAYMENT_METHODS.filter((m) => next.includes(m)), tillNumbers });
  };

  const setFeature = (feature: Feature, on: boolean) =>
    setSettings({ features: { ...(draft.settings.features ?? {}), [feature]: on } });

  return (
    <>
      <section className="space-y-3">
        <h2 className="font-bold">{t('shopType')}</h2>
        <p className="text-sm text-ink-soft">{t('shopTypeHint')}</p>
        <OptionGrid<BusinessType>
          columns={2}
          value={draft.type}
          onChange={(type) => onSave({ ...draft, type, mode: MODE_FOR_TYPE[type] })}
          options={SHOP_TYPE_OPTIONS.map(({ type, Icon }) => ({ value: type, label: to(`types.${type}`), icon: <Icon size={20} /> }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">{t('look')}</h2>
        <p className="text-sm text-ink-soft">{t('colourHint')}</p>
        <ColourPicker value={brandColorOf(draft)} onChange={(brandColor) => setSettings({ brandColor })} label={t('colour')} />
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">{t('payments')}</h2>
        <p className="text-sm text-ink-soft">{t('paymentsHint')}</p>
        <div className="card divide-y divide-line overflow-hidden">
          {ALL_PAYMENT_METHODS.map((method) => (
            <SwitchRow
              key={method}
              label={tp(`methods.${method}`)}
              checked={methods.includes(method)}
              onChange={(on) => toggleMethod(method, on)}
            />
          ))}
        </div>
        {methods
          .filter((m) => m !== 'cash')
          .map((method) => (
            <Field key={method} label={t('tillNumber', { method: tp(`methods.${method}`) })} hint={t('tillHint')}>
              {(id) => (
                <TextInput
                  id={id}
                  inputMode={method === 'bank' ? 'text' : 'numeric'}
                  defaultValue={draft.settings.tillNumbers?.[method] ?? ''}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value === (draft.settings.tillNumbers?.[method] ?? '')) return;
                    setSettings({ tillNumbers: { ...(draft.settings.tillNumbers ?? {}), [method]: value } });
                  }}
                />
              )}
            </Field>
          ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">{t('features')}</h2>
        <p className="text-sm text-ink-soft">{t('featuresHint')}</p>
        <div className="card divide-y divide-line overflow-hidden">
          {OWNER_FEATURES.map((feature) => (
            <SwitchRow
              key={feature}
              label={t(`featureNames.${feature}`)}
              hint={t(`featureHints.${feature}`)}
              checked={shopHasFeature(draft, feature)}
              onChange={(on) => setFeature(feature, on)}
            />
          ))}
        </div>
      </section>
    </>
  );
}
