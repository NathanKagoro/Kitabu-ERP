import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/*
 * Runs the real migrations -- the same SQL files Supabase will run -- inside an
 * in-process Postgres, with a minimal stand-in for Supabase's `auth` schema.
 * Every query below runs as the `authenticated` role, so RLS is actually
 * enforced; nothing here is a mock of the policies themselves.
 */

const MIGRATIONS = join(process.cwd(), 'db', 'migrations');

const USER_A = '00000000-0000-7000-8000-00000000000a';
const USER_B = '00000000-0000-7000-8000-00000000000b';
const CASHIER = '00000000-0000-7000-8000-00000000000c';
const BIZ_A = '00000000-0000-7000-8000-0000000000a1';
const BIZ_B = '00000000-0000-7000-8000-0000000000b1';

let pg: PGlite;
let seq = 0;
const id = () => `00000000-0000-7000-8000-${String(++seq).padStart(12, '0')}`;

async function as<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  await pg.exec('RESET ROLE');
  await pg.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await pg.exec(userId ? 'SET ROLE authenticated' : 'SET ROLE anon');
  try {
    return await fn();
  } finally {
    await pg.exec('RESET ROLE');
  }
}

const rows = async (sql: string, params: unknown[] = []) => (await pg.query(sql, params)).rows;

/** Shops are created by the operator's account function, as the service role. */
async function createBusiness(userId: string, businessId: string, name: string) {
  await pg.exec('RESET ROLE');
  await pg.query(`INSERT INTO businesses (id, name, type) VALUES ($1, $2, 'genge')`, [businessId, name]);
  await pg.query(`INSERT INTO members (id, business_id, user_id, role) VALUES ($1, $2, $3, 'owner')`, [
    id(),
    businessId,
    userId,
  ]);
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, phone text, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT SELECT ON auth.users TO authenticated;
  `);

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await pg.exec(statement);
    }
  }

  // What Supabase grants by default; RLS is what actually restricts access.
  await pg.exec(`
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT SELECT ON public.customer_balances, public.supplier_balances TO authenticated;
    INSERT INTO auth.users (id, phone) VALUES ('${CASHIER}', '255712000111');
  `);

  await createBusiness(USER_A, BIZ_A, 'Genge A');
  await createBusiness(USER_B, BIZ_B, 'Duka B');
}, 60_000);

describe('tenant isolation', () => {
  it('a user from business A cannot read business B', async () => {
    const visible = await as(USER_A, () => rows('SELECT id FROM businesses'));
    expect(visible.map((r) => (r as { id: string }).id)).toEqual([BIZ_A]);
  });

  it('cannot read another business’s sales, customers or balances', async () => {
    const customerB = id();
    await as(USER_B, async () => {
      await pg.query(`INSERT INTO customers (id, business_id, name) VALUES ($1, $2, 'Siri')`, [customerB, BIZ_B]);
      const saleId = id();
      await pg.query(
        `INSERT INTO sales (id, business_id, customer_id, total, receipt_token, client_created_at)
         VALUES ($1, $2, $3, 5000, 'tokenbbbbbbbb', now())`,
        [saleId, BIZ_B, customerB]
      );
      await pg.query(
        `INSERT INTO payments (id, business_id, sale_id, customer_id, method, amount, client_created_at)
         VALUES ($1, $2, $3, $4, 'credit', 5000, now())`,
        [id(), BIZ_B, saleId, customerB]
      );
    });

    await as(USER_A, async () => {
      expect(await rows('SELECT * FROM sales')).toHaveLength(0);
      expect(await rows('SELECT * FROM customers')).toHaveLength(0);
      expect(await rows('SELECT * FROM customer_balances')).toHaveLength(0);
    });

    const own = await as(USER_B, () => rows('SELECT balance FROM customer_balances'));
    expect(own).toEqual([{ balance: '5000' }]);
  });

  it('cannot write rows into another business', async () => {
    await expect(
      as(USER_A, () => pg.query(`INSERT INTO customers (id, business_id, name) VALUES ($1, $2, 'x')`, [id(), BIZ_B]))
    ).rejects.toThrow(/row-level security/);
  });

  it('cannot make themselves a member of someone else’s business', async () => {
    await expect(
      as(USER_A, () =>
        pg.query(`INSERT INTO members (id, business_id, user_id, role) VALUES ($1, $2, $3, 'owner')`, [id(), BIZ_B, USER_A])
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('anonymous visitors see nothing', async () => {
    await pg.exec('GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon');
    expect(await as(null, () => rows('SELECT * FROM sales'))).toHaveLength(0);
  });
});

describe('financial records are never hard-deleted', () => {
  it('even the owner cannot DELETE a sale', async () => {
    await as(USER_B, async () => {
      const result = await pg.query('DELETE FROM sales');
      expect(result.affectedRows ?? 0).toBe(0);
    });
    await pg.exec('RESET ROLE');
    expect((await rows('SELECT count(*)::int AS n FROM sales'))[0]).toEqual({ n: 1 });
  });
});

describe('roles', () => {
  beforeAll(async () => {
    // Owner of A invites a cashier by phone; the cashier signs in and claims it.
    await as(USER_A, () =>
      pg.query(`INSERT INTO members (id, business_id, phone, role) VALUES ($1, $2, '+255712000111', 'cashier')`, [
        id(),
        BIZ_A,
      ])
    );
    const claimed = await as(CASHIER, () => rows('SELECT public.claim_invites() AS n'));
    expect(claimed).toEqual([{ n: 1 }]);
  });

  it('a claimed invite gives access to that business only', async () => {
    const visible = await as(CASHIER, () => rows('SELECT id FROM businesses'));
    expect(visible).toEqual([{ id: BIZ_A }]);
  });

  it('a cashier can record a sale but cannot void it', async () => {
    const saleId = id();
    await as(CASHIER, () =>
      pg.query(
        `INSERT INTO sales (id, business_id, total, receipt_token, client_created_at) VALUES ($1, $2, 1000, 'tokencashier1', now())`,
        [saleId, BIZ_A]
      )
    );
    const updated = await as(CASHIER, () => pg.query(`UPDATE sales SET status = 'void' WHERE id = $1`, [saleId]));
    expect(updated.affectedRows ?? 0).toBe(0);

    const byOwner = await as(USER_A, () => pg.query(`UPDATE sales SET status = 'void' WHERE id = $1`, [saleId]));
    expect(byOwner.affectedRows).toBe(1);
  });

  it('a retried insert of an existing row is a no-op for a cashier (idempotent sync)', async () => {
    const saleId = id();
    const insert = () =>
      pg.query(
        `INSERT INTO sales (id, business_id, total, receipt_token, client_created_at)
         VALUES ($1, $2, 700, 'tokenretry001', now()) ON CONFLICT (id) DO NOTHING`,
        [saleId, BIZ_A]
      );
    await as(CASHIER, insert);
    await as(CASHIER, insert);
    await pg.exec('RESET ROLE');
    expect(await rows('SELECT total FROM sales WHERE id = $1', [saleId])).toEqual([{ total: 700 }]);
  });

  it('a cashier cannot edit products or close the day', async () => {
    await expect(
      as(CASHIER, () => pg.query(`INSERT INTO products (id, business_id, name) VALUES ($1, $2, 'x')`, [id(), BIZ_A]))
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(CASHIER, () =>
        pg.query(
          `INSERT INTO day_closings (id, business_id, date, expected_cash, counted_cash, difference) VALUES ($1, $2, '2026-03-10', 0, 0, 0)`,
          [id(), BIZ_A]
        )
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('a cashier cannot promote themselves', async () => {
    await expect(
      as(CASHIER, () => pg.query(`UPDATE members SET role = 'owner' WHERE user_id = $1`, [CASHIER]))
    ).rejects.toThrow(/only an owner/);
  });
});

describe('server-side sync cursor', () => {
  it('synced_at is set by the database, ignoring whatever the client sent', async () => {
    const customerId = id();
    await as(USER_A, () =>
      pg.query(`INSERT INTO customers (id, business_id, name, synced_at) VALUES ($1, $2, 'y', '2001-01-01')`, [
        customerId,
        BIZ_A,
      ])
    );
    await pg.exec('RESET ROLE');
    const [row] = (await rows('SELECT synced_at > now() - interval \'1 minute\' AS fresh FROM customers WHERE id = $1', [
      customerId,
    ])) as { fresh: boolean }[];
    expect(row?.fresh).toBe(true);
  });
});

describe('public receipt', () => {
  it('returns one receipt for a valid token and nothing for a wrong one', async () => {
    await pg.exec('GRANT EXECUTE ON FUNCTION public.public_receipt(text) TO anon');
    const found = await as(null, () => rows(`SELECT public.public_receipt('tokenbbbbbbbb') AS r`));
    const receipt = (found[0] as { r: { business: { name: string }; sale: { total: number } } }).r;
    expect(receipt.business.name).toBe('Duka B');
    expect(receipt.sale.total).toBe(5000);

    const missing = await as(null, () => rows(`SELECT public.public_receipt('nope-nope-nope') AS r`));
    expect((missing[0] as { r: unknown }).r).toBeNull();
  });
});

describe('business settings', () => {
  it('only the owner can edit the business itself', async () => {
    const byCashier = await as(CASHIER, () => pg.query(`UPDATE businesses SET name = 'hacked' WHERE id = $1`, [BIZ_A]));
    expect(byCashier.affectedRows ?? 0).toBe(0);
    const byOther = await as(USER_B, () => pg.query(`UPDATE businesses SET name = 'hacked' WHERE id = $1`, [BIZ_A]));
    expect(byOther.affectedRows ?? 0).toBe(0);
    const byOwner = await as(USER_A, () => pg.query(`UPDATE businesses SET name = 'Genge A2' WHERE id = $1`, [BIZ_A]));
    expect(byOwner.affectedRows).toBe(1);
  });
});

describe('bulk sizes', () => {
  it('a cashier can read pack sizes but not change them', async () => {
    const packId = id();
    const productId = id();
    await as(USER_A, async () => {
      await pg.query(`INSERT INTO products (id, business_id, name, unit) VALUES ($1, $2, 'Nyanya', 'fungu')`, [
        productId,
        BIZ_A,
      ]);
      await pg.query(
        `INSERT INTO product_packs (id, business_id, product_id, label, units) VALUES ($1, $2, $3, 'tenga', 40)`,
        [packId, BIZ_A, productId]
      );
    });

    expect(await as(CASHIER, () => rows('SELECT label FROM product_packs'))).toEqual([{ label: 'tenga' }]);
    await expect(
      as(CASHIER, () =>
        pg.query(`INSERT INTO product_packs (id, business_id, product_id, label, units) VALUES ($1, $2, $3, 'x', 2)`, [
          id(),
          BIZ_A,
          productId,
        ])
      )
    ).rejects.toThrow(/row-level security/);
    const edited = await as(CASHIER, () => pg.query(`UPDATE product_packs SET units = 99 WHERE id = $1`, [packId]));
    expect(edited.affectedRows ?? 0).toBe(0);
  });

  it('another business cannot see them at all', async () => {
    expect(await as(USER_B, () => rows('SELECT * FROM product_packs'))).toHaveLength(0);
  });
});

describe('accounts are made by the operator', () => {
  it('nobody signed in can create a business', async () => {
    await expect(
      as(USER_A, () => pg.query(`INSERT INTO businesses (id, name, type) VALUES ($1, 'Mine', 'duka')`, [id()]))
    ).rejects.toThrow(/row-level security/);
  });

  it('an owner cannot un-pause their own shop; the operator can pause it', async () => {
    await pg.exec('RESET ROLE');
    await pg.query(`UPDATE businesses SET status = 'paused' WHERE id = $1`, [BIZ_B]);

    const edited = await as(USER_B, () =>
      pg.query(`UPDATE businesses SET status = 'active', name = 'Duka B2' WHERE id = $1`, [BIZ_B])
    );
    // The write lands (the rest of the row is theirs) but the status is kept.
    expect(edited.affectedRows).toBe(1);
    expect(await as(USER_B, () => rows('SELECT name, status FROM businesses'))).toEqual([
      { name: 'Duka B2', status: 'paused' },
    ]);
    await expect(
      as(USER_B, () => pg.query(`UPDATE businesses SET status = 'gone' WHERE id = $1`, [BIZ_B]))
    ).resolves.toBeTruthy();

    await pg.exec('RESET ROLE');
    await pg.query(`UPDATE businesses SET status = 'active' WHERE id = $1`, [BIZ_B]);
  });

  it('a status outside active/paused is refused', async () => {
    await pg.exec('RESET ROLE');
    await expect(pg.query(`UPDATE businesses SET status = 'deleted' WHERE id = $1`, [BIZ_A])).rejects.toThrow(
      /businesses_status_check/
    );
  });

  it('the login lookup is closed to phones', async () => {
    await expect(
      as(USER_A, () => pg.query(`SELECT public.auth_user_id_by_email('255712000111@phone.kitabu.app')`))
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(null, () => pg.query(`SELECT public.auth_user_id_by_email('255712000111@phone.kitabu.app')`))
    ).rejects.toThrow(/permission denied/);
  });
});
