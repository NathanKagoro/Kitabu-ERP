'use client';

import { useTranslations } from 'next-intl';

/**
 * "Agreed to receive offers": ticked only when the customer said yes. Offers
 * go only to customers with this on record (with the date), which is what
 * Tanzania's Personal Data Protection Act 2022 expects for marketing.
 */
export function ConsentCheck({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const t = useTranslations('clients');
  return (
    <label className="flex min-h-14 items-start gap-3 rounded-[10px] border border-line-strong bg-surface px-3 py-2.5">
      <input
        type="checkbox"
        className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-brand)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block font-semibold">{t('consentLabel')}</span>
        <span className="block text-xs text-ink-faint">{t('consentHint')}</span>
      </span>
    </label>
  );
}
