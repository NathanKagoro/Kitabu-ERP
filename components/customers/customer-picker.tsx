'use client';

import { Check, Plus, Search, UserRound } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Money } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { createCustomer } from '@/lib/local/actions';
import { ConsentCheck } from '@/components/customers/consent-check';
import { useCustomers } from '@/lib/local/queries';

/**
 * Choosing whose daftari a credit sale goes in. Creating a customer inline is
 * essential: the first time someone buys on credit is exactly the moment they
 * are not in the list yet, and they are standing right there.
 */
export function CustomerPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (customerId: string) => void;
}) {
  const t = useTranslations('payment');
  const tc = useTranslations('common');
  const tcu = useTranslations('customers');
  const { businessId } = useApp();
  const customers = useCustomers(businessId);

  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = customers ?? [];
    return q ? list.filter((c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q)) : list;
  }, [customers, query]);

  const add = async () => {
    if (!businessId || !name.trim()) return;
    const customer = await createCustomer({ businessId, name, phone, offersConsent: consent });
    onChange(customer.id);
    setAdding(false);
    setConsent(false);
    setName('');
    setPhone('');
  };

  if (adding) {
    return (
      <div className="space-y-3">
        <Field label={tc('name')}>
          {(id) => (
            <TextInput id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label={tc('phone')} hint={tc('optional')}>
          {(id) => (
            <TextInput id={id} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          )}
        </Field>
        {phone.trim() ? <ConsentCheck checked={consent} onChange={setConsent} /> : null}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAdding(false)}>
            {tc('cancel')}
          </Button>
          <Button block disabled={!name.trim()} onClick={() => void add()}>
            {tc('save')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tcu('searchPlaceholder')}
            className="h-12 pl-10"
          />
        </div>
        <Button variant="secondary" onClick={() => { setAdding(true); setName(query); }}>
          <Plus size={20} />
          {t('newCustomer')}
        </Button>
      </div>
      <ul className="max-h-60 divide-y divide-line overflow-y-auto rounded-[10px] border border-line">
        {filtered.map((customer) => (
          <li key={customer.id}>
            <button
              onClick={() => onChange(customer.id)}
              className={cn(
                'flex min-h-14 w-full items-center gap-3 px-3 text-left',
                customer.id === value ? 'bg-brand-tint' : 'active:bg-paper'
              )}
            >
              <UserRound size={20} className="shrink-0 text-ink-faint" />
              <span className="min-w-0 flex-1 truncate font-semibold">{customer.name}</span>
              {customer.balance > 0 ? (
                <Money value={customer.balance} className="text-sm font-semibold text-debt" />
              ) : null}
              {customer.id === value ? <Check size={20} className="text-brand" /> : null}
            </button>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-ink-faint">{tcu('empty')}</li>
        ) : null}
      </ul>
    </div>
  );
}
