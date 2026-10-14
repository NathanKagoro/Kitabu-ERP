# Deploying Kitabu

Kitabu is **plain files plus Supabase**. The app builds to a folder of static files (`out/`) that any static host serves: GitHub Pages (set up in this repo), Netlify, Cloudflare Pages. Nothing runs on the host. Supabase holds the database, the logins, and one small function that creates accounts.

There is no SMS provider. Shops get a **setup code** from you, sign in with their phone number and that code, and choose their own password.

Plan on about 45 minutes the first time.

---

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com). Pick the region closest to Dar es Salaam that is offered to you, and save the database password.
2. **Project Settings → API**: copy the **Project URL**, the **anon public** key, and the **service_role** key.
   - The URL and anon key are safe to publish; Row Level Security is what protects the data.
   - The **service_role key is a master key.** It only ever goes in `.env.local` on your own computer. Never in GitHub, never in the app.
3. **Project Settings → Database → Connection string**: copy the **Session pooler** URI with your password in it. This is `DATABASE_URL` (also only on your computer).

## 2. Sign-in settings

In **Authentication → Sign In / Providers**:

1. **Allow new users to sign up: off.** Nobody can create a login from the app; only your account function can.
2. **Email** provider: **on**, with **Confirm email: off**. Kitabu turns each phone number into a fixed login address (`255712345678@phone.kitabu.app`) that is never sent mail.
3. Phone provider: leave off. No SMS is used.

In **Authentication → URL Configuration**, set the **Site URL** to where the app lives (for example `https://nathankagoro.github.io/Kitabu-ERP/`).

## 3. Create the database

On your computer, in the repo:

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#         DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run db:migrate
```

This applies `db/migrations/` in order: tables, the security policies, product bulk sizes, shop settings, and the accounts rules. Run it again after any future migration; applied ones are skipped.

## 4. The accounts function

Creating a login needs the service-role key, so it happens inside Supabase, in `supabase/functions/accounts`. Supabase gives the function its URL and service key automatically; there is nothing to configure.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>     # the id in your project's URL
npx supabase functions deploy accounts
```

## 5. Your operator login

```bash
npm run operator -- 0712345678 'a-long-password-of-yours'
```

That makes your phone number the **operator**: the login that creates shops. Sign in to the app with it and open **/admin** (also under **Zaidi** if you own a shop yourself).

## 6. GitHub Pages

The workflow in `.github/workflows/pages.yml` checks, builds and publishes on every push to `main`.

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables** (variables, not secrets: these are all public):

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_ANON_KEY` | the anon public key |
   | `SUPPORT_WHATSAPP` | your number for the "contact us" buttons |

3. Run the workflow (push, or **Actions → Deploy to GitHub Pages → Run workflow**).

With the two Supabase variables unset, the published site is the **demo**: every visitor's data stays in their own browser, and sign-in takes any phone number with the setup code **KTAB-2468**. Safe to hand round; not for real shops.

Other hosts work the same way: build with the same `NEXT_PUBLIC_*` variables and serve `out/`. `netlify.toml` does this for Netlify.

## 7. Setting up a shop

1. **/admin → Duka jipya**: shop name, type (cosmetics, clothes, hardware…), the owner's phone, colour.
2. You get a **setup code** (e.g. `MK7P-34RT`). Send it with the WhatsApp button, or read it out.
3. The owner opens the app, signs in with their phone and the code, chooses a password and a 4-digit PIN.
4. A new shop starts on **bulk entry**: count a shelf, type it in, or paste a list from Excel. The quantities become the opening stock.
5. **Zaidi → Mipangilio**: payment methods and Lipa Namba numbers, which parts of the app are on, receipt details.

Later:
- **Forgotten password**: /admin → *Namba mpya ya mwenye duka* gives a fresh code. Owners do the same for their own staff under **Wafanyakazi**.
- **Unpaid month**: /admin → *Simamisha* pauses the shop. Their records stay; the till shows "contact us" until you press *Rudisha*.

## 8. Check the live deployment

On a real Android phone with Chrome:

- [ ] Create a test shop in /admin; sign in on the phone with the code; choose a password and PIN.
- [ ] Bulk entry: two shades of one product with quantities; they appear on the till with stock.
- [ ] **Add to Home screen** is offered, and the installed app opens full-screen.
- [ ] Airplane mode on: record 3 sales, close and reopen the app. The sales are there and the header shows pending.
- [ ] Airplane mode off: within a minute the header shows ✓ and the rows appear in the Supabase `sales` table.
- [ ] Send a WhatsApp receipt and open it on a *different* phone: shop colour, address, Lipa Namba.
- [ ] Add a cashier under Wafanyakazi: they sign in with their code, see only that shop, and have no profit line.
- [ ] Pause the shop in /admin: the phone shows the paused screen on its next sync.

## Updating

- **Code**: push to `main`; the workflow publishes it. Phones get the new version the next time the app opens online.
- **Schema**: add a migration (`npm run db:generate`, or `npx drizzle-kit generate --custom --name=…` for hand-written SQL such as policies), commit it, and run `npm run db:migrate` against production **before** pushing code that depends on it.
- **The function**: `npx supabase functions deploy accounts` after changing anything in `supabase/functions/`.
- **A new table** needs its RLS policies in the same migration, and a test in `tests/db/rls.test.ts`.
