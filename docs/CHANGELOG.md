# Changelog

## 0.4.0 — the stock check, customers for offers, and sales by staff (2026-10-17)

Built for the pitch: every visit leads with "N items missing, worth TZS X", and the cosmetics and hardware pitches promise customer offers and per-staff sales.

### Stock check (Zaidi → Hesabu ya stoo, or Bidhaa)
- **Count a shelf** (`/stoo/hesabu`): pick a category or everything, type what is actually there; each row shows the records and what is missing, and the shortfall in shillings adds up at the bottom as you go. Only the products you type are counted. Typed numbers survive the phone locking.
- **The report** (`/stoo/ripoti`) leads with the number: "Bidhaa 7 zimepotea, yenye thamani ya TSh 40,000" at cost, then what it would have sold for, then the worst items. Items over the records are listed separately (usually stock that arrived unrecorded). One button sends the summary on WhatsApp.
- Saving sets the stock to what was counted (one adjustment per product, pointing back at the count).
- **History** (`/stoo`): when the shop was last counted, a nudge after 14 days, and every past count with its shortfall.
- New table `stock_counts` (migrations 0005, 0006): the lines are a snapshot, so an old report reads back the same after products are renamed or repriced. Everyone in the shop can read them; only owners and managers record one; never deleted. Maths in `lib/calc/stock-count.ts`, tested.

### The first visit can show a loss
- Bulk entry has an optional **"Ilitakiwa kuwepo"** (should be there) figure per row, switched on with one toggle: the owner's estimate or the last delivery note. Pasted lists take it as a 7th column.
- Saving then shows the **first-count report** straight away (what the shelf is short against the owner's figure), with "count again on <date>" two weeks later. The counted shelf is the opening stock either way.
- Without figures, setup works as before, and the second count two weeks later is the report. Both routes are in the app.

### Customers for WhatsApp offers (Zaidi → Wateja)
- **Every customer**, not just debtors: number, visits, last visit, total spent. Filters: everyone / this month / not back in 30 days.
- **Send an offer** (`/wateja/ofa`): write one message with `{jina}` and `{duka}`; tap each name and WhatsApp opens with that person's own message. The list remembers who has been sent one, even when the phone switches to WhatsApp and back. (WhatsApp doesn't let a link message many people at once; this is the honest way.)
- **Download** the list as phone contacts (.vcf, for a WhatsApp Business broadcast list) or as a spreadsheet.
- A customer can be marked **"hataki ofa"** (no offers); they stay a customer for credit and receipts. Name and number can now be edited.
- Customers are captured at the till: an optional customer on any payment ("Andika mteja (si lazima)"), and **"Mhifadhi mteja kwa ofa"** after a sale saves the number while sending the receipt. A number already on the list is never added twice.
- `customers.no_offers` column (migration 0005).

### Sales by staff (Zaidi → Mauzo kwa mfanyakazi)
- Today, 7 or 30 days: what each person sold, their share, the cash they took (including debt repayments), and any sales of theirs that were cancelled. Owners and managers only. Uses the "who made it" already recorded on every sale and payment.
- **Staff logins are now on by default for cosmetics and clothes shops**, as for hardware. Still switchable per shop.

### Each shop type starts with its own things
- Starter products, categories and pictures for every type: lotions, lipsticks and nail polish for cosmetics; dresses, shoes and bags for clothes; cement, nails and paint for hardware; and so on. No tomatoes outside a genge.
- The product picture picker shows the trade's pictures first; products typed in bulk get a picture from their category (Losheni → lotion, Viatu → shoe). The name hint follows the trade ("Mf. Nivea Lotion").
- The **demo shop** now matches the shop's type, and ends on the stock-check story: a clean count a week ago, things missing today.

### Data budget
The sales screen's first load is 208.7 KB (limit 210). Almost all of the growth is wording: every screen's text ships in one cached file. If the limit gets tight again, the next step is loading each screen's wording with that screen.

### Tests
179 unit and database tests (from 146): the stock-check maths, saving a count and its corrections through sync, the first-visit report, customer offers and exports, staff totals, starter categories and pictures, and the new database rules.

## 0.3.0 — Kitabu: one app, many shops (2026-10-14)

Hesabu becomes **Kitabu**, a template an operator sets up and customises per shop, aimed first at cosmetics, clothes and hardware shops in Dar. The code before this release is on the `hesabu-original` branch. Nothing here adds a dependency.

### Plain files, hosted free
- `next build` now writes a static site (`out/`). Nothing runs on the host; GitHub Pages publishes it from `.github/workflows/pages.yml` (checks, then build, then deploy), and `netlify.toml` does the same for Netlify.
- The language lives on the phone instead of in a cookie (`components/locale-provider.tsx`). The HTML is Swahili; a phone set to English switches straight after load.
- Record pages take `?id=` (`/bidhaa/hariri`, `/madeni/mteja`, `/hati/ona`), and receipt links are `/r/?t=<token>`, read in the browser. Old `/r/<token>` links redirect on Netlify.
- Served from a sub-folder (`NEXT_PUBLIC_BASE_PATH`, e.g. `/kitabu-erp`), and the service worker precaches the main screens at install.
- **Data budget:** the sales screen's first-load JS is 205 KB, measured gzipped on the static build (budget raised from 200 to 210 KB). The Swahili wording (~9 KB) now ships as one cached script instead of inside every page's HTML, where the old test never counted it. To stay inside it, the bottom tabs and the sales header no longer prefetch other screens' code; the service worker already holds it.

### Sign-in without SMS
- **Phone number + password.** The first password is a **setup code** (`ABCD-EFGH`, no characters that can be misread) from the operator, or from the owner for their staff. The next screen asks for a password of their own (`/neno-siri`), then the PIN.
- **`supabase/functions/accounts`**, the only server code, running inside Supabase: `create_shop`, `list_shops`, `update_shop`, `issue_code`. An owner can issue codes for their own managers and cashiers, never for another owner or themselves. Permission rules are in `rules.ts` and unit-tested.
- **`/admin`**, the operator's screen: create a shop (name, type, owner's phone, language, colour) and send the owner their code on WhatsApp; pause or reactivate a shop; give an owner a new code.
- **`npm run operator`** makes the operator login (needs the service-role key in `.env.local`, never anywhere else).
- **Migration 0004:** phones can no longer create businesses; `status` (active/paused) can only be changed by the service role (a phone's copy is ignored rather than refused, so the outbox never jams); the login lookup is closed to phones; receipts carry address, colour and Lipa Namba.
- **Contact support** on WhatsApp from sign-in, the paused screen, "not linked to a shop", and Zaidi (`NEXT_PUBLIC_SUPPORT_WHATSAPP`).
- A **paused** shop shows "contact us" instead of the till. Its records stay on the phone and still sync.
- Staff (Wafanyakazi): adding someone gives the owner a setup code to hand over; *Namba mpya* resets a forgotten password.
- The demo (no Supabase keys) still works end to end: any phone number with the setup code **KTAB-2468**.

### Per-shop configuration (`lib/shop-config.ts`)
- **New shop types: cosmetics (Vipodozi) and clothes & accessories (Nguo na mapambo).** Every type has a preset: which product details are asked for (shade; size and colour; type/size), starter categories, default unit, and feature defaults (cosmetics and clothes don't reprice every morning).
- **Mipangilio** now has: shop type, **colour** (themes the whole app and the customer's receipt), address, **payment methods** taken (only those appear at the till), **Lipa Namba per method** (shown on the payment sheet and receipts), and an on/off switch for each part of the app (stock, credit, purchases, expenses, suppliers, losses, daily prices, staff, invoices, VAT). Each control saves on its own.
- Features resolve shop override → preset → mode, so switching a type never loses data.
- The demo-shop button only appears on the demo.

### Products with shades and sizes
- **Variants** are product rows sharing a name, with a `variant` column (migration 0003): stock, price and profit per shade work with nothing new in the ledger. Sale lines, receipts, invoices and reports read "Lipstick – Red 01".
- **Bulk entry** (`/bidhaa/ingiza`): count a shelf and type it in, with *Rangi nyingine* copying a row for the next shade, or **paste a list** from Excel, Google Sheets or WhatsApp (tabs, commas or semicolons; "12,500" stays one number). Quantities become opening stock at cost. A new shop lands here straight after the PIN.
- The till has **category chips** once a shop has more than one category, shows the shade on each tile, and searches name, shade, category and barcode.
- The product list is grouped by category with search; the product form asks for shade/size, offers the trade's categories, and shows barcode where the preset wants it. *Rangi nyingine* on a product opens a new one prefilled.

### Fixed
- The till's bottom bar squeezed five-digit totals ("20,5…") between the pay buttons. The total now has its own line.

### Tests
- 146 unit and database tests (from 107): setup codes, phone-to-login mapping, function permissions, shop presets and feature precedence, payment methods, variant search and grouping, the paste parser, bulk save through sync, and the new database rules.
- The end-to-end test is now an owner's real first day against a fake Supabase: setup code → own password → PIN → bulk entry of two shades → offline sales that sync exactly once.

## 0.2.1 — the app now really does open offline (2026-09-24)

### Fixed: the PWA could not be reopened without a connection
Deploying publicly exposed a defect the local tests had been blind to. Every page is server-rendered per request (the language is a cookie) and comes back `no-store`, so **no page HTML was ever cached**. Sales were safe in IndexedDB the whole time, but reopening the app with no signal had no shell to show them in — which is the core promise of the product.

The tests had missed it because they only ever went offline *inside* an already-loaded page. Moving between screens in the app swaps router payloads rather than fetching pages, so nothing was cached on the way either.

- The service worker now keeps the last good copy of each page and each navigation payload (`NetworkFirst`, so an online phone is never served a stale price list).
- On install — once per deployed version, when a connection is known to exist — it warms the screens a trader actually opens: Mauzo, Manunuzi, Madeni, Hesabu, Zaidi, Bei and the offline page. About 50KB once per release, which is the price of the app opening at all without signal.
- The end-to-end test now reloads the app, navigates between screens **and completes a whole sale while offline**, so this cannot regress silently.

### Fixed: the first sale made offline could not show its confirmation
Found while verifying the fix above on the live site. The code-split screens — the payment, basket and success sheets, the keypad, the PIN lock — are fetched the first time they are needed, and the build's precache does not include them. "The first time" is exactly the market with no signal.

- `components/warm-chunks.tsx` loads them 2.5 seconds after the app is interactive, at idle priority, so they are in the cache before they are needed and a trader never waits on them.
- The budget test now measures first-load JS at the moment the grid is usable (196.0 KB) and reports the deferred total separately, rather than counting work that happens after the screen is ready.

### Deployment
- Public demo at **https://hesabu-tz.netlify.app** (see `docs/DEPLOY.md`). Netlify's "Powered by Netlify" badge was turned off: it sits bottom-right, directly over the app's bottom navigation on a 360px screen.

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

### Branding
- The app has a **logo**: a ruled book — the daftari a trader already keeps — in the app's own green.
- It is generated once from a single set of shapes in `scripts/make-icons.mjs` (`npm run icons`) and appears as: the browser tab icon (`app/icon.svg`), the iOS home-screen icon (`app/apple-icon.png`), the installed-app icons (192 and 512), and the link-preview card shown when a receipt link is shared (`app/opengraph-image.tsx`).
- In the app itself it appears on sign-in, onboarding, the PIN screen, the loading splash, the offline page, the bottom of the More screen, and on the public receipt a customer opens. `components/brand/logo.tsx` is the same mark as SVG.
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
