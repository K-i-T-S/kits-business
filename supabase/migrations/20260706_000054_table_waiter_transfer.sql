-- supabase/migrations/20260706_000054_table_waiter_transfer.sql
-- Table & Waiter Transfer (Tier 1.1 + 1.2, docs/fnb-competitive-gap-analysis.md).
-- See docs/superpowers/specs/2026-07-05-table-waiter-transfer-design.md for full design.
--
-- No CHECK constraint exists on table_orders.status (confirmed in
-- 20260620_000031_restaurant_schema.sql), so the new 'merged' status value needs no
-- schema change of its own — only this comment documenting the convention:
-- table_orders.status now also accepts 'merged', meaning this order's items were
-- folded into another order (see merged_into_order_id) rather than closed/cancelled.
--
-- Note: concurrent mutual-swap transfers between two tables (order A moved to
-- order B's table AND order B moved to order A's table, at the same time) may
-- cause Postgres to detect a deadlock and abort one transaction with a generic
-- deadlock_detected error rather than one of this function's RAISE EXCEPTION
-- messages. This is self-resolving (one transaction aborts and can be safely
-- retried) — not a correctness bug.

ALTER TABLE table_orders
  ADD COLUMN IF NOT EXISTS merged_into_order_id UUID REFERENCES table_orders(id);

CREATE OR REPLACE FUNCTION fn_transfer_table_order(
  p_order_id UUID,
  p_target_table_id UUID,
  p_new_waiter_id UUID DEFAULT NULL,
  p_allow_merge BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_source_table_id UUID;
  v_source_status TEXT;
  v_target_order_id UUID;
  v_resulting_order_id UUID;
BEGIN
  -- 1. Validate and lock the source order
  SELECT tenant_id, table_id, status
    INTO v_tenant_id, v_source_table_id, v_source_status
    FROM table_orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_source_status NOT IN ('open', 'sent', 'served') THEN
    RAISE EXCEPTION 'Order % is not transferable (status = %)', p_order_id, v_source_status;
  END IF;

  -- 2. Validate the target table belongs to the same tenant and isn't the source table
  IF NOT EXISTS (
    SELECT 1 FROM restaurant_tables WHERE id = p_target_table_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Target table % not found for this tenant', p_target_table_id;
  END IF;

  IF p_target_table_id = v_source_table_id THEN
    RAISE EXCEPTION 'Target table is the same as the source table';
  END IF;

  -- Lock the target table row first so concurrent transfers onto the same
  -- target table serialize here rather than both racing past the "does it
  -- have an open order" check below and both taking the simple-move branch.
  PERFORM 1 FROM restaurant_tables WHERE id = p_target_table_id AND tenant_id = v_tenant_id FOR UPDATE;

  -- 3. Find and lock the target table's open order, if any
  SELECT id INTO v_target_order_id
    FROM table_orders
    WHERE table_id = p_target_table_id
      AND tenant_id = v_tenant_id
      AND status IN ('open', 'sent', 'served')
    FOR UPDATE;

  IF v_target_order_id IS NULL THEN
    -- Simple move: no order at the target table
    UPDATE table_orders SET table_id = p_target_table_id WHERE id = p_order_id;
    UPDATE restaurant_tables SET status = 'available' WHERE id = v_source_table_id;
    UPDATE restaurant_tables SET status = 'occupied' WHERE id = p_target_table_id;

    -- Any active argile session tied to this order must follow the party to
    -- its new table, or subsequent refill/coal charges will look for an open
    -- order at the freed source table (finding none, or worse, finding
    -- whichever new party is later seated there).
    UPDATE restaurant_argile_sessions
      SET table_id = p_target_table_id
      WHERE table_order_id = p_order_id AND tenant_id = v_tenant_id AND status = 'active';

    v_resulting_order_id := p_order_id;
  ELSE
    -- Merge: target table already has an open order — combine into one bill.
    -- Refuse silently merging unless the caller has explicitly acknowledged
    -- it (i.e. the user has seen and accepted the "cannot be undone" merge
    -- warning). A stale frontend that believed this target was empty gets a
    -- distinct exception here instead of performing an unacknowledged merge.
    IF NOT p_allow_merge THEN
      RAISE EXCEPTION 'target_occupied_merge_required';
    END IF;

    UPDATE restaurant_order_items
      SET order_id = v_target_order_id
      WHERE order_id = p_order_id AND tenant_id = v_tenant_id;

    UPDATE restaurant_argile_sessions
      SET table_order_id = v_target_order_id, table_id = p_target_table_id
      WHERE table_order_id = p_order_id AND tenant_id = v_tenant_id AND status = 'active';

    UPDATE table_orders
      SET status = 'merged', merged_into_order_id = v_target_order_id, closed_at = now()
      WHERE id = p_order_id;

    UPDATE restaurant_tables SET status = 'available' WHERE id = v_source_table_id;
    -- Target table's status is already 'occupied' — no change needed.
    v_resulting_order_id := v_target_order_id;
  END IF;

  -- 4. Optional waiter reassignment, applied to whichever order now represents the party
  IF p_new_waiter_id IS NOT NULL THEN
    UPDATE table_orders SET waiter_id = p_new_waiter_id WHERE id = v_resulting_order_id;
  END IF;

  RETURN v_resulting_order_id;
END;
$$;
