# Design Spec: Waitlist Management (Tier 1.3)

**Status:** Approved (brainstorming complete)
**Date:** 2026-07-06
**Roadmap source:** `docs/fnb-competitive-gap-analysis.md`, Tier 1 item 3 ("Waitlist management with guest notification").

## Executive Summary

Adds a walk-in waitlist queue — the last remaining Tier 1 gap, absent from this platform entirely today (confirmed zero existing scaffolding: no table, no page, no nav entry, no reference in any migration or component). Standard baseline feature in the category (Toast, Lightspeed) and expected by Lebanese diners at any table-service restaurant with a queue. Staff add walk-in parties at a host-stand screen, see the queue with elapsed wait time, notify a guest via a WhatsApp deep link when their table is ready, and seat them — seating ties directly into the existing table/floor-plan system so a table can never be double-assigned between a waitlist party and something else.

## Scope

**In scope:**
- Staff-entered walk-in queue: add party (name, phone, size, optional notes), view queue with elapsed wait time.
- Guest notification via a `wa.me` WhatsApp deep link — staff taps a pre-filled message and hits send, mirroring the exact pattern already used in `Reservations.tsx` (`buildWhatsAppLink`). No server-side WhatsApp Business API call, no new credentials.
- Seating a party: picks an available table, creates that table's open order, marks the table occupied, and closes out the waitlist entry — one atomic action.
- No-show / cancel handling.
- Nav entry in the existing "Front of House" group, alongside Reservations.

**Explicitly out of scope (stated boundary, not a defect):**
- No customer self-check-in (QR code / public link). Every other feature in this vertical so far is a staff-facing screen, not a customer-facing surface — this follows that pattern.
- No SMS notification — no SMS provider exists anywhere in this codebase; adding one is out of scope for a Tier 1 baseline feature.
- No automated server-side WhatsApp API push (the `whatsapp-receipt` edge function's pattern). That path requires `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID` and is Business-plan-gated; using it here would leave starter/growth tenants with no notification at all. The `wa.me` client-link pattern already used in `Reservations.tsx` works on every plan with zero setup.
- No wait-time *prediction* algorithm. The UI shows elapsed wait time (`now - created_at`), not an estimated/predicted wait — this codebase doesn't have the historical throughput data to back a real prediction, and a fake one would be worse than none.
- No linkage to the `reservations` (or `restaurant_reservations` — see Note below) table. Advance bookings and a walk-in queue are different concepts; kept fully separate, matching this schema's existing convention of one table per concern (e.g. `restaurant_delivery_orders` was kept separate from `table_orders` rather than overloaded).
- No history/archive view for `seated`/`no_show`/`cancelled` entries — they drop off the active queue, matching the same boundary already accepted for `DeliveryOrders.tsx`.

**Note — pre-existing, unrelated anomaly discovered during research (not touched by this spec):** `Reservations.tsx` queries `restaurant_reservations`, but the only migration in this repo (`20260620_000031_restaurant_schema.sql`) creates a table named `reservations` (no prefix) — and two other files (`RestaurantHub.tsx`, `BookReservation.tsx`) correctly query `reservations`. This looks like the live Supabase table was renamed by hand outside of any migration file, similar to a few other "applied directly" fixes already noted in this repo's migration history (see CLAUDE.md entries 50/52/53). This is unrelated to waitlist management and is not addressed here — flagged for awareness only.

## Data Model

New table, no changes to any existing table:

```sql
create table restaurant_waitlist (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  guest_name       text not null,
  guest_phone      text not null,
  party_size       integer not null default 2,
  status           text not null default 'waiting', -- 'waiting'|'notified'|'seated'|'no_show'|'cancelled'
  notes            text,
  table_id         uuid references restaurant_tables(id) on delete set null,  -- set once seated
  created_at       timestamptz not null default now(),
  notified_at      timestamptz,
  seated_at        timestamptz
);
```

RLS: standard `tenant_id = current_tenant_id()` policies for select/insert/update/delete, matching every other domain table in this schema (e.g. `restaurant_tables`, `table_orders`).

## Backend

### Direct client operations (no RPC — single-table, no cascading effects)

- **Add to waitlist**: `supabase.from('restaurant_waitlist').insert({ tenant_id, guest_name, guest_phone, party_size, notes })`.
- **Notify**: `.update({ status: 'notified', notified_at: now() })`, paired with opening a `wa.me` link client-side (adapted from `Reservations.tsx`'s `buildWhatsAppLink`: `"Hi {name}, your table for {party_size} is ready!"`).
- **No-show / Cancel**: `.update({ status: 'no_show' })` or `.update({ status: 'cancelled' })`.

### `fn_seat_waitlist_party(p_waitlist_id uuid, p_table_id uuid) returns uuid`

New RPC, `SECURITY DEFINER`, `set search_path = public`, tenant-checked immediately after resolving tenant_id and before any other logic — this ordering is written in from the first draft, per the IDOR lesson established earlier in this branch's history (table/waiter transfer feature's first RPC review, and re-verified in delivery intake's `accept_delivery_order`/`reject_delivery_order`).

1. Locks and validates the waitlist entry (`FOR UPDATE`): must exist, belong to the caller's tenant, and have `status IN ('waiting', 'notified')`. Raises a clear exception otherwise (covers: already seated, no-show, cancelled, cross-tenant).
2. Locks and validates the target table (`FOR UPDATE`): must exist, belong to the caller's tenant, and have `status = 'available'`. Raises a clear exception otherwise (covers: occupied/reserved/cleaning, cross-tenant, and the race where a table goes unavailable between page load and the seat click).
3. Creates the `table_orders` shell: `table_id = p_target_table_id`, `status='open'`, `notes='WAITLIST: ' || guest_name || ' (' || party_size || ')'`. Unlike the delivery-order shell (which has no physical table and leaves `table_id` null), a waitlist seating always assigns a real table — `table_id` must be set here.
4. Sets `restaurant_tables.status='occupied'` for the target table.
5. Updates the waitlist entry: `status='seated'`, `seated_at=now()`, `table_id=<target table id>`.
6. Inserts one `activity_log` row describing the action (matches this codebase's existing tenant-scoped audit-trail convention).
7. Returns the new `table_orders` id.

Concurrency: the `FOR UPDATE` locks on both the waitlist entry and the table serialize concurrent seat attempts — a second caller (different staff, or a double-click) observes the already-updated state and fails a validation check cleanly, not a race condition.

## Frontend

New page `src/pages/restaurant/Waitlist.tsx`, sibling to `src/pages/restaurant/Reservations.tsx`. New nav entry in the "Front of House" group (`src/components/Layout.tsx`), positioned immediately after Reservations.

- Simple list (not kanban — one funnel: `waiting → notified → seated`, with `no_show`/`cancelled` as terminal side-branches, not additional columns). Each row: guest name, phone, party size, elapsed wait time (`Date.now() - created_at`, formatted e.g. "12m", recomputed on a client interval), notes.
- Actions per row, conditional on status:
  - **waiting** → `[Notify]` (opens the `wa.me` link and marks notified) `[Seat]` `[Cancel]`
  - **notified** → `[Seat]` `[Cancel]` `[No-show]`
  - **seated / no_show / cancelled** → drops off the active list entirely
- `[Seat]` opens a small table-picker modal filtered client-side to `restaurant_tables.status='available'`, calling `fn_seat_waitlist_party` on confirm. Toast + reload on success/error, consistent with existing conventions (e.g. `DeliveryOrders.tsx`, `TableTransferModal.tsx`).
- "Add to Waitlist" button opens a form modal (name, phone, party size, optional notes) → direct insert, toast on success/error.
- Polls every 30 seconds, matching `WaiterInterface.tsx`/`DeliveryOrders.tsx` — multiple staff may add/notify/seat/cancel concurrently.
- RBAC: `RoleGate action="make_sales"`, the same reused legacy-role action as every other staff screen in this vertical (any staff except viewer).

## Error Handling & Edge Cases

| Case | Handling |
|---|---|
| Seat attempted on an entry already seated/no-show/cancelled | `fn_seat_waitlist_party` locks and re-checks `status IN ('waiting','notified')`; second caller gets a clear exception, not a silent double-seat |
| Seat attempted on a table that's occupied/reserved/cleaning | Blocked client-side (picker only lists `available` tables) and re-validated server-side (covers a table becoming unavailable between page load and click) |
| Two staff try to seat the same party onto different tables simultaneously | Serialized by the `FOR UPDATE` row lock on the waitlist entry; second caller's status re-check fails cleanly |
| Guest phone number malformed for the `wa.me` link | Same non-issue as `Reservations.tsx` today — digits stripped client-side (`phone.replace(/\D/g, '')`); no new validation beyond what the existing reservation flow already does |
| Cross-tenant access | Tenant check in `fn_seat_waitlist_party` runs before any status logic, per this branch's established IDOR-prevention pattern |

## Testing

- Unit tests (Vitest) for `Waitlist.tsx`: renders the queue with correct elapsed-time formatting and status-conditional actions; Add-to-waitlist form calls the correct insert; Notify/Cancel/No-show call the correct direct updates; Seat opens the table picker and calls `fn_seat_waitlist_party` with correct arguments; error states from any call surface as toasts, not silent failures.
- `fn_seat_waitlist_party` is smoke-tested manually via the Supabase SQL Editor — this repo has no automated test harness for SQL functions (established convention).

## Implementation Notes

- New migration file, numbered after the last one on `main` (`20260706_000055_delivery_order_intake.sql` → next is `000056`): creates `restaurant_waitlist`, its RLS policies, and `fn_seat_waitlist_party`. Delivered as a file and applied manually via the Supabase Dashboard SQL Editor per this repo's convention — purely additive (new table + new function only), no existing table or function touched.
- No edge function work and no redeploy needed — this feature is entirely client-driven (direct table operations plus one RPC), unlike delivery intake which required updating the already-deployed `delivery-webhook` function.
