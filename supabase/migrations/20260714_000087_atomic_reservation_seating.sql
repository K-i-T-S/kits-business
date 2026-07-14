-- Fixes BUG-048 (docs/qa-bug-tracker.md): Reservations.tsx's seatReservation()
-- did 4 sequential, un-transactioned client-side writes -- check for an
-- existing open table_orders row, insert a new one, update
-- restaurant_tables.status, update reservations.status -- the same
-- check-then-act race class already fixed for the identical problem in
-- Waitlist.tsx via fn_seat_waitlist_party() (migration 20260706_000056).
-- A concurrent seating of the same table (a walk-in, or a second
-- reservation) could double-book it between the check and the insert; a
-- failure partway through the four writes also left an inconsistent state
-- with no rollback.
--
-- Mirrors fn_seat_waitlist_party()'s exact pattern: SELECT ... FOR UPDATE on
-- both the reservation and the target table (serializes concurrent seating
-- attempts against the same table), validate status on both, then perform
-- all three writes atomically. Only 'confirmed' is treated as seatable,
-- matching Reservations.tsx's own nextStatuses state machine (only
-- confirmed -> seated is a real transition; pending must go through
-- confirmed first).
CREATE OR REPLACE FUNCTION public.fn_seat_reservation(p_reservation_id uuid, p_target_table_id uuid)
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
    FROM reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_found: %', p_reservation_id;
  END IF;

  IF v_tenant_id IS DISTINCT FROM current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Reservation % is not seatable (status = %)', p_reservation_id, v_status;
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

  INSERT INTO table_orders (tenant_id, table_id, status, covers, opened_at, notes)
  VALUES (
    v_tenant_id,
    p_target_table_id,
    'open',
    v_party_size,
    now(),
    'RESERVATION: ' || v_guest_name || ' (' || v_party_size || ')'
  )
  RETURNING id INTO v_table_order_id;

  UPDATE restaurant_tables SET status = 'occupied' WHERE id = p_target_table_id;

  UPDATE reservations
    SET status = 'seated', table_id = p_target_table_id
    WHERE id = p_reservation_id;

  RETURN v_table_order_id;
END;
$function$;
