'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useApp } from '@/components/app-provider';
import { ColourPicker } from '@/components/colour-picker';
import { Plus, RefreshCw } from '@/components/icons';
import { SetupCodeSheet, type IssuedCode } from '@/components/setup-code-sheet';
import { SHOP_TYPE_OPTIONS } from '@/components/shop-types';
import { Badge, OptionGrid, PageHeader } from '@/components/ui/bits';
import { Button } from '@/components/ui/button';
import { Field, TextInput } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { createShop, issueCode, listShops, updateShop, type ShopSummary } from '@/lib/auth/accounts';
import { formatPhone, normalisePhone } from '@/lib/auth/phone';
import { isDemo, signOut } from '@/lib/auth/session';
import { DEFAULT_BRAND } from '@/lib/shop-config';
import type { BusinessType } from '@/lib/types';

/**
 * The operator's screen. Only a login with kitabu_admin (made by
 * `npm run operator`) gets anything back from the server here; for anyone
 * else the accounts function refuses every call.
 *
 *   - New shop: name, type, owner's phone, colour -> a setup code for the owner.
 *   - Every shop: pause / reactivate, and a fresh code for the owner.
 */
export default function AdminPage() {
  const t = useTranslations('admin');
  const tac = useTranslations('accounts');
  const to = useTranslations('onboarding');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');
  const toast = useToast();
  const router = useRouter();
  const { ready, userId, operator, businessId } = useApp();

  const [shops, setShops] = useState<ShopSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessType>('cosmetics');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [locale, setLocale] = useState<'sw' | 'en'>('sw');
  const [colour, setColour] = useState(DEFAULT_BRAND);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listShops();
    setLoading(false);
    if (result.ok) setShops(result.shops);
    else toast(tac(`errors.${result.error}`));
  }, [tac, toast]);

  useEffect(() => {
    if (!ready) return;
    if (!userId) router.replace('/ingia');
  }, [ready, userId, router]);

  useEffect(() => {
    if (ready && userId && operator && !isDemo()) {
      // Fetching is the effect's whole job; the result arrives in a callback.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load();
    }
  }, [ready, userId, operator, load]);

  if (!ready || !userId) return null;

  if (!operator || isDemo()) {
    return (
      <main className="mx-auto max-w-lg">
        <PageHeader title={t('title')} back />
        <p className="p-4 text-ink-soft">{isDemo() ? t('demoOnly') : t('notOperator')}</p>
      </main>
    );
  }

  const submit = async () => {
    setFormError(null);
    if (name.trim().length < 2) return setFormError(t('errors.name'));
    if (!normalisePhone(ownerPhone)) return setFormError(ta('invalidPhone'));
    setSaving(true);
    const result = await createShop({
      name: name.trim(),
      type,
      ownerName: ownerName.trim(),
      ownerPhone,
      locale,
      brandColor: colour === DEFAULT_BRAND ? null : colour,
    });
    setSaving(false);
    if (!result.ok) return setFormError(tac(`errors.${result.error}`));
    setCreating(false);
    setIssued({ name: ownerName.trim() || null, phone: normalisePhone(ownerPhone), code: result.code, shop: name.trim() });
    setName('');
    setOwnerName('');
    setOwnerPhone('');
    setColour(DEFAULT_BRAND);
    void load();
  };

  const ownerCode = async (shop: ShopSummary) => {
    if (!shop.owner) return;
    if (shop.owner.hasLogin && !window.confirm(t('resetConfirm', { shop: shop.name }))) return;
    setBusyId(shop.id);
    const result = await issueCode(shop.id, shop.owner.memberId);
    setBusyId(null);
    if (!result.ok) return toast(tac(`errors.${result.error}`));
    setIssued({ name: shop.owner.name, phone: shop.owner.phone, code: result.code, shop: shop.name });
    void load();
  };

  const toggle = async (shop: ShopSummary) => {
    const next = shop.status === 'paused' ? 'active' : 'paused';
    if (next === 'paused' && !window.confirm(t('pauseConfirm', { shop: shop.name }))) return;
    setBusyId(shop.id);
    const result = await updateShop(shop.id, { status: next });
    setBusyId(null);
    if (!result.ok) return toast(tac(`errors.${result.error}`));
    toast(next === 'paused' ? t('paused') : t('activated'));
    void load();
  };

  return (
    <main className="mx-auto min-h-dvh max-w-lg pb-12">
      <PageHeader
        title={t('title')}
        subtitle={shops ? t('count', { count: shops.length }) : undefined}
        back={Boolean(businessId)}
        action={
          <Button variant="ghost" size="icon" aria-label={t('refresh')} disabled={loading} onClick={() => void load()}>
            <RefreshCw size={22} className={loading ? 'animate-spin' : undefined} />
          </Button>
        }
      />

      <div className="p-4">
        <Button size="lg" block onClick={() => setCreating(true)}>
          <Plus size={22} />
          {t('newShop')}
        </Button>
      </div>

      <ul className="divide-y divide-line border-y border-line bg-surface">
        {shops?.map((shop) => (
          <li key={shop.id} className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-9 w-9 shrink-0 rounded-full"
                style={{ backgroundColor: shop.brandColor ?? DEFAULT_BRAND }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{shop.name}</span>
                <span className="block truncate text-sm text-ink-faint">
                  {to(`types.${shop.type}`)}
                  {shop.owner?.phone ? ` · ${shop.owner.name ? `${shop.owner.name}, ` : ''}${formatPhone(shop.owner.phone)}` : ''}
                  {shop.staff ? ` · ${t('staff', { count: shop.staff })}` : ''}
                </span>
              </span>
              {shop.status === 'paused' ? <Badge tone="loss">{t('statusPaused')}</Badge> : <Badge tone="brand">{t('statusActive')}</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={busyId === shop.id || !shop.owner} onClick={() => void ownerCode(shop)}>
                {shop.owner?.hasLogin ? t('ownerNewCode') : t('ownerFirstCode')}
              </Button>
              <Button variant="ghost" size="sm" disabled={busyId === shop.id} onClick={() => void toggle(shop)} className={shop.status === 'paused' ? 'text-brand' : 'text-loss'}>
                {shop.status === 'paused' ? t('activate') : t('pause')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {shops && shops.length === 0 ? <p className="p-6 text-center text-ink-soft">{t('empty')}</p> : null}

      <div className="p-4">
        <Button
          variant="ghost"
          block
          onClick={async () => {
            await signOut();
            router.replace('/ingia');
          }}
        >
          {ta('signOut')}
        </Button>
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title={t('newShop')}>
        <form
          className="space-y-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label={t('shopName')}>
            {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('shopNamePlaceholder')} />}
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-ink-soft">{t('shopType')}</p>
            <OptionGrid<BusinessType>
              columns={2}
              value={type}
              onChange={setType}
              options={SHOP_TYPE_OPTIONS.map(({ type: value, Icon }) => ({ value, label: to(`types.${value}`), icon: <Icon size={20} /> }))}
            />
          </div>
          <Field label={t('ownerName')} hint={tc('optional')}>
            {(id) => <TextInput id={id} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />}
          </Field>
          <Field label={t('ownerPhone')}>
            {(id) => <TextInput id={id} type="tel" inputMode="tel" placeholder={ta('phonePlaceholder')} value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />}
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-ink-soft">{t('language')}</p>
            <OptionGrid<'sw' | 'en'>
              columns={2}
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'sw', label: 'Kiswahili' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-ink-soft">{t('colour')}</p>
            <ColourPicker value={colour} onChange={setColour} label={t('colour')} />
          </div>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-loss">
              {formError}
            </p>
          ) : null}
          <Button type="submit" size="lg" block disabled={saving}>
            {saving ? tc('loading') : t('create')}
          </Button>
        </form>
      </Sheet>

      <SetupCodeSheet issued={issued} onClose={() => setIssued(null)} />
    </main>
  );
}
