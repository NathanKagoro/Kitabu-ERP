'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Money, OptionGrid, PageHeader, Row } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Keypad, parseKeypad } from '@/components/ui/keypad';
import { useToast } from '@/components/ui/toast';
import { businessDay } from '@/lib/date';
import { recordExpense } from '@/lib/local/actions';
import { loadRange } from '@/lib/local/queries';
import { formatTZS } from '@/lib/money';
import type { ExpenseCategory, PaymentMethod } from '@/lib/types';

const CATEGORIES: ExpenseCategory[] = ['nauli', 'ushuru', 'kodi', 'umeme', 'chakula', 'mishahara', 'nyingine'];

export default function ExpensesPage() {
  const t = useTranslations('expenses');
  const tp = useTranslations('payment');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const toast = useToast();
  const { businessId, userId } = useApp();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('nauli');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');

  const today = businessDay();
  const todays = useLiveQuery(
    async () => (businessId ? (await loadRange(businessId, today, today)).expenses.filter((e) => !e.deletedAt) : []),
    [businessId, today]
  );
  const value = Math.round(parseKeypad(amount));

  const save = async () => {
    if (!businessId) return;
    if (value <= 0) return toast(te('amountPositive'), 'warn');
    await recordExpense({ businessId, userId, category, amount: value, method, note: note.trim() || null });
    toast(t('recorded'));
    setAmount('');
    setNote('');
  };

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="space-y-5 p-4">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink-soft">{t('amountLabel')}</p>
          <p className="tnum text-center text-4xl font-bold">{formatTZS(value)}</p>
          <Keypad value={amount} onChange={setAmount} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink-soft">{t('categoryLabel')}</p>
          <OptionGrid<ExpenseCategory> value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))} />
        </div>
        <OptionGrid<PaymentMethod>
          value={method}
          onChange={setMethod}
          columns={3}
          options={(['cash', 'mpesa', 'bank'] as const).map((m) => ({ value: m, label: tp(`methods.${m}`) }))}
        />
        <Field label={tc('note')} hint={tc('optional')}>
          {(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <Button size="xl" block disabled={value <= 0} onClick={() => void save()}>
          {t('add')}
        </Button>

        <section className="card px-4 py-2">
          <h2 className="pt-2 text-sm font-bold text-ink-soft">{t('todayTotal')}</h2>
          {todays?.length ? (
            todays.map((e) => <Row key={e.id} label={`${t(`categories.${e.category}`)}${e.note ? ` · ${e.note}` : ''}`} value={<Money value={-e.amount} />} tone="loss" />)
          ) : (
            <p className="py-3 text-sm text-ink-faint">{t('empty')}</p>
          )}
        </section>
      </div>
    </>
  );
}
