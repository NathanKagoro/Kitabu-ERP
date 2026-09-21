'use client';

import { useTranslations } from 'next-intl';

import { businessDay, daysBetween } from '@/lib/date';

export function useLastPaidLabel() {
  const t = useTranslations('customers');
  const today = businessDay();
  return (iso: string | null) => {
    if (!iso) return t('neverPaid');
    const days = daysBetween(businessDay(iso), today);
    const when = days <= 0 ? t('paidToday') : days === 1 ? t('paidYesterday') : t('daysAgo', { count: days });
    return t('lastPaid', { days: when });
  };
}
