-- Migration: Waitlist Management (Tier 1.3)
-- Roadmap source: docs/fnb-competitive-gap-analysis.md, Tier 1 item 3.
-- Design spec: docs/superpowers/specs/2026-07-06-waitlist-management-design.md
--
-- New table restaurant_waitlist tracks the walk-in queue. Every transition
-- except seating is a direct single-row update from the frontend (no RPC
-- needed — see Waitlist.tsx). Seating a party is the one multi-table,
-- atomic operation: it creates the table_orders shell (with the real
-- assigned table_id — unlike the delivery-order shell, a waitlist seating
-- always has a physical table), marks the table occupied, and closes out
-- the waitlist entry, all in one transaction so a table can never be
-- double-assigned to two parties.

-- 1. restaurant_waitlist
CREATE TABLE IF NOT EXISTS restaurant_waitlist (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  guest_name   text not null,
  guest_phone  text not null,
  party_size   integer not null default 2,
  status       text not null default 'waiting', -- 'waiting'|'notified'|'seated'|'no_show'|'cancelled'
  notes        text,
  table_id     uuid references restaurant_tables(id) on delete set null, -- set once seated
  created_at   timestamptz not null default now(),
  notified_at  timestamptz,
  seated_at    timestamptz
);

ALTER TABLE restaurant_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wl_select" ON restaurant_waitlist;
DROP POLICY IF EXISTS "wl_insert" ON restaurant_waitlist;
DROP POLICY IF EXISTS "wl_update" ON restaurant_waitlist;
DROP POLICY IF EXISTS "wl_delete" ON restaurant_waitlist;

CREATE POLICY "wl_select" ON restaurant_waitlist FOR SELECT
  USING (tenant_id = current_tenant_id());
CREATE POLICY "wl_insert" ON restaurant_waitlist FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "wl_update" ON restaurant_waitlist FOR UPDATE
  USING (tenant_id = current_tenant_id());
CREATE POLICY "wl_delete" ON restaurant_waitlist FOR DELETE
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS restaurant_waitlist_tenant_status_idx
  ON restaurant_waitlist(tenant_id, status);

-- 2. fn_seat_waitlist_party — the one atomic, multi-table operation.
-- SECURITY DEFINER, tenant-checked immediately after resolving tenant_id,
-- before any other logic (established IDOR-prevention pattern in this repo).
CREATE OR REPLACE FUNCTION fn_seat_waitlist_party(p_waitlist_id uuid, p_target_table_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_tenant_id <> current_tenant_id() THEN
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

  IF v_table_tenant_id <> current_tenant_id() THEN
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
$$;
