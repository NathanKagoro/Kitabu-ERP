'use client';

import { useTranslations } from 'next-intl';

import { MessageCircle } from '@/components/icons';
import { Sheet } from '@/components/ui/sheet';
import { formatPhone } from '@/lib/auth/phone';
import { formatSetupCode } from '@/lib/auth/login';
import { whatsappLink } from '@/lib/receipt';
import { withBase } from '@/lib/base-path';

export interface IssuedCode {
  name: string | null;
  phone: string | null;
  /** null: they already have a login and keep their password. */
  code: string | null;
  shop: string;
}

/**
 * Shows a freshly issued setup code, large enough to read out, with a button
 * that sends it -- and the link to the app -- to that person on WhatsApp.
 */
export function SetupCodeSheet({ issued, onClose }: { issued: IssuedCode | null; onClose: () => void }) {
  const t = useTranslations('accounts');
  if (!issued) return null;

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}${withBase('/ingia/')}` : '';
  const message = issued.code
    ? t('codeMessage', { shop: issued.shop, phone: issued.phone ? formatPhone(issued.phone) : '', code: formatSetupCode(issued.code), url: appUrl })
    : t('linkedMessage', { shop: issued.shop, url: appUrl });

  return (
    <Sheet open onClose={onClose} title={issued.code ? t('codeTitle') : t('linkedTitle')}>
      <div className="space-y-4 p-4">
        <p className="text-ink-soft">
          {issued.code
            ? t('codeBody', { name: issued.name ?? (issued.phone ? formatPhone(issued.phone) : '') })
            : t('linkedBody', { name: issued.name ?? (issued.phone ? formatPhone(issued.phone) : '') })}
        </p>
        {issued.code ? (
          <p className="tnum rounded-[12px] border border-line-strong bg-surface py-5 text-center font-mono text-4xl font-bold tracking-[0.15em] select-all">
            {formatSetupCode(issued.code)}
          </p>
        ) : null}
        <a
          href={whatsappLink(message, issued.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-brand text-lg font-semibold text-white active:bg-brand-dark"
        >
          <MessageCircle size={22} />
          {t('sendWhatsapp')}
        </a>
        {issued.code ? <p className="text-sm text-ink-faint">{t('codeOnce')}</p> : null}
      </div>
    </Sheet>
  );
}
