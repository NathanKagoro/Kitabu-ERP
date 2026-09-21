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
} from './local/actions';
import { addDays, businessDay, dayBounds } from './date';
import { db } from './local/db';
import { loadRange } from './local/queries';
import { createBusiness } from './onboarding/create-business';
import type { ExpenseCategory, Product } from './types';

/**
 * Two weeks of a plausible Sinza genge, recorded through the same domain
 * actions the app itself uses -- so the demo exercises the real code paths,
 * and a number that looks wrong in a demo is a real bug.
 *
 * Seeded with a fixed PRNG so every demo looks the same.
 */

const PRICES: Record<string, { price: number; cost: number }> = {
  Nyanya: { price: 1000, cost: 600 },
  Vitunguu: { price: 1000, cost: 650 },
  'Sukuma wiki': { price: 500, cost: 250 },
  Mchicha: { price: 500, cost: 250 },
  Ndizi: { price: 300, cost: 150 },
  Viazi: { price: 1500, cost: 1000 },
  Karoti: { price: 1000, cost: 600 },
  Hoho: { price: 500, cost: 300 },
  Nazi: { price: 1500, cost: 900 },
  Limau: { price: 500, cost: 250 },
};

const CUSTOMERS = [
  { name: 'Mama Asha', phone: '0713 222 111' },
  { name: 'Baba Juma', phone: '0754 333 444' },
  { name: 'Bi. Rehema', phone: '0689 555 666' },
  { name: 'Mzee Hamisi', phone: null },
];

function prng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export async function createDemoBusiness(userId: string, name: string, locale: string): Promise<string> {
  const business = await createBusiness({ name, type: 'genge', locale, userId });
  const businessId = business.id;
  const random = prng(42);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;

  const products = await db().products.where('businessId').equals(businessId).toArray();
  const priced: Product[] = [];
  for (const product of products) {
    const p = PRICES[product.name];
    const next = { ...product, price: p?.price ?? 1000, trackStock: true, lowStockLevel: 5 };
    await saveProduct(next);
    priced.push(next);
  }

  const customers = [];
  for (const c of CUSTOMERS) customers.push(await createCustomer({ businessId, name: c.name, phone: c.phone }));

  const today = businessDay();
  // The float in the tin on the first morning; every close carries forward.
  let openingCash = 20000;
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const dayStart = new Date(dayBounds(addDays(today, -daysAgo)).start).getTime();
    // Today's demo stops at the current hour rather than inventing the future.
    const at = (hour: number) => new Date(Math.min(dayStart + hour * 3_600_000, Date.now() - 60_000)).toISOString();

    // Morning at the market: restock.
    await recordPurchase({
      businessId,
      userId,
      at: at(6),
      lines: priced.slice(0, 6).map((p) => {
        const qty = 8 + Math.floor(random() * 6);
        return { productId: p.id, qty, totalCost: qty * (PRICES[p.name]?.cost ?? 600) };
      }),
    });

    await recordExpense({ businessId, userId, at: at(7), category: 'nauli', amount: 3000 });
    await recordExpense({ businessId, userId, at: at(8), category: 'ushuru', amount: 500 });
    if (daysAgo % 7 === 0) await recordExpense({ businessId, userId, at: at(12), category: 'kodi' as ExpenseCategory, amount: 15000 });

    const salesToday = 18 + Math.floor(random() * 15);
    for (let i = 0; i < salesToday; i++) {
      const hour = 8 + (i / salesToday) * 11;
      const items = 1 + Math.floor(random() * 3);
      const lines = Array.from({ length: items }, () => {
        const p = pick(priced);
        return { id: crypto.randomUUID(), productId: p.id, description: p.name, qty: 1 + Math.floor(random() * 2), unitPrice: p.price, unitCost: PRICES[p.name]?.cost ?? null, vatType: p.vatType };
      });
      const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      const roll = random();
      const onCredit = roll < 0.1;
      await recordSale({
        businessId,
        userId,
        at: at(hour),
        lines,
        customerId: onCredit ? pick(customers).id : null,
        tenders: onCredit ? [] : roll < 0.35 ? [{ method: 'mpesa', amount: total }] : [{ method: 'cash', amount: total }],
      });
    }

    if (daysAgo % 3 === 1) {
      await recordWaste({ businessId, userId, at: at(18), productId: priced[0]!.id, qty: 2, reason: 'imeoza' });
    }
    if (daysAgo % 4 === 2) {
      await recordDebtPayment({ businessId, userId, at: at(17), customerId: pick(customers).id, amount: 2000, method: 'cash' });
    }

    // Funga siku for every finished day, usually a few hundred shillings out.
    if (daysAgo > 0) {
      const day = addDays(today, -daysAgo);
      const summary = summariseDay({ ...(await loadRange(businessId, day, day)), openingCash });
      const shortBy = random() < 0.6 ? 0 : Math.round(random() * 10) * 100;
      const counted = summary.expectedCash - shortBy;
      await closeDay({ businessId, userId, day, openingCash, expectedCash: summary.expectedCash, countedCash: counted });
      openingCash = counted;
    }
  }

  return businessId;
}
