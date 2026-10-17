'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { TrendingUp, UserPlus } from '@/components/icons';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { Badge, EmptyState, OptionGrid, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { formatPhone, normalisePhone } from '@/lib/auth/phone';
import { nowIso } from '@/lib/date';
import { db } from '@/lib/local/db';
import { persist } from '@/lib/local/write';
import type { Member, MemberRole } from '@/lib/types';
import { issueCode } from '@/lib/auth/accounts';
import { isDemo } from '@/lib/auth/session';
import { sync } from '@/lib/sync/engine';
import { SetupCodeSheet, type IssuedCode } from '@/components/setup-code-sheet';
import { uuidv7 } from '@/lib/uuid';

/**
 * Adding someone makes a member row (works offline), then asks the server for
 * their first login: a setup code the owner hands over, by WhatsApp or by
 * reading it out. They sign in with their phone number and that code, and
 * choose a password. "New code" resets a forgotten password the same way.
 * In the demo there is no server, so there are no codes.
 */
export default function StaffPage() {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const toast = useToast();
  const { businessId, member: me, can } = useApp();
  const tss = useTranslations('staffSales');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<MemberRole>('cashier');
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [issuing, setIssuing] = useState<string | null>(null);
  const tac = useTranslations('accounts');
  const { business } = useApp();
  const demo = isDemo();

  /** Sync first (the server must have the row), then ask for a code. */
  const giveCode = async (m: Member) => {
    if (!businessId) return;
    setIssuing(m.id);
    await sync();
    let result = await issueCode(businessId, m.id);
    if (!result.ok && result.error === 'noMember') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await sync();
      result = await issueCode(businessId, m.id);
    }
    setIssuing(null);
    if (!result.ok) return toast(tac(`errors.${result.error}`));
    void sync();
    setIssued({ name: m.name ?? null, phone: m.phone ?? null, code: result.code, shop: business?.name ?? '' });
  };

  const members = useLiveQuery(
    async () => (businessId ? (await db().members.where('businessId').equals(businessId).toArray()).filter((m) => m.active) : []),
    [businessId]
  );

  const invite = async () => {
    const normalised = normalisePhone(phone);
    if (!normalised) return setError(ta('invalidPhone'));
    if (!businessId) return;
    const at = nowIso();
    const row: Member = {
      id: uuidv7(),
      businessId,
      userId: null,
      name: name.trim() || null,
      phone: normalised,
      role,
      pinHash: null,
      active: true,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
    };
    await persist('members', row);
    setOpen(false);
    setName('');
    setPhone('');
    if (demo) return toast(t('invited'));
    await giveCode(row);
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        action={
          <Button variant="ghost" size="icon" aria-label={t('invite')} onClick={() => setOpen(true)}>
            <UserPlus size={24} />
          </Button>
        }
      />
      {members && members.length > 1 && can('viewStaffSales') ? (
        <div className="px-3 pt-3">
          <Link
            href="/wafanyakazi/mauzo"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-surface font-semibold text-brand active:bg-paper"
          >
            <TrendingUp size={20} />
            {tss('title')}
          </Link>
        </div>
      ) : null}
      {members && members.length <= 1 ? <EmptyState title={t('empty')} /> : null}
      <ul className="divide-y divide-line">
        {members?.map((m) => (
          <li key={m.id} className="flex min-h-16 items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{m.name ?? (m.phone ? formatPhone(m.phone) : '—')}</span>
              <span className="text-sm text-ink-faint">{t(`roleHints.${m.role}`)}</span>
            </span>
            {!m.userId ? <Badge tone="info">{t('invited')}</Badge> : null}
            {!demo && m.id !== me?.id && m.role !== 'owner' ? (
              <Button variant="ghost" size="sm" disabled={issuing === m.id} onClick={() => void giveCode(m)}>
                {issuing === m.id ? tc('loading') : m.userId ? tac('newCode') : tac('getCode')}
              </Button>
            ) : null}
            <Badge tone={m.role === 'owner' ? 'brand' : 'plain'}>{t(`roles.${m.role}`)}</Badge>
            {m.id !== me?.id && m.role !== 'owner' ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-loss"
                onClick={() => {
                  if (window.confirm(t('removeConfirm', { name: m.name ?? m.phone ?? '' }))) {
                    void persist('members', { ...m, active: false, updatedAt: nowIso() });
                  }
                }}
              >
                {t('remove')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('invite')}>
        <div className="space-y-4 p-4">
          <Field label={tc('name')} hint={tc('optional')}>
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label={t('phoneLabel')} error={error}>
            {(id) => <TextInput id={id} type="tel" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(null); }} />}
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-ink-soft">{t('roleLabel')}</p>
            <OptionGrid<MemberRole>
              columns={1}
              value={role}
              onChange={setRole}
              options={(['manager', 'cashier'] as const).map((r) => ({ value: r, label: t(`roles.${r}`), hint: t(`roleHints.${r}`) }))}
            />
          </div>
          <Button size="lg" block onClick={() => void invite()}>
            {t('invite')}
          </Button>
        </div>
      </Sheet>
      <SetupCodeSheet issued={issued} onClose={() => setIssued(null)} />
    </>
  );
}
