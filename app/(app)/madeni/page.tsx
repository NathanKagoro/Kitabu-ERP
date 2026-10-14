'use client';

import { BookUser, ChevronRight, Plus, Search } from '@/components/icons';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { EmptyState, Money, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { createCustomer } from '@/lib/local/actions';
import { useCustomers } from '@/lib/local/queries';
import { useLastPaidLabel } from '@/components/customers/last-paid';

export default function CreditPage() {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const { businessId } = useApp();
  const customers = useCustomers(businessId);
  const lastPaid = useLastPaidLabel();

  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const owing = (customers ?? []).filter((c) => c.balance > 0);
  const totalOwed = owing.reduce((sum, c) => sum + c.balance, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? (customers ?? []).filter((c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q)) : customers ?? [];
  }, [customers, query]);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        back={false}
        action={
          <Button variant="ghost" size="icon" aria-label={t('add')} onClick={() => setAdding(true)}>
            <Plus size={24} />
          </Button>
        }
      />

      <section className="card m-3 p-4">
        <p className="text-sm font-medium text-ink-soft">{t('totalOwed')}</p>
        <Money value={totalOwed} symbol className="text-3xl font-bold text-debt" />
        <p className="mt-0.5 text-sm text-ink-soft">{t('peopleOwing', { count: owing.length })}</p>
      </section>

      {(customers?.length ?? 0) > 6 && (
        <div className="relative mx-3 mb-2">
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} className="h-12 pl-10" />
        </div>
      )}

      {customers && customers.length === 0 ? (
        <EmptyState icon={<BookUser size={44} />} title={t('empty')} body={t('emptyHint')} />
      ) : (
        <ul className="card mx-3 divide-y divide-line overflow-hidden">
          {filtered.map((customer) => (
            <li key={customer.id}>
              <Link href={`/madeni/mteja?id=${customer.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-paper">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{customer.name}</span>
                  <span className="block truncate text-sm text-ink-faint">
                    {customer.balance > 0 ? lastPaid(customer.lastPaidAt) : t('owesNothing')}
                  </span>
                </span>
                {customer.balance > 0 ? <Money value={customer.balance} className="font-bold text-debt" /> : null}
                <ChevronRight size={20} className="shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('add')}>
        <div className="space-y-3 p-4">
          <Field label={tc('name')}>
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label={tc('phone')} hint={tc('optional')}>
            {(id) => <TextInput id={id} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          <Button
            size="lg"
            block
            disabled={!name.trim()}
            onClick={() =>
              void (async () => {
                if (!businessId) return;
                await createCustomer({ businessId, name, phone });
                setName('');
                setPhone('');
                setAdding(false);
              })()
            }
          >
            {tc('save')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
