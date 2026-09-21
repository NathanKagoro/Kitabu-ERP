# MVP Spec — Hesabu

## 1. Who it's for

| Persona | Example | Reality | What they need most |
|---|---|---|---|
| **Mama Neema — genge** | Sells tomatoes, onions, sukuma, bananas by the roadside in Sinza | One phone, buys stock at Kariakoo/Tandale most mornings, prices change daily, sells by *fungu* (heap), gives credit to regulars | Know if she made money today, track who owes her, don't lose stock to spoilage without noticing |
| **Juma — duka** | Small shop selling soap, sugar, rice, airtime | Works alone or with one helper, mix of cash and M-Pesa | Fast sales, know when to restock, track *madeni* |
| **Grace — biashara** | Hardware wholesaler with 4 staff | Issues proforma invoices, has suppliers, some customers pay later, VAT-registered | Proforma → delivery note → invoice, staff accounts, stock across the business, clean records for her accountant |

## 2. Business modes

At onboarding the owner picks a business type. That sets a **mode**, which only controls what's visible. Owners can switch modes later in settings without losing data.

| Feature | Genge mode | Duka mode | Biashara mode |
|---|---|---|---|
| Quick sale grid | ✅ default home | ✅ default home | ✅ |
| Amount-only sale ("Mauzo ya haraka") | ✅ | ✅ | ❌ hidden |
| Products & stock | Simple | ✅ | ✅ + SKU, barcode, categories |
| Selling units (fungu, kg, kipande, bunda, debe) | ✅ | ✅ | ✅ |
| Daily price update | ✅ prominent | Optional | ❌ |
| Spoilage / waste (*Hasara*) | ✅ prominent | ✅ | ✅ |
| Customers & credit (*Daftari la madeni*) | ✅ | ✅ | ✅ |
| Expenses | ✅ | ✅ | ✅ |
| Stock purchases (*Manunuzi*) | Simple | ✅ | ✅ + suppliers |
| Daily summary (*Hesabu ya leo*) | ✅ | ✅ | ✅ |
| Proforma / delivery note / invoice | ❌ | Optional | ✅ |
| Staff accounts & roles | ❌ | Optional | ✅ |
| VAT fields, TIN | ❌ | ❌ | ✅ |
| PDF documents | ❌ | Receipts | ✅ |

## 3. MVP modules

### 3.1 Onboarding & auth
- Sign up with **phone number + SMS OTP**. Then set a **4-digit PIN** used to unlock the app on that device.
- Onboarding asks only: business name, business type (visual picker: genge, duka, pharmacy, hardware, wholesale, services, other), language. Everything else optional, later.
- Offer a **starter product list** per business type (e.g., genge: nyanya, vitunguu, sukuma, mchicha, ndizi, viazi) so the owner can start selling within a minute. Prices blank until set.
- Dev mode: fixed OTP `123456`. Production: SMS via a Tanzanian-capable provider (Beem Africa or Africa's Talking) through Supabase's custom SMS hook.

### 3.2 Products & stock
- Fields: name, selling unit, selling price, buying cost (optional), stock quantity (optional — genges may not count stock), low-stock alert level (optional), photo/emoji icon.
- Units: `fungu` (heap), `kg`, `kipande` (piece), `bunda` (bunch), `debe`, `pakti`, `lita`, `dazeni`, custom.
- **Daily price update screen:** one list of all products with big price inputs, pre-filled with yesterday's prices. Save in one tap.
- Stock movements are an append-only ledger (`stock_movements`): sale, purchase, waste, adjustment. Current stock = sum of movements.

### 3.3 Sales (POS)
- Home screen = product grid with big tiles. Tap tile → adds 1 unit. Long-press / tap quantity → numeric keypad (supports decimals for kg).
- **Amount-only sale** (genge/duka): type an amount, tap save. For sellers who won't itemise.
- Payment method: **Cash**, **Mobile money** (M-Pesa, Mixx by Yas/Tigo Pesa, Airtel Money, HaloPesa — record reference number optionally), **Credit (deni)** → must choose/create customer, **Split** (part cash, part credit).
- Discount: amount off total (simple). Price override allowed per line (bargaining is normal).
- After sale: success screen with **"Tuma risiti WhatsApp"** button → opens `wa.me` link with a short text receipt + link to a public receipt page (unguessable token).
- Void sale (owner only, requires reason) → reverses stock movement, never deletes.

### 3.4 Customers & credit (*Daftari la madeni*)
- Customer: name, phone (optional), note.
- Credit balance per customer = credit sales − payments received.
- Record payment against a customer (cash or mobile money).
- List sorted by who owes the most; show days since last payment.
- **"Mkumbushe"** button → WhatsApp reminder with a polite, pre-written Swahili message and the balance.

### 3.5 Expenses & purchases
- **Expense:** amount, category (transport/*nauli*, market levy/*ushuru*, rent/*kodi*, electricity/*umeme*, food, wages, other), note.
- **Stock purchase (*Manunuzi*):** choose products, quantity, total cost paid. Increases stock and updates buying cost (weighted average).
- Biashara mode: purchases link to a supplier; can be unpaid (supplier credit).

### 3.6 Waste / spoilage (*Hasara*)
- Quick screen: pick product, quantity lost, reason (imeoza/rotten, imeibiwa/stolen, imeharibika/damaged, other). Reduces stock and appears in the daily summary as a cost.

### 3.7 Daily summary (*Hesabu ya leo*)
- Sales total, split by cash / mobile money / credit.
- Money collected on old debts.
- Expenses + purchases.
- **Expected cash in hand** = opening cash + cash sales + cash debt payments − cash expenses − cash purchases.
- **Close the day (*Funga siku*)**: owner enters actual cash counted → app shows the difference (*zaidi*/*pungufu*). Stored for history.
- Estimated profit = sales − cost of goods sold (where cost known) − expenses − waste. Clearly labelled as an estimate.
- Simple 7-day and 30-day views: sales per day bar chart, top products.

### 3.8 Biashara mode extras
- **Documents flow:** Proforma → Delivery note → Invoice → Payment(s). Each step one tap, carrying lines forward. Numbering per business (`PF-0001`, `DN-0001`, `INV-0001`).
- PDF generation with business logo, TIN, VRN, bank details, mobile money pay number.
- Suppliers list with balances owed.
- VAT: per-product flag (standard/exempt); invoice shows VAT breakdown. Rate is a setting (default 18%) — do not hard-code.
- **Staff:** owner invites by phone number. Roles: `owner` (everything), `manager` (all but settings/staff), `cashier` (sales, customers, expenses only; can't see profit or void sales).
- Export: CSV of sales, expenses, customers, stock for the accountant.

### 3.9 Settings
- Business profile, mode switch, language, receipt footer text, currency display (TZS only for MVP), PIN change, staff (biashara), data export.

## 4. Offline & sync
- App shell, product list, customers and today's data cached locally (Dexie).
- Writes for sales, payments, expenses, purchases, waste go to a **local outbox** first, UI updates instantly, a sync worker pushes when online.
- Every record has a client UUID → server upserts are idempotent (safe to retry).
- Conflicts: financial records are append-only, so they don't conflict. For product edits, last-write-wins with `updated_at`.
- Visible sync indicator: ✓ synced / ⟳ syncing / ● N pending. Never block selling because of sync.

## 5. Data model (core tables)

```
businesses        id, name, type, mode, tin, vrn, phone, logo_url, settings jsonb, created_at
members           id, business_id, user_id, role, pin_hash, active
products          id, business_id, name, unit, price, cost, track_stock bool, low_stock_level, icon, sku, barcode, vat_type, active, updated_at
price_history     id, business_id, product_id, price, effective_date
stock_movements   id, business_id, product_id, qty (+/-), type [sale|purchase|waste|adjust|void], ref_id, unit_cost, created_at, created_by
customers         id, business_id, name, phone, note
suppliers         id, business_id, name, phone, note
sales             id, business_id, customer_id?, total, discount, status [complete|void], void_reason, receipt_token, created_at, created_by, client_created_at
sale_lines        id, sale_id, product_id?, description, qty, unit_price, line_total, unit_cost
payments          id, business_id, sale_id?, customer_id?, direction [in|out], method [cash|mpesa|mixx|airtel|halopesa|bank|credit], amount, reference, created_at
expenses          id, business_id, category, amount, method, note, created_at
purchases         id, business_id, supplier_id?, total, paid_amount, created_at
purchase_lines    id, purchase_id, product_id, qty, total_cost
day_closings      id, business_id, date, expected_cash, counted_cash, difference, note
documents         id, business_id, kind [proforma|delivery_note|invoice], number, customer_id, parent_id?, status, subtotal, vat, total, due_date, created_at
document_lines    id, document_id, product_id?, description, qty, unit_price, vat_type, line_total
```

Customer credit balance and supplier balance are **derived** from sales/payments/purchases (use SQL views), not stored.

## 6. Explicitly NOT in the MVP (roadmap)
- **Phase 2:** Mobile money API collection via a Tanzanian aggregator (e.g., Selcom, AzamPay, ClickPesa — evaluate fees and onboarding), automatic payment matching, SMS receipts, multi-branch stock, barcode scanning with the camera.
- **Phase 3:** Payroll with Tanzanian deductions (PAYE, NSSF, SDL, WCF — rates must be configurable, verify current rates with TRA/NSSF before building), double-entry accounting & financial statements, TRA VFD/EFD fiscal receipts through an approved VFD provider.
- **Later:** Native Android wrapper, USSD for feature phones, supplier ordering, loyalty, credit scoring partnerships with lenders/SACCOs.

## 7. MVP success metrics
- New genge user records first sale in **< 2 minutes** from sign-up.
- Median sale recorded in **< 5 seconds**.
- ≥ 60% of week-1 users still recording sales in week 4.
- Zero lost offline sales in field testing.

## 8. Field testing plan
Before building Phase 2, put the app on the phones of ~10 real users (4 genges, 4 dukas, 2 small formal businesses) in Dar es Salaam for two weeks. Sit with them for the first session and watch without helping. Every point where they hesitate is a design bug.
