'use client';

import { useLocale, useTranslations } from 'next-intl';

import { MessageCircle } from '@/components/icons';
import { Money } from '@/components/ui/bits';
import { lineDifference, RECOUNT_AFTER_DAYS, shortLines, summariseCount } from '@/lib/calc/stock-count';
import { addDays, businessDay } from '@/lib/date';
import { formatTZS } from '@/lib/money';
import { whatsappLink } from '@/lib/receipt';
import type { StockCount } from '@/lib/types';
import { formatQty } from '@/lib/units';

/**
 * The stock-check result. Leads with the one number an owner remembers --
 * what went missing, in shillings, at what they paid for it -- then what it
 * would have sold for, then the worst items. One button sends the summary
 * on WhatsApp (to the owner, or from the operator after a visit).
 */
export function CountReport({
  count,
  shopName,
  lines = count.lines,
  corrected = 0,
}: {
  count: StockCount;
  shopName: string;
  /** The lines with "expected" re-read from the ledger now (late-synced sales included). */
  lines?: StockCount['lines'];
  corrected?: number;
}) {
  const t = useTranslations('stockCheck');
  const locale = useLocale();
  const s = summariseCount(lines);
  const worst = shortLines(lines);
  const over = lines.filter((line) => lineDifference(line) > 0);
  const day = businessDay(count.clientCreatedAt);
  const recount = addDays(day, RECOUNT_AFTER_DAYS);
  const dateText = (d: string) =>
    new Date(`${d}T12:00:00+03:00`).toLocaleDateString(locale === 'sw' ? 'sw-TZ' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const lead = s.valueShortCost > 0 ? s.valueShortCost : s.valueShortPrice;

  const message = [
    t('shareTitle', { shop: shopName, date: dateText(day) }),
    t('shareCounted', { count: s.itemsCounted }),
    s.linesShort > 0
      ? t('shareShort', { units: formatQty(s.unitsShort), lines: s.linesShort, value: formatTZS(lead, { symbol: true }) })
      : t('shareNoneShort'),
    ...worst.slice(0, 5).map((line) => `• ${line.name}: ${t('shareLine', { qty: formatQty(line.missing) })}`),
    count.kind === 'opening' ? t('shareRecount', { date: dateText(recount) }) : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="space-y-4 p-4">
      <section
        className={
          s.linesShort > 0
            ? 'rounded-[14px] bg-loss px-5 py-5 text-white'
            : 'rounded-[14px] bg-brand px-5 py-5 text-white'
        }
      >
        <p className="text-sm font-semibold opacity-90">
          {count.kind === 'opening' ? t('openingLead') : t('checkLead')} · {dateText(day)}
          {count.scope ? ` · ${count.scope}` : ''}
        </p>
        {s.linesShort > 0 ? (
          <>
            <p className="mt-1 text-[28px] leading-tight font-bold">
              {t('headlineShort', { units: s.unitsShort })}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {t('headlineWorth')} <Money value={lead} symbol className="text-2xl font-bold" />
            </p>
            <p className="mt-1 text-sm opacity-90">
              {s.valueShortCost > 0 ? t('atCost') : t('atPrice')}
              {s.valueShortCost > 0 && s.valueShortPrice > s.valueShortCost
                ? ` · ${t('wouldHaveSold', { value: formatTZS(s.valueShortPrice, { symbol: true }) })}`
                : ''}
            </p>
          </>
        ) : (
          <p className="mt-1 text-2xl font-bold">{t('headlineNone')}</p>
        )}
      </section>

      {corrected > 0 ? (
        <p className="rounded-[10px] bg-info-tint px-3 py-2.5 text-sm font-medium text-info">
          {t('correctedNote', { count: corrected })}
        </p>
      ) : null}

      <dl className="card grid grid-cols-3 divide-x divide-line text-center">
        <div className="px-2 py-3">
          <dt className="text-xs font-semibold text-ink-soft">{t('statCounted')}</dt>
          <dd className="tnum text-xl font-bold">{s.itemsCounted}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs font-semibold text-ink-soft">{t('statShortLines')}</dt>
          <dd className="tnum text-xl font-bold text-loss">{s.linesShort}</dd>
        </div>
        <div className="px-2 py-3">
          <dt className="text-xs font-semibold text-ink-soft">{t('statOverLines')}</dt>
          <dd className="tnum text-xl font-bold text-info">{s.linesOver}</dd>
        </div>
      </dl>

      {s.shortWithoutCost > 0 && s.valueShortCost > 0 ? (
        <p className="rounded-[10px] bg-debt-tint px-3 py-2.5 text-sm font-medium text-debt">
          {t('noCostWarning', { count: s.shortWithoutCost })}
        </p>
      ) : null}

      {worst.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-bold text-ink-soft">{t('missingList')}</h2>
          <ul className="divide-y divide-line">
            {worst.map((line) => (
              <li key={line.productId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{line.name}</span>
                  <span className="text-sm text-ink-faint">
                    {t('expectedCounted', { expected: formatQty(line.expected), counted: formatQty(line.counted) })}
                  </span>
                </span>
                <span className="text-right">
                  <span className="tnum block font-bold text-loss">−{formatQty(line.missing)}</span>
                  <Money value={line.lostCost} className="text-sm text-ink-soft" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {over.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-bold text-ink-soft">{t('overList')}</h2>
          <ul className="divide-y divide-line">
            {over.map((line) => (
              <li key={line.productId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate font-semibold">{line.name}</span>
                <span className="tnum font-bold text-info">+{formatQty(lineDifference(line))}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2.5 text-sm text-ink-faint">{t('overHint')}</p>
        </section>
      )}

      {count.kind === 'opening' && (
        <p className="rounded-[10px] bg-info-tint px-3 py-2.5 text-sm font-medium text-info">
          {t('recountNote', { date: dateText(recount) })}
        </p>
      )}

      <a
        href={whatsappLink(message)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-brand text-lg font-semibold text-white active:bg-brand-dark"
      >
        <MessageCircle size={22} />
        {t('share')}
      </a>
    </div>
  );
}
