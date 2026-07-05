# Design Spec: Delivery Order Intake (Tier 1.4)

**Status:** Approved (brainstorming complete)
**Date:** 2026-07-06
**Roadmap source:** `docs/fnb-competitive-gap-analysis.md`, Tier 1 item 4 ("Real delivery aggregator integration").

## Executive Summary

Completes the delivery-aggregator integration that Tier 0 restored the webhook receiver for. Two real, previously-undiscovered gaps made the existing pipeline non-functional end-to-end: (1) the webhook's `inject_delivery_order` RPC creates a kitchen-visible `table_orders` shell but never inserts the actual `restaurant_order_items` rows, so kitchen staff would see an order card with zero items to prepare; (2) `restaurant_delivery_orders` — the table every inbound order lands in — is never read by any frontend code, so there is no way for staff to see, accept/reject, or progress an incoming delivery order, and no way for a delivery order to ever be "completed" (it stays open forever with no revenue recorded).

This spec also makes a deliberate behavior change, approved during brainstorming: today, the kitchen-visible shell is created immediately on webhook receipt regardless of whether the integration is set to auto-accept. This spec gates shell/item creation on acceptance (automatic for `auto_accept=true` tenants, manual via a new UI otherwise) — kitchen staff should never see an order as active before someone (human or the auto-accept setting) has actually committed to fulfilling it.

## Scope

**In scope:**
- Fix the missing `restaurant_order_items` creation so accepted delivery orders are fully visible (with actual items) in the existing kitchen display.
- Gate kitchen visibility on acceptance, not webhook receipt.
- A new "Delivery Orders" queue page: accept/reject new orders, progress accepted orders through `preparing → ready → picked_up`.
- Full completion: marking an order picked up creates a `sales` record (new `source='delivery'` value) and closes the linked `table_orders` shell, so delivery becomes a real, revenue-tracked channel rather than a dead end.
- Updating the already-deployed `delivery-webhook` edge function (Tier 0) to call the new acceptance RPC automatically for `auto_accept=true` integrations.

**Explicitly out of scope (stated boundary, not a defect):**
- No outbound API integration with Toters/Talabat/Zomato/Careem Food. This feature is an inbound webhook receiver plus internal order management — rejecting an order here does NOT notify the platform. A rejected order still needs to be handled with the platform through their own channels (driver app, support line). No such outbound integration exists in this codebase or is being built here.
- No cancellation path for an already-accepted order (only `status='new'` orders can be rejected). If a tenant needs to cancel after accepting, that's a known limitation for a future pass.
- No history/archive view for `picked_up`/`cancelled` orders — they simply drop off the active queue. A history view is a reasonable future addition.
- `restaurant_branch_metrics.delivery_revenue_usd` remains unpopulated scaffolding — this spec makes delivery revenue *recordable* (via `sales.source='delivery'`), not automatically rolled up into that specific cache column, which nothing in this codebase currently refreshes for any source.

## Data Model

No new tables.

- `sales.source` CHECK constraint (`supabase/migrations/20260621_000040_restaurant_bridge.sql`, currently `IN ('pos', 'restaurant')`) extended to also allow `'delivery'`.
- `restaurant_delivery_orders` and `restaurant_delivery_orders.table_order_id` (both already exist, migration `20260621_000039_restaurant_multi_branch.sql`) — no schema change, just newly consumed by the frontend and by the acceptance/completion RPCs below.
- Behavior change (not a schema change): `table_orders` + `restaurant_order_items` rows for a delivery order are now created at **acceptance** time, not at webhook-receipt time.

## Backend

### `inject_delivery_order` (existing RPC, simplified)

Currently creates both the `restaurant_delivery_orders` row AND a `table_orders` shell. Simplified to only do the former — insert `restaurant_delivery_orders` (`status='new'`, existing `ON CONFLICT (tenant_id, platform, external_order_id) DO NOTHING` dedup unchanged). Returns the new delivery order's id (or `NULL` on duplicate, unchanged contract).

### `accept_delivery_order(p_delivery_order_id uuid) returns uuid`

New RPC, `SECURITY DEFINER`, `set search_path = public`, tenant-checked from the start (`IF v_tenant_id <> current_tenant_id() THEN RAISE EXCEPTION 'permission_denied'`) — this check is written in from the first draft, not added after a review catches its absence, per the lesson from the table-transfer feature's first RPC.

1. Locks and validates the delivery order (`FOR UPDATE`): must exist, belong to the caller's tenant, and have `status='new'`. Raises a clear exception otherwise (covers double-accept, accept-after-reject, cross-tenant).
2. Creates the `table_orders` shell: `status='open'`, `notes='DELIVERY: ' || platform || ' #' || external_order_id`, no `table_id` (unchanged shape from today's `inject_delivery_order`, just moved here).
3. Inserts `restaurant_order_items` rows from the delivery order's stored `items` JSONB (`name`, `quantity`, `unit_price`, `modifiers`) — the actual fix for the "kitchen sees zero items" bug. Items are guaranteed non-empty by the webhook's existing validation before `inject_delivery_order` is ever called.
4. Updates the delivery order: `status='accepted'`, `accepted_at=now()`, `table_order_id=<new shell id>`.
5. Returns the new `table_orders` id.

### `reject_delivery_order(p_delivery_order_id uuid) returns void`

New RPC, same `SECURITY DEFINER`/tenant-check pattern. Locks and validates `status='new'` (raises otherwise — this is the only valid transition, per the explicit out-of-scope decision above). Sets `status='cancelled'`. No `table_orders` shell exists yet for a `'new'` order, so nothing else to clean up.

### `complete_delivery_order(p_delivery_order_id uuid) returns uuid`

New RPC, same pattern. Locks and validates `status='ready'` (raises otherwise). Sets `status='picked_up'`. Sets the linked `table_orders.status='paid'`. Calls `finalize_restaurant_order(table_order_id, p_source => 'delivery')` (see below) and returns the resulting sale id.

### `finalize_restaurant_order` (existing RPC, parameterized)

Currently hardcodes `sales.source = 'restaurant'` (`supabase/migrations/20260621_000041_restaurant_views.sql`). Adds a new parameter `p_source text default 'restaurant'`, used in the `INSERT INTO sales (...)` in place of the hardcoded literal. Existing callers (dine-in bill closing) are unaffected since the default preserves current behavior exactly.

### `delivery-webhook` edge function (already deployed, Tier 0)

Currently calls `inject_delivery_order`, then — only if `auto_accept` — does a raw `.update({status:'accepted', accepted_at})` directly against `restaurant_delivery_orders` (which, under the old design, never created the shell either way). Updated to: call `inject_delivery_order` as before, then if `auto_accept` and injection didn't return a duplicate, call the new `accept_delivery_order` RPC (replacing the raw `.update()`). This is a live, already-deployed function — redeploying it requires explicit confirmation before applying, same as other live deploys this session.

## Frontend

New page `src/pages/restaurant/DeliveryOrders.tsx`, sibling to the existing `src/pages/restaurant/DeliveryIntegrations.tsx` (settings), with a new nav entry alongside it.

Kanban-style board by `restaurant_delivery_orders.status`:
- **New** → `[Accept]` (calls `accept_delivery_order`) `[Reject]` (calls `reject_delivery_order`)
- **Accepted** → `[Start Prep]` (direct `.update({status:'preparing'})` — no RPC needed, single-column change with no cascading effects, matching this codebase's established convention of reserving RPCs for multi-table/atomic operations)
- **Preparing** → `[Mark Ready]` (direct `.update({status:'ready'})`)
- **Ready** → `[Mark Picked Up]` (calls `complete_delivery_order`)

Each card shows: platform badge (reusing `DeliveryIntegrations.tsx`'s existing platform metadata/colors), external order id, customer name/phone/delivery address, item list, and total. `picked_up`/`cancelled` orders drop off the active board once transitioned (no history view built here).

Polls every 30 seconds (matching `WaiterInterface.tsx`'s existing convention) rather than fetch-once-on-mount (`TableManagement.tsx`'s convention) — chosen because delivery orders are externally triggered by webhook traffic at any time, unlike table state which only changes from in-app actions.

RBAC: `RoleGate action="make_sales"`, reusing the same existing legacy-role action as the table-transfer feature (any staff except viewer).

## Error Handling & Edge Cases

| Case | Handling |
|---|---|
| Accept/reject called twice (double-click, or two staff) | Each RPC locks the delivery order row (`FOR UPDATE`) and re-checks `status='new'` before acting — the second caller gets a clear exception, not a silent double-action |
| Reject attempted on an already-accepted order | Blocked — `reject_delivery_order` only operates on `status='new'` |
| Complete attempted when status isn't `'ready'` | Blocked with a clear exception |
| Malformed/empty items in the stored JSONB | Cannot happen — `delivery-webhook` already validates a non-empty items array before ever calling `inject_delivery_order` |
| Cross-tenant access | All three new RPCs include the `current_tenant_id()` tenant check from the first draft |

## Testing

- Unit tests (Vitest) for `DeliveryOrders.tsx`: renders orders grouped into the correct status columns; each action button calls the correct RPC/update with the correct delivery-order id; error states from any call surface as toasts, not silent failures.
- The four RPCs (`inject_delivery_order` simplified, `accept_delivery_order`, `reject_delivery_order`, `complete_delivery_order`) and the `finalize_restaurant_order` parameterization are smoke-tested manually via the Supabase SQL Editor — this repo has no automated test harness for SQL functions (established convention).
- The updated `delivery-webhook` edge function is smoke-tested with the same manual curl pattern used when it was originally restored in Tier 0.

## Implementation Notes

- New migration file (numbered after the last one on `main`, `20260706_000054_table_waiter_transfer.sql` → next is `000055`): simplifies `inject_delivery_order`, adds the three new RPCs, parameterizes `finalize_restaurant_order`, and extends `sales.source`'s CHECK constraint. Per this repo's convention, delivered as a file and applied manually unless a specific step is explicitly authorized to apply directly.
- Redeploying `delivery-webhook` (to pick up the `accept_delivery_order` call for auto-accept tenants) requires explicit human confirmation before applying, consistent with how live deploys have been handled throughout this project's agentic sessions.
