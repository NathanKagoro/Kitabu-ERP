'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { HandCoins, MessageCircle } from '@/components/icons';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';

import { hasOfferConsent } from '@/lib/customers';
import { nowIso } from '@/lib/date';
import { useApp } from '@/components/app-provider';
import { paymentMethodsOf } from '@/lib/shop-config';
import { useLastPaidLabel } from '@/components/customers/last-paid';
import { Money, OptionGrid, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Keypad, parseKeypad } from '@/components/ui/keypad';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { customerBalance, isCreditCharge, isDebtRepayment, lastPaymentByCustomer } from '@/lib/calc/credit';
import { cn } from '@/lib/cn';
import { recordDebtPayment, updateCustomer } from '@/lib/local/actions';
import { SwitchRow } from '@/components/ui/switch';
import { normalisePhone } from '@/lib/auth/phone';
import { db } from '@/lib/local/db';
import { formatTZS } from '@/lib/money';
import { fillTemplate, whatsappLink } from '@/lib/receipt';
import type { PaymentMethod } from '@/lib/types';

/** Static hosting has no per-record pages, so the record comes in as ?id=. */
export default function CustomerPageRoute() {
  return (
    <Suspense>
      <CustomerPage />
    </Suspense>
  );
}

function CustomerPage() {
  const id = useSearchParams().get('id') ?? '';
  const t = useTranslations('customers');
  const tp = useTranslations('payment');
  const tc = useTranslations('common');
  const toast = useToast();
  const { businessId, userId, business, member } = useApp();
  const lastPaid = useLastPaidLabel();

  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(() => paymentMethodsOf(business)[0] ?? 'cash');
  const [reference, setReference] = useState('');
  const tcl = useTranslations('clients');
  const ta = useTranslations('auth');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const customer = await db().customers.get(id);
    if (!customer) return null;
    const payments = await db().payments.where('customerId').equals(id).toArray();
    const entries = payments
      .filter((p) => isCreditCharge(p) || isDebtRepayment(p))
      .sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));
    let running = 0;
    const history = entries.map((p) => {
      running += isCreditCharge(p) ? p.amount : -p.amount;
      return { payment: p, charge: isCreditCharge(p), running };
    });
    return {
      customer,
      balance: customerBalance(payments),
      lastPaidAt: lastPaymentByCustomer(payments).get(id) ?? null,
      history: history.reverse(),
    };
  }, [id]);

  if (!data) return <PageHeader title="" />;
  const { customer, balance, history } = data;

  const template = business?.settings.reminderTemplate?.trim();
  const values = { name: customer.name, business: business?.name ?? '', balance: formatTZS(balance) };
  const reminder = template ? fillTemplate(template, values) : t('reminderTemplate', values);

  const value = Math.round(parseKeypad(amount));
  const save = async () => {
    if (!businessId || value <= 0) return;
    await recordDebtPayment({ businessId, userId, memberId: member?.id ?? null, customerId: id, amount: value, method, reference: reference.trim() || null });
    toast(t('paymentRecorded'));
    setPaying(false);
    setAmount('');
    setReference('');
  };

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', timeZone: 'Africa/Dar_es_Salaam' });

  return (
    <>
      <PageHeader title={customer.name} subtitle={customer.phone ?? t('noPhone')} />

      <section className="card m-3 p-4">
        <p className="text-sm font-medium text-ink-soft">{balance > 0 ? t('owes') : t('owesNothing')}</p>
        <Money value={Math.max(balance, 0)} symbol className={cn('text-3xl font-bold', balance > 0 ? 'text-debt' : 'text-ink')} />
        {balance > 0 ? <p className="text-sm text-ink-faint">{lastPaid(data.lastPaidAt)}</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => setPaying(true)} disabled={balance <= 0}>
            <HandCoins size={20} />
            {t('recordPayment')}
          </Button>
          {customer.phone ? (
            <a
              href={whatsappLink(reminder, customer.phone)}
              target="_blank"
              rel="noreferrer"
              aria-disabled={balance <= 0}
              className={cn(
                'flex h-14 items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface text-lg font-semibold',
                balance <= 0 && 'pointer-events-none opacity-45'
              )}
            >
              <MessageCircle size={20} className="text-brand" />
              {t('remind')}
            </a>
          ) : (
            <p className="flex items-center text-xs text-ink-faint">{t('addPhoneToRemind')}</p>
          )}
        </div>
      </section>

      <section className="card mx-3 mb-3 overflow-hidden">
        <SwitchRow
          checked={hasOfferConsent(customer)}
          onChange={(on) =>
            void updateCustomer({ ...customer, offersConsentAt: on ? nowIso() : null, noOffers: !on }).then(() => toast(tc('saved')))
          }
          label={tcl('getsOffers')}
          hint={customer.phone ? tcl('getsOffersHint') : t('addPhoneToRemind')}
        />
        <button
          onClick={() => {
            setEditName(customer.name);
            setEditPhone(customer.phone ?? '');
            setEditing(true);
          }}
          className="flex min-h-14 w-full items-center border-t border-line px-4 text-left font-semibold text-brand active:bg-paper"
        >
          {tcl('editDetails')}
        </button>
      </section>

      <h2 className="px-4 pt-2 pb-1.5 text-sm font-bold text-ink-soft">{t('history')}</h2>
      <ul className="card mx-3 divide-y divide-line">
        {history.map(({ payment, charge, running }) => (
          <li key={payment.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-14 shrink-0 text-sm text-ink-faint">{date(payment.clientCreatedAt)}</span>
            <span className="min-w-0 flex-1 text-[15px]">
              {charge ? t('creditSale') : `${t('payment')} · ${tp(`methods.${payment.method}`)}`}
            </span>
            <span className="text-right">
              <Money value={charge ? payment.amount : -payment.amount} signed className={cn('block font-semibold', charge ? 'text-debt' : 'text-brand')} />
              <Money value={running} className="block text-xs text-ink-faint" />
            </span>
          </li>
        ))}
        {history.length === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-faint">{tc('nothingYet')}</li> : null}
      </ul>

      <Sheet open={editing} onClose={() => setEditing(false)} title={tcl('editDetails')}>
        <div className="space-y-3 p-4">
          <Field label={tc('name')}>{(fid) => <TextInput id={fid} value={editName} onChange={(e) => setEditName(e.target.value)} />}</Field>
          <Field label={tc('phone')} error={editError}>
            {(fid) => (
              <TextInput id={fid} type="tel" inputMode="tel" value={editPhone} onChange={(e) => { setEditPhone(e.target.value); setEditError(null); }} />
            )}
          </Field>
          <Button
            size="lg"
            block
            disabled={!editName.trim()}
            onClick={() =>
              void (async () => {
                if (editPhone.trim() && !normalisePhone(editPhone)) return setEditError(ta('invalidPhone'));
                await updateCustomer({ ...customer, name: editName.trim(), phone: editPhone.trim() ? normalisePhone(editPhone) : null });
                setEditing(false);
                toast(tc('saved'));
              })()
            }
          >
            {tc('save')}
          </Button>
        </div>
      </Sheet>

      <Sheet open={paying} onClose={() => setPaying(false)} title={t('paymentAmount')}>
        <div className="space-y-4 p-4">
          <p className="tnum text-center text-4xl font-bold">{formatTZS(value)}</p>
          <Button variant="secondary" block onClick={() => setAmount(String(balance))}>
            {t('payAll')} · {formatTZS(balance)}
          </Button>
          <Keypad value={amount} onChange={setAmount} />
          <OptionGrid<PaymentMethod>
            value={method}
            onChange={setMethod}
            columns={3}
            options={paymentMethodsOf(business).map((m) => ({ value: m, label: tp(`methods.${m}`) }))}
          />
          {method !== 'cash' && (
            <Field label={tp('reference')} hint={tp('referenceHint')}>
              {(fieldId) => <TextInput id={fieldId} value={reference} onChange={(e) => setReference(e.target.value)} />}
            </Field>
          )}
          <Button size="xl" block disabled={value <= 0} onClick={() => void save()}>
            {tc('save')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
