import type { BusinessMode, BusinessType, MemberRole } from './types';

/**
 * Mode controls visibility only -- never storage. Switching a business from
 * genge to biashara reveals invoices and VAT; it does not migrate, convert or
 * discard anything, so switching back is free. That is what makes "features are
 * revealed progressively, never forced" safe to act on.
 */

export const MODE_FOR_TYPE: Record<BusinessType, BusinessMode> = {
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

export type Feature =
  | 'quickAmountSale'
  | 'products'
  | 'stockTracking'
  | 'dailyPriceUpdate'
  | 'waste'
  | 'credit'
  | 'expenses'
  | 'purchases'
  | 'suppliers'
  | 'summary'
  | 'documents'
  | 'staff'
  | 'vat'
  | 'productCodes'
  | 'receiptPdf'
  | 'export';

const MODE_FEATURES: Record<BusinessMode, ReadonlySet<Feature>> = {
  genge: new Set<Feature>([
    'quickAmountSale',
    'products',
    'dailyPriceUpdate',
    'waste',
    'credit',
    'expenses',
    'purchases',
    'summary',
  ]),
  duka: new Set<Feature>([
    'quickAmountSale',
    'products',
    'stockTracking',
    'dailyPriceUpdate',
    'waste',
    'credit',
    'expenses',
    'purchases',
    'suppliers',
    'summary',
    'export',
  ]),
  biashara: new Set<Feature>([
    'products',
    'stockTracking',
    'waste',
    'credit',
    'expenses',
    'purchases',
    'suppliers',
    'summary',
    'documents',
    'staff',
    'vat',
    'productCodes',
    'receiptPdf',
    'export',
  ]),
};

export function hasFeature(mode: BusinessMode, feature: Feature): boolean {
  return MODE_FEATURES[mode].has(feature);
}

/**
 * Role permissions. A cashier records sales all day but cannot see the profit
 * line or undo a sale -- those are the two things an owner needs to stay the
 * owner of.
 */
export type Permission =
  | 'sell'
  | 'voidSale'
  | 'viewProfit'
  | 'manageProducts'
  | 'managePrices'
  | 'recordExpense'
  | 'recordPurchase'
  | 'manageCustomers'
  | 'manageDocuments'
  | 'closeDay'
  | 'countStock'
  | 'viewStaffSales'
  | 'manageSettings'
  | 'manageStaff';

const ROLE_PERMISSIONS: Record<MemberRole, ReadonlySet<Permission>> = {
  owner: new Set<Permission>([
    'sell',
    'voidSale',
    'viewProfit',
    'manageProducts',
    'managePrices',
    'recordExpense',
    'recordPurchase',
    'manageCustomers',
    'manageDocuments',
    'closeDay',
    'countStock',
    'viewStaffSales',
    'manageSettings',
    'manageStaff',
  ]),
  manager: new Set<Permission>([
    'sell',
    'voidSale',
    'viewProfit',
    'manageProducts',
    'managePrices',
    'recordExpense',
    'recordPurchase',
    'manageCustomers',
    'manageDocuments',
    'closeDay',
    'countStock',
    'viewStaffSales',
  ]),
  cashier: new Set<Permission>(['sell', 'recordExpense', 'manageCustomers']),
};

export function roleCan(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
