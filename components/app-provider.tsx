'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { db, getMeta, META_KEYS } from '@/lib/local/db';
import { hasFeature, roleCan, type Feature, type Permission } from '@/lib/modes';
import type { Business, BusinessMode, Member, MemberRole } from '@/lib/types';

interface AppState {
  /** False until the local database has answered. Nothing should flash before this. */
  ready: boolean;
  userId: string | null;
  businessId: string | null;
  business: Business | null;
  member: Member | null;
  role: MemberRole;
  mode: BusinessMode;
  vatRate: number;
  show: (feature: Feature) => boolean;
  can: (permission: Permission) => boolean;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const state = useLiveQuery(async () => {
    const [userId, businessId] = await Promise.all([
      getMeta<string | null>(META_KEYS.userId, null),
      getMeta<string | null>(META_KEYS.activeBusinessId, null),
    ]);

    const business = businessId ? ((await db().businesses.get(businessId)) ?? null) : null;
    const member =
      businessId && userId
        ? ((await db()
            .members.where('businessId')
            .equals(businessId)
            .filter((m) => m.userId === userId)
            .first()) ?? null)
        : null;

    return { userId, businessId, business, member };
  }, []);

  const mode: BusinessMode = state?.business?.mode ?? 'genge';
  // The owner is whoever set the business up; a device with no member row yet
  // is mid-onboarding, and treating them as owner avoids a locked-out first run.
  const role: MemberRole = state?.member?.role ?? 'owner';

  const show = useCallback((feature: Feature) => hasFeature(mode, feature), [mode]);
  const can = useCallback((permission: Permission) => roleCan(role, permission), [role]);

  const value = useMemo<AppState>(
    () => ({
      ready: state !== undefined,
      userId: state?.userId ?? null,
      businessId: state?.businessId ?? null,
      business: state?.business ?? null,
      member: state?.member ?? null,
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
