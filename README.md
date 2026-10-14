# Kitabu

A business app for Tanzanian shops (cosmetics, clothes, hardware, dukas, genges) that one operator sets up and customises per shop. Swahili first, works offline, runs on a cheap Android phone.

**One app, many shops.** Each shop gets its own colour, payment methods and Lipa Namba numbers, receipt details, and the parts of the app it needs. Product details follow the trade: shades for cosmetics, size and colour for clothes, sizes and gauges for hardware.

**Plain files plus Supabase.** The app builds to static files hosted free on GitHub Pages; Supabase holds the data and logins. No SMS: shops sign in with a setup code from you, then their own password.

Live demo (data stays in your browser): **https://nathankagoro.github.io/Kitabu-ERP/**, sign in with any Tanzanian mobile number and the setup code **KTAB-2468**.

Deploying and setting up shops: [docs/DEPLOY.md](docs/DEPLOY.md) · What's built: [docs/CHANGELOG.md](docs/CHANGELOG.md) · Original spec: [docs/MVP_SPEC.md](docs/MVP_SPEC.md)

The code before Kitabu became a multi-shop template is kept on the [`hesabu-original`](../../tree/hesabu-original) branch.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

With the Supabase keys blank this is the demo: everything stays in the browser. Sign in with any number and **KTAB-2468**, pick a shop type, and you land on bulk entry. **Zaidi → Mipangilio → Tengeneza biashara ya mfano** makes a demo shop with two weeks of sales.

`npm run preview` builds the static site and serves it the way GitHub Pages will.

## Checks

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint (Next.js rules) |
| `npm test` | Every money and stock calculation, shop configuration, setup codes and permissions, the offline write path and sync, and the database security policies run in a real Postgres (PGlite) |
| `npm run i18n:check` | Swahili and English have the same keys and placeholders, and every `t('…')` in the code exists |
| `npm run test:e2e` | Playwright on the static build: an owner's first day (setup code → password → PIN → bulk entry), offline sales that sync exactly once, and the sales screen's JS budget |

## How it is put together

**Local-first.** The phone's IndexedDB (Dexie) is where the app reads and writes; Supabase is a replica the phone catches up with. Selling never waits on the network and a sale can't be lost to a dropped connection.

```
tap "Lipa taslimu"
  → lib/local/actions.ts   recordSale(): sale + lines + payments + stock movements
  → lib/local/write.ts     one IndexedDB transaction: rows + outbox entries
  → UI updates at once (live queries)
  … later, online …
  → lib/sync/engine.ts     drain outbox → upsert on client UUID v7 (idempotent) → pull by server cursor
```

**Per-shop configuration** lives in `lib/shop-config.ts` and each business's `settings`:

| What | Where it is set |
|---|---|
| Shop type → preset (screens shown, categories, shade/size fields, default unit) | /admin when creating; Mipangilio |
| Colour (themes the app and receipts), address, receipt footer, TIN | Mipangilio (colour also in /admin) |
| Payment methods taken, Lipa Namba per method | Mipangilio |
| Parts of the app on/off (stock, credit, suppliers, invoices, VAT, staff…) | Mipangilio |
| Active / paused | /admin only |

**Accounts.** `supabase/functions/accounts` (the only server code, running inside Supabase) creates shops and logins and issues setup codes. Phone numbers map to fixed login addresses (`lib/auth/login.ts`). Public sign-up is off, and the database refuses business creation from phones (`db/migrations/0004_accounts.sql`).

- **Money** is integer TZS everywhere, formatted only by `formatTZS()` in `lib/money.ts`.
- **Stock** is never stored. It is the sum of the append-only `stock_movements` ledger.
- **Variants** (shades, sizes) are product rows sharing a name (`lib/products.ts`), so stock, price and profit work per variant with nothing new in the ledger.
- **Bulk sizes** (`product_packs`) convert a purchase into selling units when it is recorded.
- **Balances** (customer credit, what's owed to suppliers) are derived from payments.
- **Security** is RLS in `db/migrations/`. Roles are enforced there, and the UI mirrors them.

```
app/(app)/…        screens: mauzo, manunuzi, madeni, hesabu, zaidi, bidhaa (+ ingiza: bulk entry),
                   bei, hasara, matumizi, faida, wauzaji, hati, wafanyakazi, mipangilio
app/(auth)         ingia (sign in), neno-siri (choose password), pin
app/(onboard)      karibu: demo onboarding / "not linked to a shop"
app/(operator)     admin: the operator's shop list
app/r              public receipt (?t=token)
components/        ui primitives, POS, settings, receipt; icons/ is generated (npm run icons)
lib/               calc/ (money, stock, credit), local/ (Dexie), sync/, auth/, shop-config, products
supabase/functions accounts Edge Function
db/                Drizzle schema + migrations (incl. RLS)
messages/          sw.json (source), en.json
tests/unit, tests/db, tests/e2e
```
