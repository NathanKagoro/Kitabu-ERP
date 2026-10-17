import { stockByProduct } from './calc/stock';
import { balancesByCustomer } from './calc/credit';
import { db } from './local/db';

/** RFC 4180 quoting; an accountant's Excel should open this without a wizard. */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell == null ? '' : String(cell);
          return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(',')
    )
    .join('\r\n');
}

export type ExportKind = 'sales' | 'expenses' | 'customers' | 'stock';

export async function buildExport(businessId: string, kind: ExportKind): Promise<string> {
  const database = db();
  switch (kind) {
    case 'sales': {
      const [sales, lines] = await Promise.all([
        database.sales.where('businessId').equals(businessId).toArray(),
        database.saleLines.where('businessId').equals(businessId).toArray(),
      ]);
      const byId = new Map(sales.map((s) => [s.id, s]));
      return toCsv([
        ['sale_id', 'date', 'status', 'item', 'qty', 'unit_price', 'line_total', 'unit_cost', 'sale_total', 'discount'],
        ...lines.map((l) => {
          const s = byId.get(l.saleId);
          return [l.saleId, s?.clientCreatedAt, s?.status, l.description, l.qty, l.unitPrice, l.lineTotal, l.unitCost, s?.total, s?.discount];
        }),
      ]);
    }
    case 'expenses': {
      const rows = await database.expenses.where('businessId').equals(businessId).toArray();
      return toCsv([
        ['date', 'category', 'amount', 'method', 'note'],
        ...rows.filter((e) => !e.deletedAt).map((e) => [e.clientCreatedAt, e.category, e.amount, e.method, e.note]),
      ]);
    }
    case 'customers': {
      const [customers, payments] = await Promise.all([
        database.customers.where('businessId').equals(businessId).toArray(),
        database.payments.where('businessId').equals(businessId).toArray(),
      ]);
      const balances = balancesByCustomer(payments);
      return toCsv([
        ['name', 'phone', 'balance', 'note'],
        ...customers.map((c) => [c.name, c.phone, balances.get(c.id) ?? 0, c.note]),
      ]);
    }
    case 'stock': {
      const [products, movements] = await Promise.all([
        database.products.where('businessId').equals(businessId).toArray(),
        database.stockMovements.where('businessId').equals(businessId).toArray(),
      ]);
      const stock = stockByProduct(movements);
      return toCsv([
        ['name', 'unit', 'price', 'cost', 'on_hand', 'stock_value', 'sku'],
        ...products.map((p) => {
          const onHand = p.trackStock ? (stock.get(p.id) ?? 0) : '';
          return [p.name, p.unit, p.price, p.cost, onHand, typeof onHand === 'number' && p.cost ? Math.round(onHand * p.cost) : '', p.sku];
        }),
      ]);
    }
  }
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  // BOM so Excel reads Swahili names as UTF-8. Contacts files must not have one:
  // some phones refuse to import a .vcf that starts with it.
  const bom = type.startsWith('text/csv') ? '\uFEFF' : '';
  const blob = new Blob([bom, text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
