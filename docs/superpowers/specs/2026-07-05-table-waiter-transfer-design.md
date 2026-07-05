# Design Spec: Table & Waiter Transfer (Tier 1.1 + 1.2)

**Status:** Approved (brainstorming complete)
**Date:** 2026-07-05
**Roadmap source:** `docs/fnb-competitive-gap-analysis.md`, Tier 1 items 1 and 2.

## Executive Summary

Adds the ability to move an open dine-in order to a different table (optionally merging it into another table's existing open order to combine bills) and to reassign which staff member owns an order — both confirmed gaps against Omega and/or standard Lebanese F&B POS baseline, and both explicitly named by the user as example missing features at the start of this initiative. No new tables. One new Postgres RPC plus a direct column update, one new shared React modal component, wired into both `TableManagement.tsx` (floor plan) and `WaiterInterface.tsx` (waiter's active-order screen).

## Scope

**In scope:**
- Move an open order to a different, currently-available table (simple move).
- Move an open order onto a table that already has its own open order, combining both into a single bill (merge).
- Reassign the waiter on an order, independent of any table move.
- Entry points on both `TableManagement.tsx` and `WaiterInterface.tsx`.
- Any staff role except `viewer` can perform either action.

**Explicitly out of scope (known limitations, not defects):**
- `restaurant_pending_orders` (unconfirmed QR-menu orders awaiting waiter confirmation) are not repointed during a transfer. A customer submitting a QR order in the exact moment staff transfers the table is an accepted rare edge case, not handled.
- `sales.table_order_id` and `restaurant_delivery_orders.table_order_id` are untouched by design — both are only populated once an order is closed/settled, and transfer only ever operates on open orders, so neither reference can exist on a transferable order.
- Splitting one table's order into two (the inverse of merge) is a separate feature (Tier 2 "table merge/split" already covers general split/merge UX beyond this transfer-triggered case) — not built here.

## Data Model

No new tables. Two additions to the existing `table_orders` table (migration required, see Implementation Notes):

- New valid value for the existing `status` column (currently an unconstrained `text` column, no CHECK constraint exists — confirmed via `supabase/migrations/20260620_000031_restaurant_schema.sql`): `'merged'`, alongside the existing `'open'|'sent'|'served'|'paid'|'cancelled'`.
- New nullable column: `merged_into_order_id UUID REFERENCES table_orders(id)` — audit trail pointing from a merged-away order to the order its items were folded into. The merged-away row is never deleted, only closed out and marked, consistent with this schema's existing soft-status conventions (e.g. `'cancelled'`, `'paid'`).

## Backend

### `fn_transfer_table_order(p_order_id uuid, p_target_table_id uuid, p_new_waiter_id uuid default null)`

`SECURITY DEFINER`, `set search_path = public` — matches the existing `fn_close_restaurant_bill` pattern (`supabase/migrations/20260623_000045_fn_close_bill_patch.sql`). All logic runs as one Postgres transaction (atomicity by construction — no partial-failure window, matching the lesson from the Tier 0 whole-branch review's atomic-cache-refresh-RPC fix).

Logic:
1. Validate `p_order_id` refers to an order with `status IN ('open', 'sent', 'served')` for the calling tenant; raise a clear exception otherwise (covers: already paid, already cancelled, already merged, wrong tenant).
2. Validate `p_target_table_id` exists for the calling tenant; raise a clear exception otherwise.
3. Look up whether the target table currently has its own open order (`status IN ('open', 'sent', 'served')`).
   - **No open order at target (simple move):** `UPDATE table_orders SET table_id = p_target_table_id WHERE id = p_order_id`. Source table → `'available'`. Target table → `'occupied'`.
   - **Open order exists at target (merge):**
     - Repoint `restaurant_order_items.order_id` from the source order to the target order (all rows — no filtering, `order_id` is `NOT NULL` so every item belongs to exactly one order).
     - Repoint `restaurant_argile_sessions.table_order_id` from the source order to the target order, filtered to `status = 'active'` only (closed sessions are historical and stay pointed at the original order).
     - Mark the source order: `status = 'merged'`, `merged_into_order_id = <target order id>`, `closed_at = now()`.
     - Source table → `'available'`. Target table's status is unchanged (already `'occupied'`).
4. If `p_new_waiter_id` is provided (non-null), apply it to whichever order now represents the party — the target order in a merge case, the moved order otherwise.
5. Insert one `activity_log` row describing the action (move or merge, source/target table numbers, order id(s)) — matches this codebase's existing tenant-scoped audit-trail convention.

Concurrency: two staff attempting to transfer the same order simultaneously are serialized by Postgres row-level locking within the transaction — the second call simply observes the already-updated state and fails step 1's status check with a clear error, not a race condition.

### Waiter-only reassignment (no table change)

No RPC. A direct `supabase.from('table_orders').update({ waiter_id }).eq('id', orderId)` — a single-column, single-row update has no cascading effects, so it doesn't need transactional wrapping. Also writes one `activity_log` row.

## Frontend

New shared component: `src/components/restaurant/TableTransferModal.tsx`, used from both `TableManagement.tsx` and `WaiterInterface.tsx`.

- Opens from a new "Transfer" action on an occupied table's card (`TableManagement.tsx`) or the active-order screen (`WaiterInterface.tsx`).
- Target-table picker: lists all other tables for the tenant, with occupied tables visually flagged as "will merge orders."
- Optional waiter-reassignment dropdown (employee list), defaulting to the order's current waiter; can be changed independent of any table move, or left unchanged.
- **Simple move**: normal confirm button, calls `fn_transfer_table_order` via `supabase.rpc(...)`.
- **Merge case**: requires an explicit second confirmation step before submitting — "This will combine N items from Table X into Table Y's bill and cannot be undone," given it's an irreversible, money-adjacent action. N is the source order's current item count, fetched client-side before showing the warning.
- **Waiter-only** (target table left as current table): skips the RPC, uses the direct update instead.
- Toast (via existing `sonner` usage) on success or error.
- On success, triggers the host screen's existing `loadData()` reload — no new realtime subscription; both `TableManagement.tsx` and `WaiterInterface.tsx` already follow a fetch-once-then-refetch-after-mutation pattern (e.g. `TableManagement.tsx:277`), and this feature follows the same convention rather than introducing new infrastructure.

## Error Handling & Edge Cases

| Case | Handling |
|---|---|
| Target table = source table | Blocked client-side before calling the RPC (no-op) |
| Source order not open (paid/cancelled/merged) | RPC raises a clear exception → toast error |
| Target table not found / wrong tenant | RPC raises a clear exception → toast error |
| Concurrent transfer attempts on the same order | Serialized by Postgres row locking; second caller sees updated state, fails the status check cleanly |
| Active argile sessions at time of merge | Repointed to the target order; closed sessions untouched |
| Unconfirmed QR order mid-transfer | Not handled — documented known limitation, not fixed here |

## Testing

- Unit tests (Vitest) for `TableTransferModal`: renders the target-table picker; shows the merge warning only when the target table is occupied; calls the RPC with correct arguments for a move vs. a merge; calls the direct update (not the RPC) for a waiter-only change; handles and surfaces error states from both paths.
- The new RPC itself is smoke-tested manually via the Supabase SQL Editor (same convention already used for `fn_close_restaurant_bill`) rather than covered by an automated migration test — this repo has no existing automated test harness for SQL functions.

## Implementation Notes

- New migration file (numbered after the last one on `main`, `20260705_000053_atomic_cache_refresh_rpcs.sql` → next is `000054`): adds the `merged_into_order_id` column and the `fn_transfer_table_order` RPC. Per this repo's convention, migrations are delivered as files and applied manually via the Supabase Dashboard SQL Editor unless a specific step is explicitly authorized to apply directly (this migration is purely additive — a new nullable column and a new function — expected to be a normal file-delivery migration, not one requiring a live-apply exception).
- No changes needed to `restaurant_order_items`, `restaurant_argile_sessions`, or any other existing table's schema — only reads/writes through the new RPC.
