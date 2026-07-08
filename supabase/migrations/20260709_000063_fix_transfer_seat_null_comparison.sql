-- Migration: Fix NULL-Comparison Auth Bypass in fn_transfer_table_order and fn_seat_waitlist_party
-- Applied directly to the live kits-dev project with explicit owner
-- authorization, then backfilled here for the repo's record and for
-- reproducibility on any fresh Supabase project created from these
-- migration files.
--
-- Origin: the same NULL-comparison auth-bypass class fixed for
-- add_bundle_to_order in migration 20260708_000062 (found during that
-- feature's task-level code review) was noted by that reviewer to also
-- exist, unfixed, in these two already-live, unrelated functions. Both use
-- `IF v_tenant_id <> current_tenant_id() THEN RAISE EXCEPTION
-- 'permission_denied'` as their sole tenant-ownership gate. Postgres's `<>`
-- against a NULL current_tenant_id() (any caller with no active
-- tenant_users row, including anon) evaluates to NULL, and `IF NULL THEN
-- ... END IF` is treated as false in PL/pgSQL — so the exception never
-- fires and execution falls through as if the check passed.
--
-- Impact: fn_seat_waitlist_party could let a caller with no matching
-- tenant seat any tenant's waitlist party at any tenant's table (checked
-- in two places: the waitlist entry's tenant, and the target table's
-- tenant). fn_transfer_table_order could let such a caller transfer or
-- merge any tenant's open table order onto any table.
--
-- Both v_tenant_id/v_table_tenant_id are guaranteed non-NULL at their
-- comparison points (each is preceded by a NOT FOUND / IS NULL guard on a
-- NOT NULL, FK-constrained column), so the theoretical
-- `NULL IS DISTINCT FROM NULL -> FALSE` case is unreachable here, matching
-- the already-verified reasoning from the add_bundle_to_order fix.
--
-- Fix: NULL-safe IS DISTINCT FROM comparison, same pattern as
-- add_bundle_to_order. No other logic changed in either function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_seat_waitlist_party(p_waitlist_id uuid, p_target_table_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id        uuid;
  v_status           text;
  v_guest_name       text;
  v_party_size       integer;
  v_table_tenant_id  uuid;
  v_table_status     text;
  v_table_order_id   uuid;
BEGIN
  SELECT tenant_id, status, guest_name, party_size
    INTO v_tenant_id, v_status, v_guest_name, v_party_size
    FROM restaurant_waitlist
    WHERE id = p_waitlist_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'waitlist_entry_not_found: %', p_waitlist_id;
  END IF;

  IF v_tenant_id IS DISTINCT FROM current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_status NOT IN ('waiting', 'notified') THEN
    RAISE EXCEPTION 'Waitlist entry % is not seatable (status = %)', p_waitlist_id, v_status;
  END IF;

  SELECT tenant_id, status
    INTO v_table_tenant_id, v_table_status
    FROM restaurant_tables
    WHERE id = p_target_table_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'table_not_found: %', p_target_table_id;
  END IF;

  IF v_table_tenant_id IS DISTINCT FROM current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_table_status <> 'available' THEN
    RAISE EXCEPTION 'Table % is not available (status = %)', p_target_table_id, v_table_status;
  END IF;

  INSERT INTO table_orders (tenant_id, table_id, status, notes)
  VALUES (
    v_tenant_id,
    p_target_table_id,
    'open',
    'WAITLIST: ' || v_guest_name || ' (' || v_party_size || ')'
  )
  RETURNING id INTO v_table_order_id;

  UPDATE restaurant_tables SET status = 'occupied' WHERE id = p_target_table_id;

  UPDATE restaurant_waitlist
    SET status = 'seated', seated_at = now(), table_id = p_target_table_id
    WHERE id = p_waitlist_id;

  RETURN v_table_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_transfer_table_order(p_order_id uuid, p_target_table_id uuid, p_new_waiter_id uuid DEFAULT NULL::uuid, p_allow_merge boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF v_tenant_id IS DISTINCT FROM current_tenant_id() THEN
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

    UPDATE restaurant_argile_sessions
      SET table_id = p_target_table_id
      WHERE table_order_id = p_order_id AND tenant_id = v_tenant_id AND status = 'active';

    v_resulting_order_id := p_order_id;
  ELSE
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
    v_resulting_order_id := v_target_order_id;
  END IF;

  IF p_new_waiter_id IS NOT NULL THEN
    UPDATE table_orders SET waiter_id = p_new_waiter_id WHERE id = v_resulting_order_id;
  END IF;

  RETURN v_resulting_order_id;
END;
$function$;
