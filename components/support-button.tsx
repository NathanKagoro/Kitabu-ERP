'use client';

import { useTranslations } from 'next-intl';

import { MessageCircle } from '@/components/icons';
import { cn } from '@/lib/cn';
import { hasSupport, supportLink } from '@/lib/support';

/**
 * "Contact us on WhatsApp": for a forgotten password, a lost setup code, or
 * anything else. Opens a chat with the operator, message already typed.
 * Hidden when no support number was set at build time.
 */
export function SupportButton({ message, label, className }: { message: string; label?: string; className?: string }) {
  const t = useTranslations('support');
  if (!hasSupport()) return null;
  return (
    <a
      href={supportLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex h-12 w-full items-center justify-center gap-2 rounded-[10px] font-semibold text-brand active:bg-line/40',
        className
      )}
    >
      <MessageCircle size={20} />
      {label ?? t('contact')}
    </a>
  );
}
