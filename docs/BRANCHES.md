# Branches — design (draft, on the `branches` git branch)

For shops with more than one location (first case: Niffer Cosmetics, Sinza and Dodoma). One business, one owner, one product list; stock, sales, cash and stock checks belong to a branch.

## What belongs to a branch, and what is shared

| Shared by the whole business | Belongs to one branch |
|---|---|
| Products, bulk sizes, categories | Stock (the movement ledger) |
| Customers (and their credit) | Sales, sale lines, their payments |
| Suppliers | Expenses, purchases, losses |
| Settings, colour, payment methods | Day closing (one per branch per day) |
| Staff list | Stock checks |
| | Invoices / proformas (issued from a branch) |

Stock is still never stored: on-hand is the ledger filtered by branch. A business with one branch behaves exactly as today.

## Data

- New table `branches`: `id, business_id, name, location, phone, active`, soft-deleted like everything else.
- `branch_id` on `stock_movements, sales, payments, expenses, purchases, waste_events, day_closings, stock_counts, documents`.
- Migration creates one branch per existing business (named after the business) and fills `branch_id` on every existing row, then makes it `NOT NULL`. Phones that haven't updated yet keep working: the server fills a missing `branch_id` with the business's first branch.
- `members.branch_id`: empty = all branches (owners, area managers); set = that branch only.
- Moving stock between branches: a pair of movements (`transfer_out` at one, `transfer_in` at the other) sharing a `ref_id`, so the ledger still sums correctly and the move is visible on both sides.

## Rules (RLS)

- Everyone in the business can read shared tables, as today.
- A member tied to a branch can only **write** rows for that branch; owners and all-branch managers write anywhere.
- Whether a branch member can **read** other branches' sales and stock is an open question (below).

## On the phone

- The phone remembers its **current branch**. Staff tied to a branch never see a switch; owners get a branch picker in the till header.
- Till, stock, stock check and day closing work on the current branch.
- Reports (Hesabu, Faida, stock checks, sales by staff) get a branch filter: one branch or all branches combined.
- Receipts show the branch's location and phone.
- `/admin`: create a shop with one or more branches; add a branch later.

## Open questions

1. **Prices:** the same in every branch, or can a branch set its own (e.g. Dodoma higher for transport)?
2. **Staff:** is each assistant tied to one branch, or do some move between them?
3. **Moving stock:** do branches send stock to each other (needs the transfer screen), or does each buy its own?
4. **Visibility:** should a branch's staff see the other branch's sales and stock, or only their own?

## Build order

1. `branches` table, `branch_id` columns, backfill migration, RLS + tests.
2. Current branch on the phone; till, stock, day closing per branch.
3. Branch filter on reports; branch on receipts.
4. Admin: branches per shop; staff tied to a branch.
5. Transfers and per-branch prices, if wanted (questions 1 and 3).
