'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { db, getMeta, META_KEYS } from '@/lib/local/db';
import { activeMemberKey } from '@/lib/auth/till-person';
import { roleCan, type Feature, type Permission } from '@/lib/modes';
import { shopHasFeature } from '@/lib/shop-config';
import type { Business, BusinessMode, Member, MemberRole } from '@/lib/types';

interface AppState {
  /** False until the local database has answered. Nothing should flash before this. */
  ready: boolean;
  userId: string | null;
  businessId: string | null;
  /** Signed in with a setup code and has not chosen a password yet. */
  mustSetPassword: boolean;
  /** This login is the operator (see /admin). */
  operator: boolean;
  business: Business | null;
  /**
   * The person at the till. On a shared phone this is whoever chose
   * themselves in "Nani anauza?" with their PIN; otherwise the signed-in login.
   * Sales, payments and permissions follow this person.
   */
  member: Member | null;
  /** The signed-in login's own membership (the phone's account holder). */
  loginMember: Member | null;
  /** Everyone who can take over this phone's till with a PIN. */
  tillPeople: Member[];
  role: MemberRole;
  mode: BusinessMode;
  vatRate: number;
  show: (feature: Feature) => boolean;
  can: (permission: Permission) => boolean;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const state = useLiveQuery(async () => {
    const [userId, businessId, mustSetPassword, operator] = await Promise.all([
      getMeta<string | null>(META_KEYS.userId, null),
      getMeta<string | null>(META_KEYS.activeBusinessId, null),
      getMeta<boolean>(META_KEYS.mustSetPassword, false),
      getMeta<boolean>(META_KEYS.operator, false),
    ]);

    const business = businessId ? ((await db().businesses.get(businessId)) ?? null) : null;
    const members = businessId ? await db().members.where('businessId').equals(businessId).toArray() : [];
    const live = members.filter((m) => m.active && !m.deletedAt);
    const loginMember = (userId && live.find((m) => m.userId === userId)) || null;
    const tillPeople = live.filter((m) => m.pinHash).sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : (a.name ?? '').localeCompare(b.name ?? '')));
    const activeId = businessId ? await getMeta<string | null>(activeMemberKey(businessId), null) : null;
    const active = activeId ? (tillPeople.find((m) => m.id === activeId) ?? null) : null;
    const member = active ?? loginMember;

    return { userId, businessId, business, member, loginMember, tillPeople, mustSetPassword, operator };
  }, []);

  const mode: BusinessMode = state?.business?.mode ?? 'genge';
  // The owner is whoever set the business up; a device with no member row yet
  // is mid-onboarding, and treating them as owner avoids a locked-out first run.
  const role: MemberRole = state?.member?.role ?? 'owner';

  const business = state?.business ?? null;
  const show = useCallback((feature: Feature) => shopHasFeature(business, feature), [business]);
  const can = useCallback((permission: Permission) => roleCan(role, permission), [role]);

  const value = useMemo<AppState>(
    () => ({
      ready: state !== undefined,
      userId: state?.userId ?? null,
      businessId: state?.businessId ?? null,
      mustSetPassword: state?.mustSetPassword ?? false,
      operator: state?.operator ?? false,
      business: state?.business ?? null,
      member: state?.member ?? null,
      loginMember: state?.loginMember ?? null,
      tillPeople: state?.tillPeople ?? [],
      role,
      mode,
      vatRate: Number(state?.business?.settings?.vatRate ?? 18) / 100,
      show,
      can,
    }),
    [state, role, mode, show, can]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}

/**
 * For the many screens that cannot do anything without a business. Returns the
 * id or null; callers render a loader while null.
 */
export function useBusinessId(): string | null {
  return useApp().businessId;
}
