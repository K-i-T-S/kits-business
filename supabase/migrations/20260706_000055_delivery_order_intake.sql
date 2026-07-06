-- supabase/migrations/20260706_000055_delivery_order_intake.sql
-- Delivery Order Intake (Tier 1.4, docs/fnb-competitive-gap-analysis.md).
-- See docs/superpowers/specs/2026-07-06-delivery-order-intake-design.md for full design.
--
-- Two real gaps in the Tier 0-restored delivery-webhook pipeline, fixed here:
-- 1. inject_delivery_order created a kitchen-visible table_orders shell but never
--    inserted restaurant_order_items — kitchen staff saw an order card with zero
--    items to prepare.
-- 2. restaurant_delivery_orders was never read by any frontend code — no way to
--    see, accept/reject, or progress an incoming delivery order, and no way for
--    one to ever be "completed" (stayed open forever, no revenue recorded).
--
-- Behavior change: table_orders/restaurant_order_items are now created at
-- ACCEPTANCE time (accept_delivery_order), not at webhook-receipt time
-- (inject_delivery_order). Kitchen should never see an order as active before
-- someone (human, or the auto_accept setting) has committed to fulfilling it.
--
-- Revenue: complete_delivery_order records the sale directly from
-- restaurant_delivery_orders' own subtotal_usd/total_usd -- it does NOT route
-- through finalize_restaurant_order. That function's dine-in service-charge/VAT
-- formula has no bearing on what a delivery customer paid the platform, and is
-- left completely untouched by this migration (no redefinition, no new params).
--
-- Cancellation: reject_delivery_order accepts cancellation from any pre-pickup
-- status ('new', 'accepted', 'preparing', 'ready'), not just 'new' -- closing
-- the linked table_orders shell too, if accept_delivery_order already created
-- one, so a bad order can be cancelled without booking phantom revenue or
-- resorting to manual SQL.

-- 1. Allow 'delivery' as a sales source and 'platform' as a payment method,
--    alongside the existing 'pos'/'restaurant' sources and 'cash'/'card'/
--    'transfer'/'other' payment methods.
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_source_check;
ALTER TABLE sales ADD CONSTRAINT sales_source_check CHECK (source IN ('pos', 'restaurant', 'delivery'));

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('cash', 'card', 'transfer', 'other', 'platform'));

-- 2. Simplify inject_delivery_order: only records the inbound order now.
--    (Signature unchanged; only removes the table_orders-shell creation that used
--    to happen unconditionally regardless of auto_accept.)
CREATE OR REPLACE FUNCTION inject_delivery_order(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_platform TEXT,
  p_external_order_id TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_total_usd NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID;
BEGIN
  INSERT INTO restaurant_delivery_orders (
    tenant_id, branch_id, platform, external_order_id, customer_name, items, total_usd, notes, status
  ) VALUES (
    p_tenant_id, p_branch_id, p_platform, p_external_order_id, p_customer_name, p_items, p_total_usd, p_notes, 'new'
  ) ON CONFLICT (tenant_id, platform, external_order_id) DO NOTHING
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

-- 3. accept_delivery_order — creates the KDS-visible shell + real order items.
CREATE OR REPLACE FUNCTION accept_delivery_order(p_delivery_order_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_platform TEXT;
  v_external_order_id TEXT;
  v_items JSONB;
  v_status TEXT;
  v_table_order_id UUID;
BEGIN
  SELECT tenant_id, platform, external_order_id, items, status
    INTO v_tenant_id, v_platform, v_external_order_id, v_items, v_status
    FROM restaurant_delivery_orders
    WHERE id = p_delivery_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Delivery order % not found', p_delivery_order_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_status <> 'new' THEN
    RAISE EXCEPTION 'Delivery order % is not acceptable (status = %)', p_delivery_order_id, v_status;
  END IF;

  INSERT INTO table_orders (tenant_id, status, notes, current_course)
  VALUES (v_tenant_id, 'open', 'DELIVERY: ' || v_platform || ' #' || v_external_order_id, 'mains')
  RETURNING id INTO v_table_order_id;

  INSERT INTO restaurant_order_items (tenant_id, order_id, product_name, quantity, unit_price, modifiers, notes, course, status)
  SELECT
    v_tenant_id,
    v_table_order_id,
    item->>'name',
    (item->>'quantity')::INTEGER,
    (item->>'unit_price')::NUMERIC,
    COALESCE(item->'modifiers', '[]'::jsonb),
    item->>'notes',
    'mains',
    'pending'
  FROM jsonb_array_elements(v_items) AS item;

  UPDATE restaurant_delivery_orders
    SET status = 'accepted', accepted_at = now(), table_order_id = v_table_order_id
    WHERE id = p_delivery_order_id;

  RETURN v_table_order_id;
END;
$$;

-- 4. reject_delivery_order — cancellable from any pre-pickup status, not just
--    'new'. Closes the linked table_orders shell too, if accept_delivery_order
--    already created one (no shell exists yet for a still-'new' order).
CREATE OR REPLACE FUNCTION reject_delivery_order(p_delivery_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_status TEXT;
  v_table_order_id UUID;
BEGIN
  SELECT tenant_id, status, table_order_id INTO v_tenant_id, v_status, v_table_order_id
    FROM restaurant_delivery_orders
    WHERE id = p_delivery_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Delivery order % not found', p_delivery_order_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_status NOT IN ('new', 'accepted', 'preparing', 'ready') THEN
    RAISE EXCEPTION 'Delivery order % is not rejectable (status = %)', p_delivery_order_id, v_status;
  END IF;

  UPDATE restaurant_delivery_orders SET status = 'cancelled' WHERE id = p_delivery_order_id;

  IF v_table_order_id IS NOT NULL THEN
    UPDATE table_orders SET status = 'cancelled', closed_at = now() WHERE id = v_table_order_id;
  END IF;
END;
$$;

-- 5. complete_delivery_order — the "mark picked up" action. Records the sale
--    directly from the delivery order's own subtotal_usd/total_usd (what the
--    customer actually paid the platform, delivery fee included) — no dine-in
--    service-charge/VAT math applies to a delivery sale.
CREATE OR REPLACE FUNCTION complete_delivery_order(p_delivery_order_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_status TEXT;
  v_table_order_id UUID;
  v_platform TEXT;
  v_external_order_id TEXT;
  v_subtotal_usd NUMERIC;
  v_total_usd NUMERIC;
  v_sale_id UUID;
BEGIN
  SELECT tenant_id, status, table_order_id, platform, external_order_id, subtotal_usd, total_usd
    INTO v_tenant_id, v_status, v_table_order_id, v_platform, v_external_order_id, v_subtotal_usd, v_total_usd
    FROM restaurant_delivery_orders
    WHERE id = p_delivery_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Delivery order % not found', p_delivery_order_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_status <> 'ready' THEN
    RAISE EXCEPTION 'Delivery order % is not completable (status = %)', p_delivery_order_id, v_status;
  END IF;

  UPDATE restaurant_delivery_orders SET status = 'picked_up' WHERE id = p_delivery_order_id;
  UPDATE table_orders SET status = 'paid', closed_at = now() WHERE id = v_table_order_id;

  INSERT INTO sales (
    tenant_id, subtotal, discount, tax_amount, total_amount,
    payment_method, payment_status, notes, sale_date, table_order_id, source
  ) VALUES (
    v_tenant_id,
    COALESCE(v_subtotal_usd, 0), 0, 0, COALESCE(v_total_usd, 0),
    'platform', 'completed',
    v_platform || ' #' || v_external_order_id,
    now(), v_table_order_id, 'delivery'
  ) RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$;
