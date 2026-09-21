# Build Plan — prompts for Claude Code

How to use this file:
1. Create an empty folder, put `CLAUDE.md` in the root and `MVP_SPEC.md` + `BUILD_PLAN.md` in `/docs`.
2. Open Claude Code in that folder.
3. Paste **one phase prompt at a time**. Don't start the next phase until the current one meets its acceptance checks and you've tried it on a phone yourself.
4. After each phase, commit to git (`git commit -am "Phase N"`), so you can always roll back.

Setup you need to do yourself (Claude Code can't do these for you): create a Supabase project, a Vercel account, and a GitHub repo, then put the Supabase keys in `.env.local`.

---

## Phase 0 — Foundation
```
Read CLAUDE.md and docs/MVP_SPEC.md fully. Then set up the project foundation:
- Next.js App Router + TypeScript strict, Tailwind, shadcn/ui, next-intl (sw default, en), Drizzle connected to Supabase Postgres, Zod, Vitest, Playwright, ESLint.
- PWA setup with @serwist/next: manifest, icons placeholder, offline app shell.
- Create the full database schema from section 5 of the spec as Drizzle schema + migration, including RLS policies so users only see rows of businesses they are members of. Add SQL views for customer balances and supplier balances.
- Add helpers: formatTZS(), uuidv7(), and an i18n:check script that fails on missing keys.
- Create a mobile-first app layout: bottom navigation with 4 items (Mauzo, Madeni, Hesabu, Zaidi), large tap targets.
- Write tests for RLS (a user from business A cannot read business B).
Before writing code, show me a short plan and the folder structure.
```
**Acceptance:** app runs locally, installs as PWA on Android Chrome, migration applies cleanly, RLS test passes, UI in Swahili.

---

## Phase 1 — Onboarding & auth
```
Implement section 3.1 of docs/MVP_SPEC.md:
- Phone OTP sign-up/login via Supabase Auth (dev mode OTP 123456 via env flag).
- Device PIN: set 4-digit PIN after first login, required to unlock the app when reopened; store only a hash.
- Onboarding: business name, visual business-type picker with icons, language. Business type sets mode (genge/duka/biashara) per section 2.
- Seed starter products per business type (define lists in /lib/onboarding/starter-products.ts, Swahili names).
- Settings page with mode switch and language switch.
Keep onboarding to 3 screens maximum.
```
**Acceptance:** fresh user reaches the sales screen with starter products in under a minute.

---

## Phase 2 — Products, prices & stock
```
Implement sections 3.2 and 3.6 of the spec:
- Product list, add/edit product (unit picker incl. fungu, kg, kipande, bunda, debe, pakti, lita, dazeni, custom), emoji/photo icon.
- Daily price update screen (all products, big inputs, prefilled, one save button) writing to price_history.
- Stock as an append-only stock_movements ledger; current stock computed from it. Low-stock indicators.
- Waste/spoilage screen (Hasara) with reasons.
- Hide SKU/barcode/category/VAT fields unless mode is biashara.
Unit tests for stock calculation and weighted-average cost.
```

---

## Phase 3 — Sales (POS) with offline support
```
Implement section 3.3 and section 4 of the spec. This is the most important screen in the app — optimise for speed.
- Home = product tile grid; tap adds 1; tap quantity for numeric keypad with decimals. Cart as a bottom sheet.
- Amount-only quick sale for genge/duka modes.
- Payment: cash, mobile money (M-Pesa, Mixx by Yas, Airtel Money, HaloPesa + optional reference), credit (requires customer; allow creating a customer inline), split payment.
- Per-line price override and total discount.
- Success screen with "Tuma risiti WhatsApp" (wa.me link with text receipt + public receipt URL using an unguessable token). Build the public receipt page.
- Void sale (owner/manager only, reason required, reverses stock).
- Offline: Dexie local store + outbox; sales save instantly offline and sync with idempotent upserts. Sync status indicator in the header.
Playwright test: record 3 sales while offline, go online, verify they sync exactly once.
Target: a sale in 3 taps from home.
```

---

## Phase 4 — Customers & credit (Daftari la madeni)
```
Implement section 3.4 of the spec:
- Customer list sorted by balance owed, with days since last payment.
- Customer detail: history of credit sales and payments, running balance.
- Record payment (cash / mobile money), works offline.
- "Mkumbushe" WhatsApp reminder with a polite Swahili template and balance (template editable in settings).
```

---

## Phase 5 — Expenses, purchases & daily summary
```
Implement sections 3.5 and 3.7 of the spec:
- Expense entry with Tanzanian-relevant categories (nauli, ushuru, kodi, umeme, chakula, mishahara, nyingine).
- Stock purchase (Manunuzi) that increases stock and updates weighted-average cost.
- Hesabu ya leo: sales by payment method, debt collected, expenses, purchases, expected cash in hand, estimated profit (labelled as estimate).
- Funga siku (close day): enter counted cash, show difference, store in day_closings, set next day's opening cash.
- 7/30-day view: sales-per-day bar chart (lightweight, no heavy chart lib if possible), top products.
Unit tests for expected cash and profit calculations.
```

**→ Stop here and field-test genge/duka modes with real users before continuing.**

---

## Phase 6 — Biashara mode
```
Implement section 3.8 of the spec:
- Documents flow: proforma → delivery note → invoice → payments, one tap per conversion, lines carried forward, per-business numbering.
- PDF generation (server-side) with logo, TIN, VRN, bank and mobile money pay details; share via WhatsApp link or download.
- Suppliers with balances; purchases can be unpaid.
- VAT per product (standard/exempt), rate from settings (default 18%), VAT breakdown on invoices.
- Staff invites by phone number with roles owner/manager/cashier; enforce roles in RLS and in the UI (cashiers can't see profit or void).
- CSV export of sales, expenses, customers, stock.
```

---

## Phase 7 — Polish & launch readiness
```
Review the whole app against CLAUDE.md principles:
- Audit every screen at 360px width and in both languages; fix any English leaking into Swahili UI.
- Performance: measure JS bundle per route, target < 200KB gzipped for the sales screen; lazy-load everything else.
- Add error tracking (Sentry free tier) and a simple in-app "Tuma maoni" feedback button.
- Add a demo business with realistic Tanzanian sample data for sales demos.
- Write docs/DEPLOY.md with exact steps to deploy to Vercel + Supabase production.
```

---

## Tips for working with Claude Code on this
- Ask for a plan first on big phases ("show me the plan before coding").
- If something breaks, paste the exact error message; don't describe it.
- Test on a real cheap Android phone after every phase, not just your laptop.
- Keep Swahili copy reviewed by a native speaker who actually runs or shops at a genge — it's your biggest differentiator.
