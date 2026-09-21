# CLAUDE.md — Project context for Claude Code

> Working name: **Hesabu** (placeholder — rename freely). Replace `Hesabu` across the repo once a final name is chosen.

## What we are building
A simple, mobile-first business app for Tanzanian small businesses. It must work equally well for:
- **Genge / kibanda / duka mode** — a single owner selling vegetables, fruit, charcoal, airtime, household goods from a stall or kiosk, using a cheap Android phone, often with weak internet, often in Swahili.
- **Biashara mode** — a small formal business (wholesaler, hardware store, pharmacy, service company) with a few staff, suppliers, invoices and TRA obligations.

Both modes are the **same app**. The business type chosen at onboarding decides which features are visible. Genge mode hides everything that isn't essential. Features are revealed progressively, never forced.

Full product spec: `docs/MVP_SPEC.md`. Build order: `docs/BUILD_PLAN.md`. Read both before starting a phase.

## Non-negotiable product principles
1. **Swahili first.** Every user-facing string goes through i18n (`sw` default, `en` secondary). Never hard-code UI text. Write Swahili that a market trader would actually say, not formal translated Swahili.
2. **Three taps to a sale.** Recording a sale in genge mode must take ≤3 taps from the home screen.
3. **Works offline.** Sales, expenses and credit entries must save while offline and sync later. Never lose a sale.
4. **Cheap phones, expensive data.** Target a 2 GB RAM Android phone on 3G. Keep JS bundles small, avoid heavy libraries, compress images, no autoplaying anything.
5. **Big, obvious UI.** Minimum tap target 48px, base font 16px+, icons next to labels, high contrast, no hidden gestures.
6. **Plain language, not accounting language.** "Pesa iliyoingia", "Deni", "Faida ya leo" — not "Accounts receivable" or "Journal entry". Accounting rigor lives in the data model, not the UI.

## Tech stack
- **Next.js (App Router) + TypeScript (strict)** — one codebase for UI and server logic.
- **Supabase** — Postgres, Auth (phone OTP), Storage. Use Row Level Security for multi-tenancy.
- **Drizzle ORM** for schema and migrations (`/db/schema.ts`, `/db/migrations`).
- **Tailwind CSS + shadcn/ui** for components.
- **next-intl** for i18n (`/messages/sw.json`, `/messages/en.json`).
- **Dexie (IndexedDB)** for the offline store and outbox queue.
- **PWA** via `@serwist/next` (installable, offline shell).
- **Zod** for validation shared between client and server.
- **Vitest** for unit tests, **Playwright** for key end-to-end flows.
- Hosting: **Vercel** (app) + **Supabase** (db). Keep everything deployable with zero custom servers.

Do not add new major dependencies without noting why in the PR/commit message.

## Code conventions
- Money is stored as **integer TZS** (`bigint`), never floats. Format with a single helper `formatTZS()`.
- Quantities are `numeric(12,3)` (supports kg, litres, pieces).
- Every tenant-owned table has `business_id uuid not null` and an RLS policy restricting access to members of that business.
- Every record created offline has a client-generated `id` (UUID v7) so sync is idempotent.
- Soft delete with `deleted_at`; never hard-delete financial records.
- Server mutations live in `/server/actions/*` as typed server actions; validate input with Zod.
- Feature folders: `/app/(app)/[feature]`, `/components/[feature]`, `/lib/[feature]`.
- Keep components small; prefer server components, client components only where interaction needs them.
- Write a unit test for every money or stock calculation.

## Definition of done (every phase)
- Works in Swahili and English with no missing keys (`npm run i18n:check`).
- Usable on a 360px-wide screen.
- Offline behaviour tested for any sales/expense/credit flow touched.
- RLS policies exist and are tested for any new table.
- `npm run lint`, `npm run typecheck`, `npm test` all pass.
- Update `docs/CHANGELOG.md` with what was built.
