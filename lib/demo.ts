import { summariseDay } from './calc/summary';
import {
  closeDay,
  createCustomer,
  recordDebtPayment,
  recordExpense,
  recordPurchase,
  recordSale,
  recordWaste,
  saveProduct,
  saveProductPacks,
} from './local/actions';
import { recordStockCount } from './local/stock-count';
import { packToUnits } from './calc/packs';
import { stockByProduct } from './calc/stock';
import { addDays, businessDay, dayBounds } from './date';
import { db } from './local/db';
import { loadRange } from './local/queries';
import { createBusiness } from './onboarding/create-business';
import { STARTER_PRODUCTS, type StarterProduct } from './onboarding/starter-products';
import { productLabel } from './products';
import type { BusinessType, ExpenseCategory, Product } from './types';

/**
 * Two weeks of a plausible shop of the same kind as the one being shown -- a
 * cosmetics shop gets lotions and lipsticks, a hardware shop cement and nails
 * -- recorded through the same domain actions the app itself uses, so a
 * number that looks wrong in a demo is a real bug.
 *
 * It ends with what a visit is about: a stock check a week ago that was
 * nearly clean, and one today with things missing, so the stock report has
 * something to show. Seeded with a fixed PRNG so every demo looks the same.
 */

const CUSTOMERS = [
  { name: 'Mama Asha', phone: '0713 222 111' },
  { name: 'Baba Juma', phone: '0754 333 444' },
  { name: 'Bi. Rehema', phone: '0689 555 666' },
  { name: 'Neema Mushi', phone: '0765 777 888' },
  { name: 'Mzee Hamisi', phone: null },
];

/** How many items a typical sale has, and how many sales a day, by trade. */
const PACE: Partial<Record<BusinessType, { perDay: [number, number]; restock: [number, number] }>> = {
  genge: { perDay: [18, 33], restock: [8, 14] },
  duka: { perDay: [20, 35], restock: [10, 20] },
  cosmetics: { perDay: [6, 12], restock: [3, 6] },
  clothes: { perDay: [4, 9], restock: [2, 4] },
  hardware: { perDay: [6, 12], restock: [3, 6] },
  pharmacy: { perDay: [12, 22], restock: [5, 10] },
  wholesale: { perDay: [4, 8], restock: [3, 6] },
};

function prng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const keyOf = (p: Pick<Product, 'name' | 'variant'>) => `${p.name}|${p.variant ?? ''}`;

export async function createDemoBusiness(
  userId: string,
  name: string,
  locale: string,
  type: BusinessType = 'genge'
): Promise<string> {
  const business = await createBusiness({ name, type, locale, userId });
  const businessId = business.id;
  const random = prng(42);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;
  const between = ([lo, hi]: [number, number]) => lo + Math.floor(random() * (hi - lo + 1));
  const pace = PACE[type] ?? { perDay: [8, 16], restock: [4, 8] };

  const starters = new Map<string, StarterProduct>(STARTER_PRODUCTS[type].map((s) => [keyOf(s), s]));
  const products = await db().products.where('businessId').equals(businessId).toArray();
  const priced: (Product & { starter: StarterProduct | undefined })[] = [];
  for (const product of products) {
    const starter = starters.get(keyOf(product));
    const next = { ...product, price: starter?.price ?? 1000, trackStock: true, lowStockLevel: 3 };
    await saveProduct(next);
    if (starter?.pack) await saveProductPacks({ businessId, productId: product.id, packs: [starter.pack] });
    priced.push({ ...next, starter });
  }

  const customers = [];
  // Most demo customers agreed to offers at the till; a few did not.
  for (const [i, c] of CUSTOMERS.entries()) {
    customers.push(await createCustomer({ businessId, name: c.name, phone: c.phone, offersConsent: i % 3 !== 2 }));
  }

  const today = businessDay();
  const at = (day: string, hour: number) =>
    new Date(Math.min(new Date(dayBounds(day).start).getTime() + hour * 3_600_000, Date.now() - 60_000)).toISOString();
  const onHand = async () => stockByProduct(await db().stockMovements.where('businessId').equals(businessId).toArray());

  // The float in the tin on the first morning; every close carries forward.
  let openingCash = 20000;
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const day = addDays(today, -daysAgo);

    // Restock: everything on the first morning, then a few lines each day.
    const restock = daysAgo === 13 ? priced : priced.filter((_, index) => index % 3 === daysAgo % 3).slice(0, 3);
    await recordPurchase({
      businessId,
      userId,
      at: at(day, 7),
      lines: await Promise.all(
        restock.map(async (p) => {
          const cost = p.starter?.cost ?? Math.round(p.price * 0.7);
          const bulk = p.starter?.pack;
          if (!bulk) {
            // The first morning stocks the shelf for the fortnight; later mornings top up.
            const qty = between(pace.restock) * (daysAgo === 13 ? 5 : 1);
            return { productId: p.id, qty, totalCost: qty * cost };
          }
          const packQty = daysAgo === 13 ? 1 : random() < 0.6 ? 0.5 : 1;
          const qty = packToUnits(packQty, bulk.units);
          const pack = await db().productPacks.where('productId').equals(p.id).filter((row) => row.active).first();
          return { productId: p.id, qty, totalCost: Math.round(qty * cost), packId: pack?.id ?? null, packLabel: bulk.label, packQty };
        })
      ),
    });

    await recordExpense({ businessId, userId, at: at(day, 7.5), category: 'nauli', amount: 3000 });
    if (daysAgo % 7 === 0) await recordExpense({ businessId, userId, at: at(day, 12), category: 'kodi' as ExpenseCategory, amount: 15000 });

    const salesToday = between(pace.perDay);
    for (let i = 0; i < salesToday; i++) {
      const hour = 8 + (i / salesToday) * 11;
      const items = 1 + Math.floor(random() * 2);
      const lines = Array.from({ length: items }, () => {
        const p = pick(priced);
        return {
          id: crypto.randomUUID(),
          productId: p.id,
          description: productLabel(p),
          qty: 1 + (random() < 0.25 ? 1 : 0),
          unitPrice: p.price,
          unitCost: p.starter?.cost ?? null,
          vatType: p.vatType,
        };
      });
      const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      const roll = random();
      const onCredit = roll < 0.08;
      const named = onCredit || roll > 0.8;
      await recordSale({
        businessId,
        userId,
        at: at(day, hour),
        lines,
        customerId: named ? pick(customers).id : null,
        tenders: onCredit ? [] : roll < 0.4 ? [{ method: 'mpesa', amount: total }] : [{ method: 'cash', amount: total }],
      });
    }

    if (daysAgo % 5 === 1) {
      await recordWaste({ businessId, userId, at: at(day, 18), productId: priced[0]!.id, qty: 1, reason: type === 'genge' ? 'imeoza' : 'imeharibika' });
    }
    if (daysAgo % 4 === 2) {
      await recordDebtPayment({ businessId, userId, at: at(day, 17), customerId: pick(customers).id, amount: 2000, method: 'cash' });
    }

    // Stock checks: a week ago nearly clean, today a few things missing.
    if (daysAgo === 7 || daysAgo === 0) {
      const stock = await onHand();
      const shelf = priced.slice(0, Math.min(priced.length, 8));
      await recordStockCount({
        businessId,
        userId,
        kind: 'check',
        at: at(day, 19),
        items: shelf.map((p, index) => {
          const recorded = Math.max(0, stock.get(p.id) ?? 0);
          const missing = daysAgo === 7 ? (index === 0 ? 1 : 0) : index % 3 === 0 ? 2 : index % 4 === 1 ? 1 : 0;
          return { productId: p.id, counted: Math.max(0, recorded - missing) };
        }),
      });
    }

    // Funga siku for every finished day, usually a few hundred shillings out.
    if (daysAgo > 0) {
      const summary = summariseDay({ ...(await loadRange(businessId, day, day)), openingCash });
      const shortBy = random() < 0.6 ? 0 : Math.round(random() * 10) * 100;
      const counted = summary.expectedCash - shortBy;
      await closeDay({ businessId, userId, day, openingCash, expectedCash: summary.expectedCash, countedCash: counted });
      openingCash = counted;
    }
  }

  return businessId;
}
