/**
 * The decisions the `accounts` function makes, kept free of Deno and Supabase
 * so they can be unit-tested (tests/unit/accounts-rules.test.ts).
 */

export type Role = 'owner' | 'manager' | 'cashier';
export type Mode = 'genge' | 'duka' | 'biashara';

/** Mirrors lib/modes.ts MODE_FOR_TYPE. */
export const MODE_FOR_TYPE: Record<string, Mode> = {
  cosmetics: 'duka',
  clothes: 'duka',
  genge: 'genge',
  duka: 'duka',
  pharmacy: 'duka',
  hardware: 'biashara',
  wholesale: 'biashara',
  services: 'biashara',
  other: 'duka',
};

export function modeForType(type: string): Mode | null {
  return MODE_FOR_TYPE[type] ?? null;
}

export interface Caller {
  userId: string;
  isOperator: boolean;
  /** The caller's role in the business concerned, if they are a member of it. */
  roleThere: Role | null;
}

export interface Target {
  userId: string | null;
  role: Role;
  active: boolean;
}

/**
 * Who may give a member a (new) setup code:
 *   - the operator, for anyone;
 *   - an owner, for their own managers and cashiers -- not for another owner,
 *     and not for themselves (a forgotten owner password goes to the operator,
 *     who can check it is really them).
 */
export function mayIssueCode(caller: Caller, target: Target): boolean {
  if (!target.active) return false;
  if (caller.isOperator) return true;
  if (caller.roleThere !== 'owner') return false;
  if (target.role === 'owner') return false;
  if (target.userId && target.userId === caller.userId) return false;
  return true;
}

const HEX = /^#[0-9a-f]{6}$/i;

export interface ShopInput {
  name: string;
  type: string;
  ownerName: string | null;
  ownerPhone: string;
  locale: 'sw' | 'en';
  brandColor: string | null;
}

/** Validates the operator's "new shop" form. Returns an error key or the clean input. */
export function parseShopInput(raw: Record<string, unknown>): ShopInput | { error: string } {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const type = typeof raw.type === 'string' ? raw.type : '';
  const ownerPhone = typeof raw.ownerPhone === 'string' ? raw.ownerPhone : '';
  const ownerName = typeof raw.ownerName === 'string' && raw.ownerName.trim() ? raw.ownerName.trim() : null;
  const locale = raw.locale === 'en' ? 'en' : 'sw';
  const brandColor = typeof raw.brandColor === 'string' && HEX.test(raw.brandColor) ? raw.brandColor : null;
  if (name.length < 2 || name.length > 80) return { error: 'badName' };
  if (!modeForType(type)) return { error: 'badType' };
  if (!ownerPhone) return { error: 'badPhone' };
  return { name, type, ownerName, ownerPhone, locale, brandColor };
}

/** The settings keys the operator may set from the admin screen. */
export function cleanSettingsPatch(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const patch = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof patch.brandColor === 'string' && HEX.test(patch.brandColor)) out.brandColor = patch.brandColor;
  return out;
}
