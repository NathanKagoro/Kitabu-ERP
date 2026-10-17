'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { ChevronRight, Download, MessageCircle, Plus, Search, Users } from '@/components/icons';
import { Badge, EmptyState, Money, OptionGrid, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { formatPhone, normalisePhone } from '@/lib/auth/phone';
import { findByPhone, inAudience, offerRecipients, toCsv, toVCard, type Audience } from '@/lib/customers';
import { businessDay, daysBetween } from '@/lib/date';
import { downloadText } from '@/lib/export';
import { createCustomer } from '@/lib/local/actions';
import { useCustomers, useCustomerStats } from '@/lib/local/queries';
import { cn } from '@/lib/cn';

/**
 * Wateja: everyone the shop knows, not just people who owe money. Built for
 * offers: who bought recently, who has not been back, and two ways to reach
 * them -- one personalised WhatsApp message each, or the whole list exported
 * as phone contacts for a WhatsApp Business broadcast list.
 */
export default function CustomersPage() {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const toast = useToast();
  const { businessId, business } = useApp();
  const customers = useCustomers(businessId);
  const stats = useCustomerStats(businessId);

  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const today = businessDay();
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (customers ?? [])
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')))
      .filter((c) => inAudience(audience, stats?.get(c.id)?.lastAt, today))
      .sort((a, b) => (stats?.get(b.id)?.lastAt ?? '').localeCompare(stats?.get(a.id)?.lastAt ?? '') || a.name.localeCompare(b.name));
  }, [customers, stats, query, audience, today]);
  const reachable = offerRecipients(list);

  const add = async () => {
    setError(null);
    if (!businessId || !name.trim()) return;
    if (phone.trim() && !normalisePhone(phone)) return setError(ta('invalidPhone'));
    const existing = phone.trim() ? findByPhone(customers ?? [], phone) : null;
    if (existing) return setError(t('alreadyThere', { name: existing.name }));
    await createCustomer({ businessId, name, phone: phone.trim() ? normalisePhone(phone) : null });
    setName('');
    setPhone('');
    setAdding(false);
    toast(tc('saved'));
  };

  const shop = business?.name ?? 'Kitabu';
  const fileBase = `${shop.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-wateja-${today}`;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={customers?.length ? t('count', { count: customers.length }) : undefined}
        action={
          <Button variant="ghost" size="icon" aria-label={t('add')} onClick={() => setAdding(true)}>
            <Plus size={26} />
          </Button>
        }
      />

      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/wateja/ofa?kwa=${audience}`}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-[10px] bg-brand font-semibold text-white active:bg-brand-dark',
              reachable.length === 0 && 'pointer-events-none opacity-45'
            )}
            aria-disabled={reachable.length === 0}
          >
            <MessageCircle size={20} />
            {t('sendOffer')}
          </Link>
          <Button variant="secondary" disabled={!customers?.length} onClick={() => setExporting(true)}>
            <Download size={20} />
            {t('export')}
          </Button>
        </div>

        <OptionGrid<Audience>
          columns={3}
          value={audience}
          onChange={setAudience}
          options={(['all', 'recent', 'away'] as const).map((a) => ({ value: a, label: t(`audience.${a}`) }))}
        />

        {(customers?.length ?? 0) > 6 && (
          <div className="relative">
            <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
            <TextInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} aria-label={t('search')} className="h-12 pl-10" />
          </div>
        )}
      </div>

      {customers && customers.length === 0 ? (
        <EmptyState icon={<Users size={44} />} title={t('empty')} body={t('emptyBody')} />
      ) : list.length === 0 ? (
        <p className="p-6 text-center text-ink-soft">{t('noneInAudience')}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line bg-surface">
          {list.map((customer) => {
            const s = stats?.get(customer.id);
            const days = s?.lastAt ? daysBetween(businessDay(s.lastAt), today) : null;
            return (
              <li key={customer.id}>
                <Link href={`/madeni/mteja?id=${customer.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-paper">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{customer.name}</span>
                    <span className="block truncate text-sm text-ink-faint">
                      {customer.phone ? formatPhone(normalisePhone(customer.phone) ?? customer.phone) : t('noPhone')}
                      {s ? ` · ${t('bought', { count: s.sales })}` : ''}
                      {days !== null ? ` · ${t('lastSeen', { days })}` : ''}
                    </span>
                  </span>
                  {customer.noOffers ? <Badge>{t('noOffersBadge')}</Badge> : null}
                  {s ? <Money value={s.spent} className="text-sm font-semibold text-ink-soft" /> : null}
                  <ChevronRight size={20} className="shrink-0 text-ink-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('add')}>
        <div className="space-y-3 p-4">
          <Field label={tc('name')}>{(id) => <TextInput id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label={tc('phone')} error={error}>
            {(id) => <TextInput id={id} type="tel" inputMode="tel" placeholder={ta('phonePlaceholder')} value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} />}
          </Field>
          <Button size="lg" block disabled={!name.trim()} onClick={() => void add()}>
            {tc('save')}
          </Button>
        </div>
      </Sheet>

      <Sheet open={exporting} onClose={() => setExporting(false)} title={t('export')}>
        <div className="space-y-3 p-4">
          <p className="text-sm text-ink-soft">{t('exportHint', { count: reachable.length })}</p>
          <Button
            size="lg"
            block
            disabled={reachable.length === 0}
            onClick={() => {
              downloadText(`${fileBase}.vcf`, toVCard(reachable, shop), 'text/vcard;charset=utf-8');
              setExporting(false);
            }}
          >
            {t('exportContacts')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            block
            onClick={() => {
              downloadText(`${fileBase}.csv`, toCsv(list.map((c) => ({ name: c.name, phone: c.phone, stats: stats?.get(c.id), noOffers: c.noOffers }))));
              setExporting(false);
            }}
          >
            {t('exportSheet')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
