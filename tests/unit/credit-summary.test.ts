import { describe, expect, it } from 'vitest';

import {
  balancesByCustomer,
  customerBalance,
  lastPaymentByCustomer,
  supplierBalance,
  totalOutstanding,
} from '@/lib/calc/credit';
import { cashDifference, salesByDay, summariseDay, topProducts } from '@/lib/calc/summary';
import type { Expense, Payment, Purchase, Sale, SaleLine, WasteEvent } from '@/lib/types';

let n = 0;
const at = '2026-03-10T09:00:00.000Z';

const pay = (p: Partial<Payment>): Payment => ({
  id: `pay${++n}`,
  businessId: 'b',
  direction: 'in',
  method: 'cash',
  amount: 0,
  clientCreatedAt: at,
  createdAt: at,
  ...p,
});

const sale = (id: string, total: number, status: Sale['status'] = 'complete'): Sale => ({
  id,
  businessId: 'b',
  total,
  discount: 0,
  status,
  receiptToken: id,
  clientCreatedAt: at,
  createdAt: at,
  updatedAt: at,
});

const saleLine = (
  saleId: string,
  productId: string | null,
  qty: number,
  unitPrice: number,
  unitCost: number | null
): SaleLine => ({
  id: `sl${++n}`,
  businessId: 'b',
  saleId,
  productId,
  qty,
  unitPrice,
  lineTotal: Math.round(qty * unitPrice),
  unitCost,
  vatType: 'standard',
});

const expense = (amount: number, method: Expense['method'] = 'cash'): Expense => ({
  id: `e${++n}`,
  businessId: 'b',
  category: 'nauli',
  amount,
  method,
  clientCreatedAt: at,
  createdAt: at,
});

const purchase = (total: number, paidAmount = total, supplierId: string | null = null): Purchase => ({
  id: `pu${++n}`,
  businessId: 'b',
  supplierId,
  total,
  paidAmount,
  method: 'cash',
  clientCreatedAt: at,
  createdAt: at,
});

const waste = (costValue: number): WasteEvent => ({
  id: `w${++n}`,
  businessId: 'b',
  productId: 'p',
  qty: 1,
  reason: 'imeoza',
  costValue,
  clientCreatedAt: at,
  createdAt: at,
});

describe('customer balances', () => {
  const payments = [
    pay({ saleId: 's1', customerId: 'asha', method: 'credit', amount: 5000 }),
    // Paid at the till as part of a split sale: not a repayment of old debt.
    pay({ saleId: 's2', customerId: 'asha', method: 'cash', amount: 2000 }),
    pay({ saleId: 's2', customerId: 'asha', method: 'credit', amount: 3000 }),
    pay({ customerId: 'asha', method: 'mpesa', amount: 4000, clientCreatedAt: '2026-03-12T10:00:00Z' }),
    pay({ saleId: 's3', customerId: 'juma', method: 'credit', amount: 1000 }),
    // A voided credit sale no longer counts.
    pay({ saleId: 's4', customerId: 'juma', method: 'credit', amount: 9999, deletedAt: at }),
  ];

  it('is credit charges minus repayments', () => {
    expect(customerBalance(payments.filter((p) => p.customerId === 'asha'))).toBe(4000);
    expect(balancesByCustomer(payments).get('juma')).toBe(1000);
  });

  it('ignores voided rows', () => {
    expect(totalOutstanding(payments)).toBe(5000);
  });

  it('tracks the last repayment date', () => {
    expect(lastPaymentByCustomer(payments).get('asha')).toBe('2026-03-12T10:00:00Z');
    expect(lastPaymentByCustomer(payments).has('juma')).toBe(false);
  });
});

describe('supplier balance', () => {
  it('is unpaid purchases minus later payments to them', () => {
    const purchases = [purchase(50000, 20000, 'sup'), purchase(10000, 10000, 'sup'), purchase(7000, 0, 'other')];
    const payments = [pay({ supplierId: 'sup', direction: 'out', amount: 5000 })];
    expect(supplierBalance(purchases, payments, 'sup')).toBe(25000);
  });
});

describe('summariseDay', () => {
  const sales = [sale('s1', 10000), sale('s2', 6000), sale('s3', 4000), sale('void', 50000, 'void')];
  const payments = [
    pay({ saleId: 's1', method: 'cash', amount: 10000 }),
    pay({ saleId: 's2', method: 'mpesa', amount: 6000 }),
    pay({ saleId: 's3', customerId: 'c', method: 'cash', amount: 1000 }),
    pay({ saleId: 's3', customerId: 'c', method: 'credit', amount: 3000 }),
    pay({ saleId: 'void', method: 'cash', amount: 50000, deletedAt: at }),
    pay({ customerId: 'c', method: 'cash', amount: 2000 }),
    pay({ customerId: 'c', method: 'airtel', amount: 1500 }),
  ];
  const saleLines = [
    saleLine('s1', 'p1', 10, 1000, 600),
    saleLine('s2', 'p2', 3, 2000, 1200),
    saleLine('s3', null, 1, 4000, null),
    saleLine('void', 'p1', 50, 1000, 600),
  ];

  const summary = summariseDay({
    sales,
    saleLines,
    payments,
    expenses: [expense(3000), expense(500), expense(10000, 'mpesa')],
    purchases: [purchase(20000), purchase(15000, 5000)],
    waste: [waste(1200)],
    openingCash: 5000,
  });

  it('totals sales, excluding voids', () => {
    expect(summary.salesTotal).toBe(20000);
    expect(summary.salesCount).toBe(3);
  });

  it('splits by how the money came in, and the split adds up', () => {
    expect(summary.cash).toBe(11000);
    expect(summary.mobile).toBe(6000);
    expect(summary.credit).toBe(3000);
    expect(summary.cash + summary.mobile + summary.bank + summary.credit).toBe(summary.salesTotal);
    expect(summary.debtCollected).toBe(3500);
  });

  it('expected cash = opening + cash sales + cash debt payments - cash expenses - cash purchases', () => {
    // 5000 + 11000 + 2000 - (3000 + 500) - (20000 + 5000)
    expect(summary.expectedCash).toBe(-10500);
  });

  it('estimated profit = sales - COGS - expenses - waste, flagged partial when a cost is unknown', () => {
    // COGS 10*600 + 3*1200 = 9600; expenses 13,500 (all methods); waste 1,200
    expect(summary.costOfGoodsSold).toBe(9600);
    expect(summary.estimatedProfit).toBe(20000 - 9600 - 13500 - 1200);
    expect(summary.profitIsPartial).toBe(true);
  });

  it('purchases are not a cost in profit -- they become stock', () => {
    expect(summary.purchasesTotal).toBe(35000);
    expect(summary.estimatedProfit).toBe(-4300);
  });

  it('cash difference is counted minus expected', () => {
    expect(cashDifference(10000, 9500)).toBe(-500);
    expect(cashDifference(10000, 10200)).toBe(200);
  });
});

describe('history', () => {
  it('keeps empty days in the series', () => {
    const points = salesByDay([sale('a', 100), sale('b', 50, 'void')], ['2026-03-09', '2026-03-10'], () => '2026-03-10');
    expect(points).toEqual([
      { day: '2026-03-09', total: 0 },
      { day: '2026-03-10', total: 100 },
    ]);
  });

  it('ranks top products by money', () => {
    const top = topProducts([
      saleLine('s', 'a', 1, 100, null),
      saleLine('s', 'b', 1, 500, null),
      saleLine('s', 'a', 2, 100, null),
    ]);
    expect(top.map((t) => t.productId)).toEqual(['b', 'a']);
    expect(top[1]).toMatchObject({ qty: 3, total: 300 });
  });
});
