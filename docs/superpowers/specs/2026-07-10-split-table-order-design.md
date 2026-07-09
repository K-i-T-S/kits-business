# Split Table Order — Design Spec

**Date:** 2026-07-10
**Status:** Approved for planning

## Problem

The F&B competitive gap analysis (`docs/fnb-competitive-gap-analysis.md`, Tier 2.3) identifies "table merge/split" as a roadmap item. The *merge* case — folding one table's order onto another occupied table — is already covered by `fn_transfer_table_order` (Tier 1.1/1.2, `TableTransferModal.tsx`). The *split* case — dividing one table's order into two, e.g. when a party of 6 splits into two groups wanting separate bills at separate tables — is not built. This spec covers only the split case.

This is a distinct feature from the existing `BillSplitModal`/`BillSplitter`, which divides *payment* on a single order among multiple people without moving any items or creating a second `table_orders` row. Split Table Order creates a genuinely second, independently trackable and payable order at a second physical table.

## Goals

- Staff can move a specific subset of a table's order items to a different, currently-available table, creating two independent orders from one.
- Preset-order-bundle integrity is preserved: a bundle's component rows can never be separated across two tables.
- No accidental full-transfer-in-disguise: splitting off every item is rejected in favor of the existing Transfer flow.
- KDS/kitchen status, pricing, and modifiers on moved items are preserved exactly — this is a re-parenting of existing rows, not a re-creation.

## Non-goals

- Argile session handling — sessions linked to the source order stay with the original table regardless of what's split off. Documented limitation, not solved here.
- Waiter reassignment as part of the split — the new order inherits the source order's current waiter unchanged; use the existing Transfer flow afterward if reassignment is also needed.
- Partial-quantity splitting (e.g. splitting a quantity-3 line into 2+1 across two tables) — a selected item's full row (and its full quantity) moves, or it doesn't move at all.
- Splitting onto an occupied target table (that's a merge, already covered by transfer) — the target must currently have no open order.

## Design

### 1. New RPC: `fn_split_table_order`

```sql
CREATE OR REPLACE FUNCTION fn_split_table_order(
  p_source_order_id UUID,
  p_target_table_id UUID,
  p_item_ids UUID[]
)
RETURNS UUID  -- the new order's id
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tenant_id        UUID;
  v_source_table_id  UUID;
  v_source_status    TEXT;
  v_waiter_id        UUID;
  v_new_order_id     UUID;
  v_total_item_count INT;
  v_selected_count   INT;
BEGIN
  -- Validate and lock the source order
  SELECT tenant_id, table_id, status, waiter_id
    INTO v_tenant_id, v_source_table_id, v_source_status, v_waiter_id
    FROM table_orders
    WHERE id = p_source_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_source_order_id;
  END IF;

  IF v_tenant_id IS DISTINCT FROM current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_source_status NOT IN ('open', 'sent', 'served') THEN
    RAISE EXCEPTION 'Order % is not splittable (status = %)', p_source_order_id, v_source_status;
  END IF;

  IF array_length(p_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No items selected to split';
  END IF;

  -- All selected items must belong to this order and this tenant
  SELECT count(*) INTO v_selected_count
    FROM restaurant_order_items
    WHERE id = ANY(p_item_ids) AND order_id = p_source_order_id AND tenant_id = v_tenant_id;

  IF v_selected_count IS DISTINCT FROM array_length(p_item_ids, 1) THEN
    RAISE EXCEPTION 'One or more selected items do not belong to this order';
  END IF;

  -- Bundle guard: no bundle may be split across the two orders
  IF EXISTS (
    SELECT 1 FROM restaurant_order_items roi
    WHERE roi.order_id = p_source_order_id
      AND roi.bundle_id IS NOT NULL
      AND roi.bundle_id IN (
        SELECT bundle_id FROM restaurant_order_items
        WHERE id = ANY(p_item_ids) AND bundle_id IS NOT NULL
      )
      AND roi.id != ALL(p_item_ids)
  ) THEN
    RAISE EXCEPTION 'bundle_split_not_allowed';
  END IF;

  -- Non-empty-remainder guard
  SELECT count(*) INTO v_total_item_count
    FROM restaurant_order_items WHERE order_id = p_source_order_id;

  IF v_selected_count = v_total_item_count THEN
    RAISE EXCEPTION 'split_would_empty_source_order';
  END IF;

  -- Target table must be same tenant and currently available
  IF NOT EXISTS (
    SELECT 1 FROM restaurant_tables
    WHERE id = p_target_table_id AND tenant_id = v_tenant_id AND status = 'available'
  ) THEN
    RAISE EXCEPTION 'target_table_occupied';
  END IF;

  -- Create the new order at the target table
  INSERT INTO table_orders (tenant_id, table_id, status, current_course, waiter_id)
  VALUES (v_tenant_id, p_target_table_id, v_source_status, 'mains', v_waiter_id)
  RETURNING id INTO v_new_order_id;

  -- Move the selected items
  UPDATE restaurant_order_items
    SET order_id = v_new_order_id
    WHERE id = ANY(p_item_ids) AND tenant_id = v_tenant_id;

  UPDATE restaurant_tables SET status = 'occupied' WHERE id = p_target_table_id;

  RETURN v_new_order_id;
END;
$$;
```

Notes on the exact checks above (to carry into the implementation plan verbatim, not re-derived):
- The bundle guard compares "all rows sharing any bundle_id present in the selection" against "the selection" — `roi.id != ALL(p_item_ids)` catches any row that shares a bundle with a selected row but wasn't itself selected.
- `current_course` on the new order defaults to `'mains'`, matching every other order-creation path in this schema (`fn_seat_waitlist_party`, direct table opening) — not derived from the source order, since the split-off items may span multiple courses.
- Uses `IS DISTINCT FROM` for the tenant check, matching the platform-wide fix from `20260709_000063` — not `<>`.

### 2. Frontend: `SplitTableModal.tsx`

New file, structurally mirroring `TableTransferModal.tsx`:
- Checkbox list of the source order's current `restaurant_order_items`. Bundle rows (`bundle_id IS NOT NULL`) render grouped by `bundle_id` as one non-splittable unit — a single checkbox toggles the whole bundle's rows together, with a tooltip: "Bundle items move together."
- Target-table `<select>` limited to `tables.filter(t => t.status === 'available')` — no merge path here, unlike Transfer's picker.
- Submit disabled until ≥1 item selected AND a target table chosen AND the selection wouldn't empty the source order (mirrored client-side for immediate feedback; the RPC is still the source of truth).
- Calls `supabase.rpc('fn_split_table_order', { p_source_order_id, p_target_table_id, p_item_ids })`.
- On `bundle_split_not_allowed` / `split_would_empty_source_order` / `target_table_occupied` errors, show the specific friendly message per code (matching `QRCart.tsx`'s `mapPlaceOrderError` pattern of code-to-message mapping, scaled down to 3 codes).
- On success: toast, close, refresh both tables' state (matching Transfer's `onSuccess`/`onClose` contract).

Wired into `WaiterInterface.tsx`/`TableManagement.tsx` next to the existing Transfer action, gated the same way (only shown for orders with ≥2 items, since you can't split 1 item into 2 non-empty orders).

## Data Flow

| Scenario | Flow |
|---|---|
| Split 2 of 5 items to an available table | Staff select 2 items + Table 7 → RPC creates new order at Table 7, moves the 2 items, marks Table 7 occupied → source order keeps its remaining 3 items, unaffected |
| Attempt to split only part of a bundle | RPC raises `bundle_split_not_allowed` before any write → modal shows friendly error, no state change |
| Attempt to select every item | RPC raises `split_would_empty_source_order` → modal suggests using Transfer instead |
| Attempt to target an occupied table | RPC raises `target_table_occupied` → modal error, no state change |

## Testing

- RPC (manual/reasoning-based verification, no pgTAP in this repo — see prior migrations' convention): correct item movement and target-table status flip; bundle-partial-selection raises; empty-remainder raises; occupied-target raises; cross-tenant order/item/table raises `permission_denied`/not-found as appropriate; non-owner-tenant caller blocked via `current_tenant_id()`.
- Frontend: bundle rows render as one grouped, non-partially-selectable unit; submit gating (item + table both required, remainder guard); all three error codes map to distinct friendly messages; success path calls `onSuccess`/`onClose`.
