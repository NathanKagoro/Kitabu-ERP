'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Check, MessageCircle } from '@/components/icons';
import { EmptyState, OptionGrid, PageHeader } from '@/components/ui/bits';
import { Field, TextArea } from '@/components/ui/field';
import { formatPhone } from '@/lib/auth/phone';
import { cn } from '@/lib/cn';
import { firstName, inAudience, offerRecipients, type Audience } from '@/lib/customers';
import { businessDay } from '@/lib/date';
import { useCustomers } from '@/lib/local/queries';
import { useCustomerStats } from '@/lib/local/report-queries';
import { fillTemplate, whatsappLink } from '@/lib/receipt';

/**
 * Send an offer. WhatsApp only lets a link open one chat with the message
 * typed in, so this is a list: tap a name, WhatsApp opens with that person's
 * own message ("Habari Asha..."), press send, come back, tap the next. The
 * list remembers who has been done, even if the phone switches apps.
 */

const STORE = 'kitabu:offer';

interface Progress {
  message: string;
  sent: string[];
}

function load(businessId: string | null): Progress | null {
  if (!businessId) return null;
  try {
    return JSON.parse(localStorage.getItem(`${STORE}:${businessId}`) ?? 'null') as Progress | null;
  } catch {
    return null;
  }
}

function store(businessId: string, progress: Progress) {
  try {
    localStorage.setItem(`${STORE}:${businessId}`, JSON.stringify(progress));
  } catch {
    // Private mode: progress lasts until the page closes.
  }
}

export default function OfferRoute() {
  return (
    <Suspense>
      <OfferPage />
    </Suspense>
  );
}

function OfferPageInner() {
  const t = useTranslations('clients');
  const params = useSearchParams();
  const { businessId, business } = useApp();
  const customers = useCustomers(businessId);
  const stats = useCustomerStats(businessId);
  const initial = load(businessId);

  const [audience, setAudience] = useState<Audience>(() => {
    const from = params.get('kwa');
    return from === 'recent' || from === 'away' ? from : 'all';
  });
  // The template keeps {jina} and {duka} as words to fill per customer.
  const [message, setMessage] = useState(initial?.message ?? t('offerTemplate'));
  const [sent, setSent] = useState<string[]>(initial?.sent ?? []);

  useEffect(() => {
    if (businessId) store(businessId, { message, sent });
  }, [businessId, message, sent]);

  const today = businessDay();
  const recipients = useMemo(
    () => offerRecipients((customers ?? []).filter((c) => inAudience(audience, stats?.get(c.id)?.lastAt, today))),
    [customers, stats, audience, today]
  );
  const done = recipients.filter((r) => sent.includes(r.e164)).length;

  const personal = (name: string) => fillTemplate(message, { jina: firstName(name), name: firstName(name), duka: business?.name ?? '', shop: business?.name ?? '' });

  return (
    <>
      <PageHeader title={t('offerTitle')} subtitle={t('offerSubtitle')} />
      <div className="space-y-4 p-4">
        <OptionGrid<Audience>
          columns={3}
          value={audience}
          onChange={setAudience}
          options={(['all', 'recent', 'away'] as const).map((a) => ({ value: a, label: t(`audience.${a}`) }))}
        />
        <Field label={t('messageLabel')} hint={t('messageHint')}>
          {(id) => <TextArea id={id} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />}
        </Field>
        {recipients[0] ? (
          <div className="rounded-[12px] bg-brand-tint px-3 py-2.5 text-sm whitespace-pre-wrap text-ink">
            <p className="mb-1 text-xs font-semibold text-brand-dark">{t('preview', { name: recipients[0].name })}</p>
            {personal(recipients[0].name)}
          </div>
        ) : null}
        <div className="flex items-center justify-between text-sm font-semibold text-ink-soft">
          <span>{t('progress', { done, total: recipients.length })}</span>
          {sent.length > 0 && (
            <button className="h-11 px-2 text-brand" onClick={() => setSent([])}>
              {t('startOver')}
            </button>
          )}
        </div>
      </div>

      {recipients.length === 0 ? (
        <p className="px-6 pb-8 text-center text-ink-soft">{t('noRecipients')}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line bg-surface pb-2">
          {recipients.map((r) => {
            const isSent = sent.includes(r.e164);
            return (
              <li key={r.id}>
                <a
                  href={whatsappLink(personal(r.name), r.e164)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSent((list) => (list.includes(r.e164) ? list : [...list, r.e164]))}
                  className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-paper"
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate font-semibold', isSent && 'text-ink-faint')}>{r.name}</span>
                    <span className="block text-sm text-ink-faint">{formatPhone(r.e164)}</span>
                  </span>
                  {isSent ? (
                    <span className="flex items-center gap-1 text-sm font-semibold text-brand">
                      <Check size={18} />
                      {t('sent')}
                    </span>
                  ) : (
                    <span className="flex h-11 items-center gap-1.5 rounded-[10px] bg-brand px-3 text-sm font-semibold text-white">
                      <MessageCircle size={18} />
                      {t('send')}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** Owners and managers only: the customer list is the shop's, not the till's. */
function OfferPage() {
  const { can } = useApp();
  const tg = useTranslations('errors');
  if (!can('customerList')) {
    return (
      <>
        <PageHeader title="" />
        <EmptyState title={tg('noAccess')} />
      </>
    );
  }
  return <OfferPageInner />;
}
