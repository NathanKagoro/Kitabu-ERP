'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Truck } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { EmptyState, Money, OptionGrid, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { AmountInput, Field, TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { supplierBalance } from '@/lib/calc/credit';
import { createSupplier, recordSupplierPayment } from '@/lib/local/actions';
import { db } from '@/lib/local/db';
import { parseTZS } from '@/lib/money';
import type { PaymentMethod, Supplier } from '@/lib/types';

export default function SuppliersPage() {
  const t = useTranslations('suppliers');
  const tp = useTranslations('payment');
  const tc = useTranslations('common');
  const toast = useToast();
  const { businessId, userId } = useApp();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paying, setPaying] = useState<Supplier | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');

  const rows = useLiveQuery(async () => {
    if (!businessId) return [];
    const [suppliers, purchases, payments] = await Promise.all([
      db().suppliers.where('businessId').equals(businessId).toArray(),
      db().purchases.where('businessId').equals(businessId).toArray(),
      db().payments.where('businessId').equals(businessId).toArray(),
    ]);
    return suppliers
      .filter((s) => !s.deletedAt)
      .map((s) => ({ supplier: s, owed: supplierBalance(purchases, payments, s.id) }))
      .sort((a, b) => b.owed - a.owed);
  }, [businessId]);

  return (
    <>
      <PageHeader
        title={t('title')}
        action={
          <Button variant="ghost" size="icon" aria-label={t('add')} onClick={() => setAdding(true)}>
            <Plus size={24} />
          </Button>
        }
      />
      {rows && rows.length === 0 ? <EmptyState icon={<Truck size={44} />} title={t('empty')} /> : null}
      <ul className="divide-y divide-line">
        {rows?.map(({ supplier, owed }) => (
          <li key={supplier.id} className="flex min-h-16 items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{supplier.name}</span>
              <span className="text-sm text-ink-faint">{owed > 0 ? t('weOwe') : t('settled')}</span>
            </span>
            {owed > 0 ? (
              <>
                <Money value={owed} className="font-bold text-debt" />
                <Button size="sm" variant="secondary" onClick={() => { setPaying(supplier); setAmount(String(owed)); }}>
                  {t('recordPayment')}
                </Button>
              </>
            ) : null}
          </li>
        ))}
      </ul>

      <Sheet open={adding} onClose={() => setAdding(false)} title={t('add')}>
        <div className="space-y-3 p-4">
          <Field label={tc('name')}>{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label={tc('phone')} hint={tc('optional')}>
            {(id) => <TextInput id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          <Button
            size="lg"
            block
            disabled={!name.trim()}
            onClick={() =>
              void (async () => {
                if (!businessId) return;
                await createSupplier({ businessId, name, phone });
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

      <Sheet open={!!paying} onClose={() => setPaying(null)} title={paying?.name}>
        <div className="space-y-3 p-4">
          <Field label={tc('amount')}>{(id) => <AmountInput id={id} big value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          <OptionGrid<PaymentMethod>
            value={method}
            onChange={setMethod}
            columns={3}
            options={(['cash', 'mpesa', 'bank'] as const).map((m) => ({ value: m, label: tp(`methods.${m}`) }))}
          />
          <Button
            size="lg"
            block
            onClick={() =>
              void (async () => {
                const value = parseTZS(amount);
                if (!businessId || !paying || !value || value <= 0) return;
                await recordSupplierPayment({ businessId, userId, supplierId: paying.id, amount: value, method });
                toast(tc('saved'));
                setPaying(null);
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
