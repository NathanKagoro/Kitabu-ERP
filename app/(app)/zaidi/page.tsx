'use client';

import {
  ChevronRight,
  FileText,
  LogOut,
  MessageSquareText,
  Package,
  Receipt,
  Settings,
  Tag,
  Trash,
  TrendingUp,
  Truck,
  Users,
} from '@/components/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { useApp } from '@/components/app-provider';
import { FeedbackButton } from '@/components/feedback';
import { PageHeader } from '@/components/ui/bits';
import { signOut } from '@/lib/auth/session';
import { clearUnlocked } from '@/lib/auth/unlock';
import type { Feature, Permission } from '@/lib/modes';

interface Item {
  href: string;
  label: string;
  icon: ReactNode;
  feature?: Feature;
  permission?: Permission;
}

export default function MorePage() {
  const t = useTranslations();
  const router = useRouter();
  const { show, can } = useApp();

  const sections: { title: string; items: Item[] }[] = [
    {
      title: t('more.sections.shop'),
      items: [
        { href: '/bidhaa', label: t('products.title'), icon: <Package size={22} />, feature: 'products' },
        { href: '/bei', label: t('prices.title'), icon: <Tag size={22} />, feature: 'dailyPriceUpdate', permission: 'managePrices' },
        { href: '/hasara', label: t('waste.title'), icon: <Trash size={22} />, feature: 'waste', permission: 'manageProducts' },
      ],
    },
    {
      title: t('more.sections.money'),
      items: [
        { href: '/matumizi', label: t('expenses.title'), icon: <Receipt size={22} />, feature: 'expenses', permission: 'recordExpense' },
        { href: '/faida', label: t('profit.title'), icon: <TrendingUp size={22} />, permission: 'viewProfit' },
        { href: '/wauzaji', label: t('suppliers.title'), icon: <Truck size={22} />, feature: 'suppliers', permission: 'recordPurchase' },
      ],
    },
    {
      title: t('more.sections.business'),
      items: [
        { href: '/hati', label: t('documents.title'), icon: <FileText size={22} />, feature: 'documents', permission: 'manageDocuments' },
        { href: '/wafanyakazi', label: t('staff.title'), icon: <Users size={22} />, feature: 'staff', permission: 'manageStaff' },
      ],
    },
    {
      title: t('more.sections.system'),
      items: [{ href: '/mipangilio', label: t('settings.title'), icon: <Settings size={22} />, permission: 'manageSettings' }],
    },
  ];

  return (
    <>
      <PageHeader title={t('more.title')} back={false} />
      {sections.map((section) => {
        const items = section.items.filter(
          (item) => (!item.feature || show(item.feature)) && (!item.permission || can(item.permission))
        );
        if (items.length === 0) return null;
        return (
          <section key={section.title} className="px-3 pt-4">
            <h2 className="px-1 pb-1.5 text-sm font-bold text-ink-soft">{section.title}</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex min-h-14 items-center gap-3 px-4 active:bg-paper">
                    <span className="text-brand">{item.icon}</span>
                    <span className="flex-1 font-semibold">{item.label}</span>
                    <ChevronRight size={20} className="text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="space-y-2 px-3 pt-4 pb-4">
        <FeedbackButton icon={<MessageSquareText size={22} />} />
        <button
          onClick={() =>
            void (async () => {
              if (!window.confirm(t('auth.signOutConfirm'))) return;
              clearUnlocked();
              await signOut();
              router.replace('/ingia');
            })()
          }
          className="card flex min-h-14 w-full items-center gap-3 px-4 text-left font-semibold text-loss active:bg-paper"
        >
          <LogOut size={22} />
          {t('auth.signOut')}
        </button>
      </section>
    </>
  );
}
