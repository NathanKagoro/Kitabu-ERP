'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useApp } from '@/components/app-provider';
import { KeyRound, TrendingUp, UserPlus } from '@/components/icons';
import { SetupCodeSheet, type IssuedCode } from '@/components/setup-code-sheet';
import { Badge, EmptyState, OptionGrid, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { issueCode } from '@/lib/auth/accounts';
import { formatPhone, normalisePhone } from '@/lib/auth/phone';
import { isDemo } from '@/lib/auth/session';
import { personName } from '@/lib/auth/till';
import { nowIso } from '@/lib/date';
import { db } from '@/lib/local/db';
import { persist } from '@/lib/local/write';
import { sync } from '@/lib/sync/engine';
import type { Member, MemberRole } from '@/lib/types';
import { uuidv7 } from '@/lib/uuid';

const PinLock = dynamic(() => import('@/components/pin-lock').then((m) => m.PinLock));

/**
 * Staff. Two ways to work, and a person can have both:
 *
 *   - On the shop's own phone: a name and a 4-digit till PIN, set here with
 *     the person standing there. They take the till with "Nani anauza?" and
 *     every sale is theirs. No phone number, no login needed.
 *   - On their own phone: a phone number, then a setup code (Pata namba) for
 *     their own login. In the demo there is no server, so no codes.
 *
 * Adding someone works offline; a code needs a connection.
 */
export default function StaffPage() {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const tac = useTranslations('accounts');
  const tss = useTranslations('staffSales');
  const tt = useTranslations('till');
  const toast = useToast();
  const { businessId, loginMember: me, can, business } = useApp();
  const demo = isDemo();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<MemberRole>('cashier');
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [issuing, setIssuing] = useState<string | null>(null);
  const [settingPin, setSettingPin] = useState<Member | null>(null);

  const members = useLiveQuery(
    async () => (businessId ? (await db().members.where('businessId').equals(businessId).toArray()).filter((m) => m.active) : []),
    [businessId]
  );

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

  const add = async () => {
    setError(null);
    if (!businessId) return;
    const normalised = phone.trim() ? normalisePhone(phone) : null;
    if (phone.trim() && !normalised) return setError(ta('invalidPhone'));
    // Someone on the shop phone needs a name to pick from the list.
    if (!name.trim()) return setError(t('needName'));
    const at = nowIso();
    const row: Member = {
      id: uuidv7(),
      businessId,
      userId: null,
      name: name.trim(),
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
    // Their till PIN, straight away, while they are standing there.
    setSettingPin(row);
  };

  if (settingPin) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
        <PinLock
          mode="set"
          target={settingPin}
          onCancel={() => setSettingPin(null)}
          onDone={() => {
            const person = settingPin;
            setSettingPin(null);
            toast(tt('pinSaved', { name: personName(person, '') }));
            if (person.phone && !demo && !person.userId) void giveCode(person);
          }}
        />
      </div>
    );
  }

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
      <p className="px-4 pt-3 text-sm text-ink-soft">{tt('staffHint')}</p>
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
      <ul className="mt-3 divide-y divide-line border-y border-line bg-surface">
        {members?.map((m) => {
          const isMe = m.id === me?.id;
          const manageable = !isMe && m.role !== 'owner';
          return (
            <li key={m.id} className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{personName(m, '—')}</span>
                  <span className="block truncate text-sm text-ink-faint">
                    {m.phone ? formatPhone(m.phone) : tt('tillOnly')} · {t(`roleHints.${m.role}`)}
                  </span>
                </span>
                <Badge tone={m.role === 'owner' ? 'brand' : 'plain'}>{t(`roles.${m.role}`)}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {(isMe || manageable) && (
                  <Button variant="secondary" size="sm" onClick={() => setSettingPin(m)}>
                    <KeyRound size={16} />
                    {m.pinHash ? tt('changePin') : tt('setPin')}
                  </Button>
                )}
                {!demo && manageable && m.phone ? (
                  <Button variant="ghost" size="sm" disabled={issuing === m.id} onClick={() => void giveCode(m)}>
                    {issuing === m.id ? tc('loading') : m.userId ? tac('newCode') : tac('getCode')}
                  </Button>
                ) : null}
                {m.pinHash ? <Badge tone="info">{tt('hasPin')}</Badge> : null}
                {manageable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-loss"
                    onClick={() => {
                      if (window.confirm(t('removeConfirm', { name: m.name ?? m.phone ?? '' }))) {
                        void persist('members', { ...m, active: false, updatedAt: nowIso() });
                      }
                    }}
                  >
                    {t('remove')}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('invite')}>
        <div className="space-y-4 p-4">
          <Field label={tc('name')}>
            {(id) => <TextInput id={id} autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(null); }} />}
          </Field>
          <Field label={t('phoneLabel')} hint={tt('phoneOptional')} error={error}>
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
          <Button size="lg" block onClick={() => void add()}>
            {tt('addAndSetPin')}
          </Button>
        </div>
      </Sheet>
      <SetupCodeSheet issued={issued} onClose={() => setIssued(null)} />
    </>
  );
}
