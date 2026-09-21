'use client';

import { BookUser, LayoutGrid, Menu, Wallet } from '@/components/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/mauzo', key: 'sales', Icon: Wallet },
  { href: '/madeni', key: 'credit', Icon: BookUser },
  { href: '/hesabu', key: 'summary', Icon: LayoutGrid },
  { href: '/zaidi', key: 'more', Icon: Menu },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav
      aria-label={t('more')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)]"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-[68px] flex-col items-center justify-center gap-1',
                  active ? 'text-brand' : 'text-ink-faint'
                )}
              >
                <Icon size={24} strokeWidth={active ? 2.4 : 2} />
                <span className={cn('text-xs', active ? 'font-bold' : 'font-medium')}>
                  {t(key)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
