import { MOBILE_MONEY_METHODS } from '../types';
import type {
  Expense,
  Payment,
  Purchase,
  Sale,
  SaleLine,
  WasteEvent,
} from '../types';
import { costOfGoods } from './sale';
import { isDebtRepayment } from './credit';

export interface DaySummaryInput {
  sales: readonly Sale[];
  saleLines: readonly SaleLine[];
  payments: readonly Payment[];
  expenses: readonly Expense[];
  purchases: readonly Purchase[];
  waste: readonly WasteEvent[];
  openingCash: number;
}

export interface DaySummary {
  salesTotal: number;
  salesCount: number;
  cash: number;
  mobile: number;
  bank: number;
  credit: number;
  debtCollected: number;
  expensesTotal: number;
  purchasesTotal: number;
  wasteTotal: number;
  costOfGoodsSold: number;
  /** Labelled in the UI as an estimate -- costs are often unknown. */
  estimatedProfit: number;
  /** What should physically be in the tin right now. */
  expectedCash: number;
  /** True when some sold item had no known cost, so profit understates costs. */
  profitIsPartial: boolean;
}

const isMobile = (method: string) => MOBILE_MONEY_METHODS.includes(method as never);

/**
 * Everything on the *Hesabu ya leo* screen, computed in one pass from rows that
 * have already been filtered to the day. Void sales and their payments are
 * excluded by the caller via `deletedAt` / status, so nothing here needs to
 * second-guess them.
 */
export function summariseDay(input: DaySummaryInput): DaySummary {
  const { sales, saleLines, payments, expenses, purchases, waste, openingCash } = input;

  const liveSales = sales.filter((s) => s.status === 'complete');
  const saleIds = new Set(liveSales.map((s) => s.id));
  const livePayments = payments.filter((p) => !p.deletedAt);

  let cash = 0;
  let mobile = 0;
  let bank = 0;
  let credit = 0;
  let debtCollected = 0;
  let cashDebtCollected = 0;

  for (const payment of livePayments) {
    if (payment.saleId && saleIds.has(payment.saleId)) {
      if (payment.method === 'cash') cash += payment.amount;
      else if (isMobile(payment.method)) mobile += payment.amount;
      else if (payment.method === 'bank') bank += payment.amount;
      else if (payment.method === 'credit') credit += payment.amount;
      continue;
    }
    if (isDebtRepayment(payment)) {
      debtCollected += payment.amount;
      if (payment.method === 'cash') cashDebtCollected += payment.amount;
    }
  }

  const salesTotal = liveSales.reduce((sum, s) => sum + s.total, 0);

  const liveExpenses = expenses.filter((e) => !e.deletedAt);
  const expensesTotal = liveExpenses.reduce((sum, e) => sum + e.amount, 0);
  const cashExpenses = liveExpenses
    .filter((e) => e.method === 'cash')
    .reduce((sum, e) => sum + e.amount, 0);

  const livePurchases = purchases.filter((p) => !p.deletedAt);
  const purchasesTotal = livePurchases.reduce((sum, p) => sum + p.total, 0);
  // Only what was actually handed over leaves the tin; supplier credit does not.
  const cashPurchases = livePurchases
    .filter((p) => p.method === 'cash')
    .reduce((sum, p) => sum + p.paidAmount, 0);

  const wasteTotal = waste.filter((w) => !w.deletedAt).reduce((sum, w) => sum + w.costValue, 0);

  const soldLines = saleLines.filter((line) => saleIds.has(line.saleId));
  const costOfGoodsSold = costOfGoods(soldLines);
  const profitIsPartial = soldLines.some((line) => line.unitCost == null || line.unitCost === 0);

  return {
    salesTotal,
    salesCount: liveSales.length,
    cash,
    mobile,
    bank,
    credit,
    debtCollected,
    expensesTotal,
    purchasesTotal,
    wasteTotal,
    costOfGoodsSold,
    estimatedProfit: salesTotal - costOfGoodsSold - expensesTotal - wasteTotal,
    expectedCash: openingCash + cash + cashDebtCollected - cashExpenses - cashPurchases,
    profitIsPartial,
  };
}

/** counted - expected. Positive is *zaidi*, negative is *pungufu*. */
export function cashDifference(expected: number, counted: number): number {
  return Math.round(counted) - Math.round(expected);
}

export interface DayPoint {
  day: string;
  total: number;
}

/** Sales per day for the bar chart, with empty days kept so the shape is honest. */
export function salesByDay(
  sales: readonly Sale[],
  days: readonly string[],
  dayOf: (sale: Sale) => string
): DayPoint[] {
  const totals = new Map<string, number>(days.map((d) => [d, 0]));
  for (const sale of sales) {
    if (sale.status !== 'complete') continue;
    const day = dayOf(sale);
    if (totals.has(day)) totals.set(day, (totals.get(day) ?? 0) + sale.total);
  }
  return days.map((day) => ({ day, total: totals.get(day) ?? 0 }));
}

export interface ProductTotal {
  productId: string;
  qty: number;
  total: number;
}

export function topProducts(
  lines: readonly SaleLine[],
  limit = 5
): ProductTotal[] {
  const totals = new Map<string, ProductTotal>();
  for (const line of lines) {
    if (!line.productId) continue;
    const entry = totals.get(line.productId) ?? { productId: line.productId, qty: 0, total: 0 };
    entry.qty += line.qty;
    entry.total += line.lineTotal;
    totals.set(line.productId, entry);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}
