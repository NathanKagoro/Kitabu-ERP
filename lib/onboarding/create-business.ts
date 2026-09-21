import { nowIso } from '../date';
import { META_KEYS, getMeta, setMeta } from '../local/db';
import { persistAll } from '../local/write';
import { MODE_FOR_TYPE } from '../modes';
import type { Business, BusinessType, Member, Product } from '../types';
import { uuidv7 } from '../uuid';
import { STARTER_PRODUCTS, type StarterProduct } from './starter-products';

export interface CreateBusinessInput {
  name: string;
  type: BusinessType;
  locale: string;
  userId: string;
  starter?: readonly StarterProduct[];
}

/**
 * One transaction: the business, the owner's membership, and the starter
 * products. A half-created business (one with no owner) would lock its creator
 * out under RLS the moment it synced.
 */
export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  const at = nowIso();
  const businessId = uuidv7();
  const phone = await getMeta<string | null>('phone', null);

  const business: Business = {
    id: businessId,
    name: input.name.trim(),
    type: input.type,
    mode: MODE_FOR_TYPE[input.type],
    tin: null,
    vrn: null,
    phone,
    logoUrl: null,
    locale: input.locale,
    settings: { vatRate: 18 },
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };

  const member: Member = {
    id: uuidv7(),
    businessId,
    userId: input.userId,
    name: null,
    phone,
    role: 'owner',
    pinHash: null,
    active: true,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };

  const starter = input.starter ?? STARTER_PRODUCTS[input.type];
  const products: Product[] = starter.map((item, index) => ({
    id: uuidv7(),
    businessId,
    name: item.name,
    unit: item.unit,
    unitLabel: null,
    price: 0,
    cost: null,
    // Genges rarely count stock; dukas and up usually want to.
    trackStock: business.mode !== 'genge',
    lowStockLevel: null,
    icon: item.icon,
    photoUrl: null,
    sku: null,
    barcode: null,
    category: null,
    vatType: 'standard',
    sortOrder: index,
    active: true,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  }));

  await persistAll([
    { table: 'businesses', rows: [business] },
    { table: 'members', rows: [member] },
    { table: 'products', rows: products },
  ]);
  await setMeta(META_KEYS.activeBusinessId, businessId);
  return business;
}
