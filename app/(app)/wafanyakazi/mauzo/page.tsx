'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Users } from '@/components/icons';
import { EmptyState, Money, OptionGrid, PageHeader } from '@/components/ui/bits';
import { formatPhone } from '@/lib/auth/phone';
import { salesByStaff, shareOf } from '@/lib/calc/staff';
import { addDays, businessDay } from '@/lib/date';
import { db } from '@/lib/local/db';
import { loadRange } from '@/lib/local/queries';

type Range = 1 | 7 | 30;

/**
 * Mauzo kwa mfanyakazi: what each person at the till sold, the cash they took,
 * and anything they cancelled. Owners and managers only. Reads the sales on
 * this phone, which (once synced) is every sale from every phone.
 */
export default function StaffSalesPage() {
  const t = useTranslations('staffSales');
  const te = useTranslations('errors');
  const ts = useTranslations('staff');
  const { businessId, can } = useApp();
  const [range, setRange] = useState<Range>(1);
  const today = businessDay();

  const data = useLiveQuery(async () => {
    if (!businessId) return null;
    const rows = await loadRange(businessId, addDays(today, -(range - 1)), today);
    const members = await db().members.where('businessId').equals(businessId).toArray();
    return { totals: salesByStaff(rows.sales, rows.payments), members };
  }, [businessId, today, range]);

  if (!can('viewStaffSales')) {
    return (
      <>
        <PageHeader title={t('title')} />
        <EmptyState title={te('noAccess')} />
      </>
    );
  }

  const whole = data?.totals.reduce((sum, row) => sum + row.total, 0) ?? 0;
  const who = (userId: string | null) => {
    if (!userId) return { name: t('unknown'), role: null };
    const member = data?.members.find((m) => m.userId === userId);
    return {
      name: member?.name ?? (member?.phone ? formatPhone(member.phone) : t('unknown')),
      role: member?.role ?? null,
    };
  };

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="p-3">
        <OptionGrid<`${Range}`>
          columns={3}
          value={`${range}`}
          onChange={(value) => setRange(Number(value) as Range)}
          options={[
            { value: '1', label: t('today') },
            { value: '7', label: t('days', { count: 7 }) },
            { value: '30', label: t('days', { count: 30 }) },
          ]}
        />
      </div>

      {data && data.totals.length === 0 ? <EmptyState icon={<Users size={44} />} title={t('empty')} /> : null}

      {data && data.totals.length > 0 && (
        <>
          <section className="card mx-3 mb-3 p-4">
            <p className="text-sm font-medium text-ink-soft">{t('total')}</p>
            <Money value={whole} symbol className="text-3xl font-bold" />
          </section>
          <ul className="space-y-2 px-3 pb-6">
            {data.totals.map((row) => {
              const person = who(row.userId);
              const share = shareOf(row.total, whole);
              return (
                <li key={row.userId ?? '__none'} className="card space-y-2 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-bold">{person.name}</span>
                      {person.role ? <span className="text-sm text-ink-faint">{ts(`roles.${person.role}`)}</span> : null}
                    </span>
                    <Money value={row.total} symbol className="text-xl font-bold" />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-ink-faint">{t('sales')}</dt>
                      <dd className="tnum font-semibold">{row.sales}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">{t('cash')}</dt>
                      <dd className="font-semibold">
                        <Money value={row.cash} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-faint">{t('share')}</dt>
                      <dd className="tnum font-semibold">{share}%</dd>
                    </div>
                  </dl>
                  {row.voided > 0 ? (
                    <p className="rounded-[10px] bg-debt-tint px-3 py-2 text-sm font-medium text-debt">
                      {t('voided', { count: row.voided })} · <Money value={row.voidedValue} symbol />
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
