# Changelog

## 0.2.0 — buying in bulk, and what each product earns (2026-09-23)

From the first round of feedback on 0.1.0.

### Prices come before selling
- Setting up now ends on **Bei za leo** instead of the till: a new owner sets starting prices as the last step of onboarding, then lands on the sales screen. Onboarding itself is still three screens.
- The sales screen shows a banner when any product still has no price, linking straight to the price screen. (Tapping a price-less tile still opens the keypad, as before.)

### Stock purchases are a tab, and use the sizes stock is actually bought in
- **Manunuzi now sits in the bottom bar, next to Mauzo** rather than under Zaidi. Five tabs: Mauzo, Manunuzi, Madeni, Hesabu, Zaidi.
- A product can carry the **bulk sizes it is bought in** — a *tenga* of tomatoes, a 50kg *gunia* of rice, a *katoni* of soap — each recording how many selling units it holds. Edited on the product, under *Ununuzi wa jumla*.
- Buying now asks **which size** and **how many**, not a vague "how much stock", and converts in front of the user before saving: "2 tenga → 80 fungu · 750 kwa fungu", followed by "unauza 1,000 — faida 250 kwa fungu", or a warning when the buying price is above the selling price.
- Buying loose is still one tap (*Kimoja kimoja*), and the purchase keeps what was actually bought ("2 × tenga"), so it reads back the way it was entered.
- New table `product_packs` with its own RLS: everyone in the business can read the sizes, owners and managers maintain them.

### Profit per product
- New **Faida kwa bidhaa** screen (Zaidi → Faida kwa bidhaa, owners and managers): over 7 or 30 days, each product's quantity sold, sales, cost of what was sold, profit and margin, ranked by what actually earned.
- Each line also shows the current buy-versus-sell per unit and what was spent restocking it, so a thin margin is visible before it becomes a bad month. Products losing money are flagged, and a product whose sales could not be costed says so rather than counting as pure profit.

### Also
- The app has a **logo**: a ruled book — the daftari a trader already keeps — in the app's own green. Used for the installed-app icon and on the sign-in screen.
- The demo business now buys in packs and restocks a few lines each morning, so its numbers behave like a real stall.


## 0.1.0 — MVP, phases 0–7 (2026-09-21)

The whole build plan, built in one pass. The plan says to field-test genge and duka modes with real users after Phase 5, before biashara mode. That hasn't happened yet, so treat Phase 6 as unvalidated with users.

### Phase 0: Foundation
- Next.js 16 (App Router), TypeScript strict, Tailwind v4, next-intl (`sw` default, `en`), Drizzle, Zod, Vitest, Playwright, ESLint.
- PWA: manifest, generated icons (`scripts/make-icons.mjs`), Serwist service worker, offline fallback page.
- Full schema from spec §5 plus `waste_events` and `feedback`. Every table has client UUID v7 keys, integer-TZS money, `numeric(12,3)` quantities, soft delete, and a server-set `synced_at` pull cursor.
- RLS on every table (`db/migrations/0001_rls_views_functions.sql`). No DELETE policies at all. Views `customer_balances` and `supplier_balances` use `security_invoker`.
- `formatTZS()`, `uuidv7()`, and `npm run i18n:check`, which checks locale parity, placeholder parity and every `t()` key used in the code.
- Bottom navigation: Mauzo, Madeni, Hesabu, Zaidi.
- RLS tests run the real migration SQL in PGlite (in-process Postgres): tenant isolation, no hard deletes, cashier limits, no self-promotion, invite claiming, the public receipt function.

### Phase 1: Onboarding and auth
- Phone OTP through Supabase. The dev OTP `123456` works when `NEXT_PUBLIC_DEV_OTP=1` or when no backend is configured.
- 4-digit device PIN, stored only as a PBKDF2 hash. Asked for when the app is reopened.
- Three onboarding screens: name with the language switch, a visual business-type picker, and the starter products.
- Starter product lists per business type (`lib/onboarding/starter-products.ts`).
- Settings: switch mode and language.

### Phase 2: Products, prices and stock
- Product list and editor: 9 units including custom, emoji icons, optional cost and stock tracking. SKU, barcode, category and VAT fields appear only in biashara mode.
- Daily price screen (Bei za leo): prefilled, one save, and only changed prices are written to `price_history`.
- Stock is derived from the ledger, with low-stock and out-of-stock badges and a manual count adjustment.
- Losses screen (Hasara) with reasons, valued at cost.

### Phase 3: Sales (POS) and offline
- Tile grid: tap adds 1, long-press or tapping a cart line opens a keypad with decimals for kg and litres. Products with no price open straight onto the price keypad.
- **A cash sale takes 2 taps from home** (tile, then *Lipa taslimu*).
- Quick amount-only sale in genge and duka modes.
- Payments: cash (with change), M-Pesa, Mixx by Yas, Airtel Money, HaloPesa (optional reference), credit with a customer created inline, and split cash plus credit.
- Per-line price override and a whole-sale discount spread across lines to the shilling.
- Success sheet with *Tuma risiti WhatsApp* and a public receipt page at `/r/[token]`.
- Void sale: owner or manager, reason required, puts stock back, deletes nothing.
- Offline: Dexie store plus a transactional outbox. First writes go as insert-or-ignore and edits as upserts, so retries are idempotent and need no UPDATE permission. Header shows sync status.

### Phase 4: Credit (Daftari la madeni)
- Customers sorted by what they owe, with how long since each last paid.
- Customer page: history with a running balance, record a payment (cash or mobile money), and *Mkumbushe* WhatsApp reminder. The reminder template can be edited in settings.

### Phase 5: Expenses, purchases and daily summary
- Expenses with Tanzanian categories (nauli, ushuru, kodi, umeme, chakula, mishahara, nyingine).
- Stock purchases re-base product cost by weighted average. Unknown-cost stock is ignored rather than treated as free.
- Hesabu ya leo: sales by method, debts collected, expenses, purchases, losses, expected cash, and estimated profit (labelled *makisio*, and flagged when some costs are missing).
- Funga siku: counted against expected, shows *zaidi* or *pungufu*, and the counted amount becomes tomorrow's opening cash.
- 7 and 30 day bar chart (plain divs, no chart library) and top products.

### Phase 6: Biashara mode
- Proforma → delivery note → invoice, one tap per step, lines carried forward, numbered per business (`PF-0001`, `DN-0001`, `INV-0001`).
- Issuing an invoice records a credit sale, so invoices feed stock, the daily summary and the daftari. Invoice payments update the invoice status.
- PDF with TIN, VRN, bank details and Lipa number, shared to WhatsApp through the share sheet or downloaded.
- Suppliers with balances. Purchases can be part-paid, and later payments to suppliers are recorded.
- VAT per product (standard or exempt). The rate is a setting, default 18%.
- Staff invites by phone with owner, manager and cashier roles, enforced in RLS and mirrored in the UI.
- CSV export of sales, expenses, customers and stock.

### Phase 7: Polish and launch readiness
- Checked at 360 px in both languages: no horizontal scroll on any screen.
- **The sales screen's first-load JS is 197.4 KB gzipped, under the 200 KB target** (measured in Playwright on a cold load). It started at 292.8 KB. About 130 KB of what remains is Next.js and React themselves, so there is little headroom: check `npm run test:e2e` when adding anything to the sales screen. What cut it:
  - The Supabase client loads lazily, after the screen is idle (it's about 70 KB).
  - The POS sheets are code-split.
  - next-intl messages are precompiled at build time.
  - A generated icon set (`npm run icons`) replaced the lucide-react runtime.
  - The PIN-gate helpers were split from the sign-in module, and the Sentry loader is a plain script tag.
  - A small `cn()` replaced tailwind-merge.
- Error tracking through the Sentry Loader Script, so there's no SDK in the bundle and nothing loads until an error happens.
- *Tuma maoni* feedback button. It works offline and sends later.
- Demo business with two weeks of realistic genge data, created through the same code paths as real use.
- `docs/DEPLOY.md`.

### Deviations from the plan, and why
- **Mutations run on the phone, not in `/server/actions`.** CLAUDE.md puts server mutations there, but a server action can't run with no signal, and selling offline is non-negotiable. The domain operations live in `lib/local/actions.ts` and reach the server through sync. RLS is the server-side check.
- **The PDF is built on the phone, not the server.** An invoice written offline isn't on the server yet, and the owner still needs to send it. `pdf-lib` loads only when a PDF is made.
- **The webpack build is used instead of Turbopack** (`next build --webpack`), because the Serwist plugin produces no service worker under Turbopack.

### New dependencies
- `pdf-lib` for invoice PDFs, lazy-loaded.
- Dev only:
  - `fake-indexeddb`, to test the real Dexie write path.
  - `@electric-sql/pglite`, to run the RLS migration in tests without a Supabase project.
  - `lucide-react`, now only the source for the icon generator.
