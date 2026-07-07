-- Migration: Order Item Integrity — QR order placement fix
-- Design spec: docs/superpowers/specs/2026-07-07-order-item-integrity-design.md
--
-- QRCart.tsx currently writes directly to table_orders/restaurant_order_items
-- as an anonymous customer. RLS rejects both (empirically verified against a
-- scratch Postgres 16 replica of the live schema — no public policy exists on
-- either table). This RPC is the fix: SECURITY DEFINER, derives tenant_id
-- server-side from p_table_id (never trusts a client-supplied tenant id,
-- mirroring get_public_menu's p_tenant_slug-derivation pattern), resolves
-- prices/modifier names server-side from the menu catalog rather than
-- trusting client-supplied values, and branches on the target order's
-- order_flow ('waiter_confirm' -> restaurant_pending_orders staging table,
-- already built and already has a public insert policy; 'direct' -> real
-- restaurant_order_items rows with menu_item_id always set, unlike today's
-- QRCart.tsx which omits it).
CREATE UNIQUE INDEX IF NOT EXISTS table_orders_one_open_per_table
  ON table_orders(table_id) WHERE status = 'open';

CREATE OR REPLACE FUNCTION qr_place_order(p_table_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id      uuid;
  v_order_id       uuid;
  v_order_flow     text;
  v_default_flow   text;
  v_item           jsonb;
  v_menu_item_id   uuid;
  v_menu_item_name text;
  v_base_price     numeric;
  v_quantity       integer;
  v_mod_id         text;
  v_mod_name       text;
  v_mod_price      numeric;
  v_line_price     numeric;
  v_line_modifiers jsonb;
  v_pending_items  jsonb := '[]'::jsonb;
  v_valid_count    integer := 0;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM restaurant_tables WHERE id = p_table_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'table_not_found';
  END IF;

  SELECT id, order_flow INTO v_order_id, v_order_flow
    FROM table_orders WHERE table_id = p_table_id AND status = 'open' LIMIT 1;

  IF v_order_id IS NULL THEN
    SELECT default_order_flow INTO v_default_flow FROM restaurant_settings WHERE tenant_id = v_tenant_id;
    v_order_flow := COALESCE(v_default_flow, 'waiter_confirm');
    BEGIN
      INSERT INTO table_orders (tenant_id, table_id, status, current_course, order_flow)
      VALUES (v_tenant_id, p_table_id, 'open', 'appetizers', v_order_flow)
      RETURNING id INTO v_order_id;
    EXCEPTION WHEN unique_violation THEN
      -- A concurrent call won the race and already created the open order for this table.
      SELECT id, order_flow INTO v_order_id, v_order_flow
        FROM table_orders WHERE table_id = p_table_id AND status = 'open' LIMIT 1;
    END;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := NULL;
    SELECT id, name, base_price_usd INTO v_menu_item_id, v_menu_item_name, v_base_price
      FROM restaurant_menu_items
      WHERE id = (v_item->>'menu_item_id')::uuid AND tenant_id = v_tenant_id AND is_active = true;

    IF v_menu_item_id IS NULL THEN
      CONTINUE; -- forged/stale/inactive menu_item_id — skip, don't trust client data
    END IF;

    v_quantity := (v_item->>'quantity')::int;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      CONTINUE; -- non-positive/malformed quantity — skip, don't trust client data
    END IF;

    v_line_price := v_base_price;
    v_line_modifiers := '[]'::jsonb;

    IF v_item ? 'modifier_ids' THEN
      FOR v_mod_id IN SELECT * FROM jsonb_array_elements_text(v_item->'modifier_ids')
      LOOP
        v_mod_name := NULL;
        SELECT name, price_delta INTO v_mod_name, v_mod_price
          FROM restaurant_modifiers
          WHERE id = v_mod_id::uuid AND tenant_id = v_tenant_id;
        IF v_mod_name IS NOT NULL THEN
          v_line_price := v_line_price + v_mod_price;
          v_line_modifiers := v_line_modifiers || jsonb_build_object('name', v_mod_name, 'price_delta', v_mod_price);
        END IF;
      END LOOP;
    END IF;

    v_valid_count := v_valid_count + 1;

    IF v_order_flow = 'waiter_confirm' THEN
      v_pending_items := v_pending_items || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', v_menu_item_name,
        'quantity', v_quantity,
        'unit_price', v_line_price,
        'modifiers', v_line_modifiers,
        'notes', COALESCE(v_item->>'notes', ''),
        'course', 'mains'
      );
    ELSE
      INSERT INTO restaurant_order_items (
        tenant_id, order_id, menu_item_id, product_name, quantity, unit_price, modifiers, course, status, notes
      ) VALUES (
        v_tenant_id, v_order_id, v_menu_item_id, v_menu_item_name,
        v_quantity, v_line_price, v_line_modifiers, 'mains', 'pending',
        NULLIF(v_item->>'notes', '')
      );
    END IF;
  END LOOP;

  IF v_valid_count = 0 THEN
    RAISE EXCEPTION 'no_valid_items';
  END IF;

  IF v_order_flow = 'waiter_confirm' THEN
    INSERT INTO restaurant_pending_orders (tenant_id, table_id, table_order_id, items, status)
    VALUES (v_tenant_id, p_table_id, v_order_id, v_pending_items, 'pending');
    RETURN jsonb_build_object('mode', 'pending', 'order_id', v_order_id);
  ELSE
    RETURN jsonb_build_object('mode', 'direct', 'order_id', v_order_id);
  END IF;
END;
$$;
