# Deploying Hesabu

Production is two services: **Supabase** (Postgres, phone auth) and **Vercel** (the Next.js app). There are no custom servers. Plan on about an hour the first time, most of it on the SMS provider.

You need accounts on Supabase, Vercel and GitHub, plus an SMS provider that delivers to Tanzanian numbers (the spec suggests Beem Africa or Africa's Talking).

---

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com). Pick the region with the lowest latency from Dar es Salaam among those offered to you, and save the database password.
2. **Project Settings → API**: copy the **Project URL** and the **anon public** key. These are safe to expose to the browser, because RLS is what protects the data.
3. **Project Settings → Database → Connection string**: copy the **Session pooler** URI and put your password in it. This is `DATABASE_URL`. It is server-only, so never give it a `NEXT_PUBLIC_` name.

## 2. Create the schema

On your machine, in the repo:

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL
npm install
npm run db:migrate
```

This applies `db/migrations/` in order: the tables, then the RLS policies, views and functions. Run it again after any future migration; applied migrations are skipped.

Check it in the Supabase dashboard:
- **Table Editor**: 18 tables. Every one shows **RLS enabled**.
- **Database → Functions**: `public_receipt`, `claim_invites`, `is_member` and the other helpers are listed.

## 3. Phone sign-in (OTP)

1. **Authentication → Providers → Phone**: enable it.
2. Connect SMS delivery, using one of these:
   - **A built-in provider** (Twilio, Vonage, MessageBird and others) if it delivers reliably to Tanzanian networks.
   - **A Tanzanian provider** (Beem, Africa's Talking) through **Authentication → Hooks → Send SMS hook**. The hook receives the phone number and the OTP; your hook calls the provider's send-SMS API. A Supabase Edge Function is the usual place to host it. Follow the provider's API docs for the request format and sender ID, and check both before launch.
3. Send yourself a code to a Vodacom, Airtel, Yas (Tigo) and Halotel number. Delivery varies by network.

## 4. Vercel

1. Push the repo to GitHub. On [vercel.com](https://vercel.com), choose **Add New → Project** and import it. The framework is detected as Next.js.
2. Leave the build command as `npm run build`. It runs `next build --webpack`, which is required: the service worker plugin produces nothing under Turbopack, and without it the app won't open offline.
3. **Environment variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1 |
   | `NEXT_PUBLIC_DEV_OTP` | **leave unset in Production.** Set it to `1` only on a Preview deployment you want to demo without SMS. |
   | `NEXT_PUBLIC_SENTRY_LOADER_URL` | optional, see step 5 |

   `DATABASE_URL` is **not** needed on Vercel. The app never connects to Postgres directly; it goes through Supabase's API under RLS.

4. Deploy. Then go to **Supabase → Authentication → URL Configuration** and add your Vercel domain as the Site URL.

> **About `NEXT_PUBLIC_DEV_OTP`.** When it is on, the code `123456` signs someone into a *phone-only* identity if the real OTP fails. That identity has no Supabase session, so it can't read or write any server data (RLS sees no user). It still shouldn't be on in production, because a trader could end up keeping their records on one phone without realising they aren't syncing.

## 5. Error tracking (optional)

1. Create a free Sentry project (platform: Browser JavaScript).
2. **Project Settings → Client Keys (DSN) → Loader Script**: copy the script URL.
3. Set it as `NEXT_PUBLIC_SENTRY_LOADER_URL` on Vercel and redeploy.

The loader is about 1 KB and pulls in the Sentry SDK only when an error happens, so it costs users no data on a normal day.

## 6. Check the live deployment

On a real Android phone with Chrome:

- [ ] Sign in with an SMS code, onboard, and set a PIN.
- [ ] **Add to Home screen** is offered, and the installed app opens full-screen.
- [ ] Switch on airplane mode, record 3 sales, and close and reopen the app. The sales are still there and the header shows pending.
- [ ] Airplane mode off: within a minute the header shows ✓, and the rows appear in the Supabase `sales` table.
- [ ] Send a WhatsApp receipt, and open the link on a *different* phone. The receipt loads.
- [ ] Sign in on a second phone with a different number. It sees none of the first business's data.
- [ ] Invite a cashier by phone number. They sign in, see only that business, and have no void button and no profit line.

## The public demo (Netlify)

There is a demo at **https://hesabu-tz.netlify.app**, deployed from this repo to Netlify rather than Vercel, simply because that account already existed. Nothing in the app is host-specific; `netlify.toml` holds the whole configuration and `@netlify/plugin-nextjs` runs the Next.js server.

```bash
netlify deploy --build --prod     # from the repo root, once logged in
```

**The demo has no backend, and that is deliberate.** With no Supabase keys set:

- every visitor gets their own private copy of the data, stored in their own browser, so people can try it without seeing each other's sales;
- sign-in accepts **any Tanzanian mobile number with the code 123456**;
- nothing syncs anywhere, and clearing browser data clears the demo.

That makes it safe to hand round, but it is **not** a production deployment. For real users, follow the Supabase and Vercel steps above (or set the same environment variables on Netlify), and leave `NEXT_PUBLIC_DEV_OTP` unset so the fixed code cannot be used.

## Updating

- **Code**: merge to the production branch, and Vercel deploys it. Users get the new version the next time the app loads online, because the service worker activates it at once.
- **Schema**: add a migration with `npm run db:generate` (or `npx drizzle-kit generate --custom --name=…` for hand-written SQL such as new policies), commit it, and run `npm run db:migrate` against production **before** deploying code that depends on it.
- **A new table** needs its RLS policies in the same migration, and a test in `tests/db/rls.test.ts`.
