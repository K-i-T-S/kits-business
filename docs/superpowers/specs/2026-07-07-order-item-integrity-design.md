# Design Spec: Order Item Integrity — Recipe Deduction, menu_item_id Completeness, QR Order Flow & RLS Fix

**Status:** Approved (brainstorming complete)
**Date:** 2026-07-07
**Origin:** Discovered while scoping a small fix to wire recipe-ingredient deduction into `KitchenDisplay.tsx` ahead of the "preset order bundles" (Tier 2.1) feature, which depends on component-level stock deduction working correctly. A full audit of every `restaurant_order_items`-creation site, requested by the project owner, surfaced two further defects: two of seven creation sites never populate `menu_item_id` (silently breaking deduction and item-level analytics for those paths), and — far more seriously — the entire customer-facing QR self-ordering feature (`QRCart.tsx`) is confirmed broken for real anonymous customers due to a missing RLS policy, empirically verified against a scratch Postgres 16 replica of the live schema.

## Executive Summary

Five defects, one root cause per cluster, fixed together because they're causally linked:

1. **Recipe deduction is fully built but never wired.** `useRecipeDeduction()`'s `deductForMenuItem` exists, `deduct_recipe_ingredients` RPC exists, but `KitchenDisplay.tsx` never calls it — ingredient stock never decrements when a dish is cooked, for any order, from any source.
2. **Two order-item creation sites never set `menu_item_id`.** `useRestaurantOrder.ts`'s `confirmPendingOrder` and `QRCart.tsx`'s direct insert both omit it — even after (1) is fixed, items created through these paths would silently skip deduction (the RPC no-ops on a NULL `menu_item_id`) and undercount in item-level analytics.
3. **`QRCart.tsx` ignores the tenant's "Order Flow" setting.** `RestaurantSettings.tsx` has a complete, working toggle ("Waiter Confirms" vs. "Direct to Kitchen"), saved to `restaurant_settings.default_order_flow` and read when `WaiterInterface.tsx` creates a table order — but `QRCart.tsx` always does a direct insert regardless of what a tenant configured.
4. **QR self-ordering is confirmed broken for anonymous customers.** Empirically verified (scratch Postgres 16, exact schema + RLS replica, 4 tests): anonymous `SELECT`/`INSERT` on `table_orders` and `restaurant_order_items` are rejected by RLS (no public policy exists on either table, unlike `restaurant_menu_items`/`restaurant_pending_orders`/`restaurant_table_feedback`/`restaurant_argile_events`, which all have one). A control test confirms the same operations succeed fine when authenticated as staff — explaining how this went undetected (anyone testing while logged in as staff would see it work).
5. **Silent customer-facing failure.** `QRCart.tsx`'s `handlePlaceOrder` catch block only does `console.error` — a real customer hitting the RLS failure above sees a spinner, then nothing. No error, no confirmation.

The fix: replace `QRCart.tsx`'s direct table writes with one new `SECURITY DEFINER` RPC (`qr_place_order`, matching the codebase's existing `get_public_menu` anonymous-access pattern rather than opening broad public table policies), which resolves tenant/order/flow server-side, fixes `menu_item_id` at the source, revalidates prices and modifiers server-side (closing a price-tampering vector that would otherwise become newly exploitable the moment anonymous writes start working), branches on `order_flow`, and gives the frontend a real error path. Plus the small, separate KDS wiring fix and the one-line `menu_item_id` fix in `useRestaurantOrder.ts`.

## Scope

**In scope:**
- Wire `useRecipeDeduction` into `KitchenDisplay.tsx`'s three ready-transition handlers (`handleBumpItem`, `handleBumpAll`, `handleMarkAllReady`), with a double-deduction guard on `handleBumpItem` (the only one of the three with no existing status guard).
- Fix `useRestaurantOrder.ts`'s `confirmPendingOrder` to set `menu_item_id`.
- New RPC `qr_place_order(p_table_id uuid, p_items jsonb)` replacing `QRCart.tsx`'s direct `table_orders`/`restaurant_order_items` inserts.
- `QRCart.tsx` rewritten to call the RPC, with a real error toast on failure.
- `QROrderSuccess.tsx` gains a `mode` prop for differentiated confirmation copy.

**Explicitly out of scope (stated boundary, not a defect):**
- Ingredient deduction for Argile (shisha) sessions — `ArgileStation.tsx`'s charge line is a billing-only row (`menu_item_id` NULL by design), not a prepared dish; argile consumption is tracked separately via `restaurant_argile_sessions`/`argile_items`, untouched here.
- `TableManagement.tsx`'s `handleAddItem` (free-text manual item entry) — inherently has no `menu_item_id` since it's not a catalog item; no recipe exists to deduct. Not a gap, a limitation of manual entry.
- Fixing `WaiterInterface.tsx`'s own inline `handleConfirmPendingOrder` — already correctly sets `menu_item_id`; only its duplicate sibling in `useRestaurantOrder.ts` needs the fix. The fact that two separate implementations of "confirm a pending order" exist at all is a pre-existing duplication, noted but not consolidated here — consolidating them is a larger refactor than this fix warrants.
- `QRCart.tsx`'s hardcoded `course: 'mains'` for every item regardless of actual category — pre-existing simplification also present in `MenuManagement.tsx`'s own quick-order tool (`sendToKDS`); not related to deduction/RLS/pricing correctness, left as-is to avoid further scope growth.
- Adding public RLS policies directly on `table_orders`/`restaurant_order_items` — deliberately avoided in favor of the RPC approach (see Backend section) for a smaller, more auditable anonymous attack surface.

## Data Model

No new tables. One column reused (`table_orders.order_flow`, already exists, migration `20260621_000035`), no schema changes required — this is purely an RPC + frontend fix.

## Backend

### `qr_place_order(p_table_id uuid, p_items jsonb) returns jsonb`

New RPC, `SECURITY DEFINER`, `SET search_path = public`. Unlike every other `SECURITY DEFINER` RPC in this codebase (which check `tenant_id = current_tenant_id()` since they're called by authenticated staff), this one is called by anonymous customers — there is no `current_tenant_id()` to check. Tenant is instead derived server-side from `p_table_id` (never trusted from the client), mirroring `get_public_menu`'s existing `p_tenant_slug`-derivation pattern.

`p_items` shape (JSONB array), sent by the client per cart line:
```json
[{ "menu_item_id": "uuid", "quantity": 2, "modifier_ids": ["uuid", "uuid"], "notes": "no onions" }]
```
Note this is deliberately *thinner* than today's client-computed payload — no `name`, `unit_price`, or modifier `price_delta` is sent. The RPC resolves all of that server-side from `restaurant_menu_items`/`restaurant_modifiers`, closing the price-tampering vector and fixing the modifier-name/price-delta bug described in the Executive Summary.

Logic:
1. `SELECT tenant_id FROM restaurant_tables WHERE id = p_table_id` — if not found, raise `table_not_found`.
2. `SELECT id, order_flow FROM table_orders WHERE table_id = p_table_id AND status = 'open' LIMIT 1`.
3. If no open order: look up `restaurant_settings.default_order_flow` for the tenant (`COALESCE(..., 'waiter_confirm')`), create the `table_orders` shell (`status='open'`, `current_course='appetizers'`, `order_flow=<resolved>`), and use that as the resolved flow.
4. For each element of `p_items`: `SELECT name, base_price_usd FROM restaurant_menu_items WHERE id = (item->>'menu_item_id')::uuid AND tenant_id = v_tenant_id` — skip (do not insert) any item whose `menu_item_id` doesn't resolve to a real, active menu item for this tenant (defends against a forged/stale id). For each `modifier_id` in the item's `modifier_ids`, resolve `name`/`price_delta` from `restaurant_modifiers` the same way, building the `modifiers` JSONB array (`[{name, price_delta}]`) and summing `price_delta` into the line's effective unit price.
5. Branch on the resolved `order_flow`:
   - `'waiter_confirm'`: insert one row into `restaurant_pending_orders` (`tenant_id`, `table_id`, `table_order_id`, `items` = the resolved `PendingOrderItem[]` shape, `status='pending'`). Return `{"mode": "pending", "order_id": <table_order_id>}`.
   - `'direct'`: insert one `restaurant_order_items` row per resolved item (`menu_item_id` set, `product_name` = real name, `unit_price` = real base price + summed modifier deltas, `modifiers`, `course='mains'`, `status='pending'`, `notes`). Return `{"mode": "direct", "order_id": <table_order_id>}`.
6. If `p_items` resolves to zero valid items (every id was forged/stale), raise `no_valid_items` rather than silently creating an empty order.

### `deduct_recipe_ingredients` wiring (existing RPC, no changes — only new call sites)

`KitchenDisplay.tsx` imports `useRecipeDeduction()` and calls `deductForMenuItem(menu_item_id, quantity)` immediately after each successful DB update that transitions an item to `'ready'`, for every item whose `menu_item_id` is non-null:

- `handleBumpItem(itemId)`: look up the item's current `status`/`menu_item_id`/`quantity` from local `tickets` state *before* issuing the update (needed for both the deduction call and the new double-deduction guard). Only deduct if the item's prior status was `'pending'` or `'in_progress'` (not already `'ready'`/`'served'` — the missing guard this handler currently has, unlike its siblings).
- `handleBumpAll(orderId)`: already filters to `status IN ('pending', 'in_progress')` before updating — deduct for each item in that filtered list.
- `handleMarkAllReady(orderId)`: currently issues a blind `UPDATE ... WHERE status = 'in_progress'` with no local item lookup. Add a `tickets.find(...)` lookup (mirroring `handleBumpAll`'s existing pattern) to get the `in_progress` items' `menu_item_id`/`quantity` for deduction, after the successful update.

`handleBumpAllReady` (the separate `ready → served` transition) is **not** touched — deduction must fire exactly once, at the point food is physically prepared (`ready`), not when it's carried to the table (`served`).

### `useRestaurantOrder.ts`'s `confirmPendingOrder`

One-line fix: add `menu_item_id: item.menu_item_id` to the `inserts` map (line ~292-302), matching its correct sibling `WaiterInterface.tsx`'s inline `handleConfirmPendingOrder`.

## Frontend

### `QRCart.tsx`

`handlePlaceOrder` replaced: build the thin `p_items` payload from cart state (`menuItemId`, `quantity`, flattened `modifier_ids` from `selectedModifiers`, `notes`), call `supabase.rpc('qr_place_order', { p_table_id: tableId, p_items: payload })`. On error: `console.error` (existing) **plus** a new local `const [placeError, setPlaceError] = useState<string | null>(null)` state, rendered as a small inline banner above the "Place Order" button (not a full-page takeover — the cart must stay open so the customer can retry), styled with the same `--qr-*` CSS custom properties the rest of this file already uses (`--qr-border`, `--qr-text-muted`, `--qr-accent` for a warning-tinted variant). The QR customer-facing pages don't import `sonner` anywhere and shouldn't start here — this is a local, inline error state, not a toast. Cleared (`setPlaceError(null)`) at the start of each retry. On success: pass the RPC's returned `mode` through to `onSuccess`.

### `QROrderSuccess.tsx`

Add a `mode: 'direct' | 'pending'` prop. Confirmation copy differs:
- `direct`: existing copy ("Your order is on its way to the kitchen!" or equivalent existing text — unchanged).
- `pending`: new copy communicating the order is awaiting waiter confirmation (e.g., "Your order has been sent to your waiter for confirmation").

## Error Handling & Edge Cases

| Case | Handling |
|---|---|
| Forged/stale `menu_item_id` in `p_items` | RPC skips that line item silently (doesn't insert it), rather than failing the whole order or trusting client-supplied name/price for a nonexistent item |
| All items in `p_items` are forged/stale | RPC raises `no_valid_items` — surfaced to the customer as an error, not a silently-empty order |
| Table doesn't exist / wrong tenant reference | RPC raises `table_not_found` |
| Two customers at the same table place orders concurrently | Each call independently resolves-or-creates the open `table_orders` row; the second caller's `SELECT ... WHERE status = 'open'` will see the first caller's row once committed (no explicit locking needed — this is a low-frequency, low-stakes race compared to the seating/transfer RPCs' locking needs, since worst case is two near-simultaneous customers both create a table order and one becomes immediately stale; out of scope to harden further here) |
| Recipe deduction fails (bad recipe data, missing ingredient row) | Already non-blocking by the existing hook's design (`useRecipeDeduction` catches and only `console.warn`s) — KDS workflow must never be blocked by a deduction failure. Unchanged. |
| Double-click on KDS bump button | Guarded by the new pre-update status check in `handleBumpItem` — second click sees the item already `'ready'` and skips deduction (the underlying DB update is idempotent regardless) |

## Testing

- Unit tests (Vitest) for `KitchenDisplay.tsx`: `handleBumpItem` calls `deductForMenuItem` exactly once per item with correct `menu_item_id`/`quantity`, and does *not* call it a second time if invoked again on an already-`ready` item; `handleBumpAll`/`handleMarkAllReady` call it once per bumped item; items with `menu_item_id = null` never trigger a call.
- Unit tests for `QRCart.tsx`: `handlePlaceOrder` calls `supabase.rpc('qr_place_order', ...)` with the correct thin payload shape (no client-computed price/name); success passes `mode` through to `onSuccess`; error path shows a customer-visible error (not just `console.error`).
- The RPC itself is smoke-tested manually (Supabase SQL Editor) and empirically verified against a scratch Postgres 16 instance for both `order_flow` branches, the forged-`menu_item_id` skip behavior, and the anonymous-role RLS interaction (confirming the RPC succeeds where direct table access was proven to fail) — this repo has no automated SQL test harness (established convention).
- `useRestaurantOrder.ts`'s `confirmPendingOrder` fix is small enough not to need a new test beyond confirming existing tests (if any) still pass — check for an existing test file covering this hook first.

## Implementation Notes

- New migration file, numbered after the last one on `main` (`20260706_000056_waitlist_management.sql` → next is `000057`): adds `qr_place_order`. Delivered as a file, applied manually via Supabase Dashboard SQL Editor per convention.
- No new RLS policies, no `GRANT EXECUTE` needed (Postgres grants `EXECUTE` on new functions to `PUBLIC` by default in this project — confirmed by `get_public_menu`'s already-working anonymous access with no explicit grant in its migration).
- `QRCart.tsx`'s rewrite removes its two direct `.from('table_orders')`/`.from('restaurant_order_items')` calls entirely — the RPC is the only write path.
- No changes to `restaurant_pending_orders`'s existing RLS policy (`public_insert_pending_orders`) — it remains as a defense-in-depth backstop even though the RPC (running `SECURITY DEFINER`) doesn't strictly need it to succeed; not touching what isn't broken.
