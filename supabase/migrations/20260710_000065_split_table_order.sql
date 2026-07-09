-- ============================================================
-- Migration: Split Table Order
--
-- Adds the "split" half of the Tier 2.3 roadmap item "table
-- merge/split" — the merge case is already covered by
-- fn_transfer_table_order (20260706_000054). This adds the ability
-- to divide one table's order into two: staff select a subset of the
-- current order's items and a currently-available target table; the
-- selected items move to a brand-new order at that table, and the
-- source order keeps the rest.
--
-- Full design: docs/superpowers/specs/2026-07-10-split-table-order-design.md
-- ============================================================

CREATE OR REPLACE FUNCTION fn_split_table_order(
  p_source_order_id UUID,
  p_target_table_id UUID,
  p_item_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id        UUID;
  v_source_status    TEXT;
  v_waiter_id        UUID;
  v_new_order_id     UUID;
  v_total_item_count INT;
  v_selected_count   INT;
BEGIN
  -- Validate and lock the source order
  SELECT tenant_id, status, waiter_id
    INTO v_tenant_id, v_source_status, v_waiter_id
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

  -- All selected items must belong to this order and this tenant.
  -- Lock the matching rows now (via the CTE's FOR UPDATE) so a concurrent
  -- operation can't reassign their order_id in the gap between this check
  -- and the UPDATE that moves them below.
  WITH locked_items AS (
    SELECT id FROM restaurant_order_items
    WHERE id = ANY(p_item_ids) AND order_id = p_source_order_id AND tenant_id = v_tenant_id
    FOR UPDATE
  )
  SELECT count(*) INTO v_selected_count FROM locked_items;

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

  -- Lock the target table row first so concurrent split/transfer/seat
  -- attempts onto the same target table serialize here rather than both
  -- racing past the availability check below.
  PERFORM 1 FROM restaurant_tables WHERE id = p_target_table_id AND tenant_id = v_tenant_id FOR UPDATE;

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

REVOKE EXECUTE ON FUNCTION fn_split_table_order(uuid, uuid, uuid[]) FROM anon;
