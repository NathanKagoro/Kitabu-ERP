# Hesabu

Live demo: **https://hesabu-tz.netlify.app** — sign in with any Tanzanian mobile number and the code 123456. The demo has no backend: your data stays in your own browser.

A mobile-first business app for Tanzanian small businesses: a genge or duka on a cheap Android phone, up to a small formal business with staff, invoices and VAT. Swahili first, works offline.

Product spec: [docs/MVP_SPEC.md](docs/MVP_SPEC.md) · Build plan: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) · What's built: [docs/CHANGELOG.md](docs/CHANGELOG.md) · Deploying: [docs/DEPLOY.md](docs/DEPLOY.md)

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No backend is needed. With the Supabase keys blank, the app runs entirely on the phone: sign in with any Tanzanian mobile number and the code **123456**. To see it with data, go to **Zaidi → Mipangilio → Tengeneza biashara ya mfano** for a demo business with two weeks of sales.

To sync to a server, copy `.env.example` to `.env.local`, fill in the Supabase keys, and run `npm run db:migrate` (see [docs/DEPLOY.md](docs/DEPLOY.md)).

## Checks

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint (Next.js rules) |
| `npm test` | Unit tests for every money and stock calculation, the offline write path and sync, and the RLS policies run in a real Postgres (PGlite) |
| `npm run i18n:check` | Swahili and English have the same keys and placeholders, and every `t('…')` in the code exists |
| `npm run test:e2e` | Playwright on a production build: 3 offline sales sync exactly once; the sales screen's first-load JS stays under 200 KB |

## How it is put together

**Local-first.** The phone's IndexedDB (Dexie) is where the app reads and writes. Supabase is a replica the phone catches up with. This is why selling never waits on the network and a sale can't be lost to a dropped connection.

```
tap "Lipa taslimu"
  → lib/local/actions.ts   recordSale(): sale + lines + payments + stock movements
  → lib/local/write.ts     one IndexedDB transaction: rows + outbox entries
  → UI updates at once (live queries)
  … later, online …
  → lib/sync/engine.ts     drain outbox → upsert on client UUID v7 (idempotent) → pull by server cursor
```

- **Money** is integer TZS everywhere, formatted only by `formatTZS()` in `lib/money.ts`.
- **Stock** is never stored. It is the sum of the append-only `stock_movements` ledger.
- **Bulk sizes** (`product_packs`) convert a purchase into selling units at the moment it is recorded, so everything downstream — stock, cost, profit — works in one unit.
- **Balances** (the daftari, what's owed to suppliers) are derived from payments, in `lib/calc/credit.ts` and in the SQL views.
- **Calculations** live in `lib/calc/*`, are pure functions, and are unit-tested.
- **Modes** (genge / duka / biashara) only decide what's visible (`lib/modes.ts`). Switching never changes data.
- **Security** is RLS in `db/migrations/0001_rls_views_functions.sql`. Roles are enforced there, and the UI mirrors them.

```
app/(app)/…        screens: mauzo, manunuzi, madeni, hesabu, zaidi, bidhaa, bei, hasara,
                   matumizi, faida, wauzaji, hati, wafanyakazi, mipangilio
app/(auth), (onboard)  sign-in, PIN, 3-screen onboarding
app/r/[token]      public receipt page
components/        ui primitives, POS, credit, summary; brand mark; icons/ is generated (npm run icons)
lib/calc/          money, stock, credit and summary maths
lib/local/         Dexie store, domain actions, live queries, documents
lib/sync/          outbox → Supabase sync
db/                Drizzle schema + migrations (incl. RLS)
messages/          sw.json (source), en.json
tests/unit, tests/db, tests/e2e
```

Hesabu is a working name. Rename it across the repo once there's a final one.
