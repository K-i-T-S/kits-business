-- ============================================================
-- 20260622_000048_fix_close_restaurant_bill.sql
-- Fixes PGRST202 error: fn_close_restaurant_bill parameter mismatch.
--
-- The function was initially defined with 2 parameters:
--   (p_order_id UUID, p_payment_method TEXT)
--
-- The frontend calls it with 6 parameters:
--   (p_order_id, p_payment_method, p_tip_amount_usd,
--    p_discount_pct, p_cash_received_usd, p_exchange_rate)
--
-- This migration replaces the function with the correct signature.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_close_restaurant_bill(
  p_order_id          UUID,
  p_payment_method    TEXT,
  p_tip_amount_usd    NUMERIC DEFAULT 0,
  p_discount_pct      NUMERIC DEFAULT 0,
  p_cash_received_usd NUMERIC DEFAULT 0,
  p_exchange_rate     NUMERIC DEFAULT 89500
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order       RECORD;
  v_subtotal    NUMERIC(12,2) := 0;
  v_after_disc  NUMERIC(12,2);
  v_service     NUMERIC(12,2);
  v_vat         NUMERIC(12,2);
  v_total       NUMERIC(12,2);
  v_sale_id     UUID;
  v_payment     TEXT;
  v_now         TIMESTAMPTZ := now();
BEGIN
  -- Authorisation: caller's tenant must own this order
  SELECT * INTO v_order FROM table_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF v_order.tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;
  IF v_order.status = 'paid' THEN
    RAISE EXCEPTION 'already_paid';
  END IF;

  -- Map payment method to sales table constraint
  v_payment := CASE p_payment_method
    WHEN 'cash'       THEN 'cash'
    WHEN 'cash_usd'   THEN 'cash'
    WHEN 'cash_lbp'   THEN 'cash'
    WHEN 'card'       THEN 'card'
    WHEN 'transfer'   THEN 'transfer'
    WHEN 'bank_transfer' THEN 'transfer'
    WHEN 'split'      THEN 'split'
    ELSE 'other'
  END;

  -- Compute subtotal from order items
  SELECT COALESCE(SUM(unit_price * quantity), 0)
  INTO v_subtotal
  FROM restaurant_order_items
  WHERE order_id = p_order_id;

  -- Use provided discount/tip params if given, otherwise fall back to order row values
  -- (The frontend may pre-save these to the order or pass them directly)
  v_after_disc := v_subtotal * (1 - COALESCE(p_discount_pct, v_order.discount_pct, 0) / 100);
  v_service    := v_after_disc * (COALESCE(v_order.service_charge_pct, 10) / 100);
  v_vat        := (v_after_disc + v_service) * (COALESCE(v_order.vat_pct, 11) / 100);
  v_total      := v_after_disc + v_service + v_vat + COALESCE(p_tip_amount_usd, v_order.tip_amount_usd, 0);

  -- Persist tip and discount onto the order row for record-keeping
  UPDATE table_orders SET
    tip_amount_usd   = COALESCE(p_tip_amount_usd, tip_amount_usd, 0),
    discount_pct     = COALESCE(p_discount_pct, discount_pct, 0)
  WHERE id = p_order_id;

  -- Close the table_order
  UPDATE table_orders SET
    status         = 'paid',
    paid_at        = v_now,
    closed_at      = v_now,
    payment_method = v_payment
  WHERE id = p_order_id;

  -- Set table to cleaning
  IF v_order.table_id IS NOT NULL THEN
    UPDATE restaurant_tables SET status = 'cleaning'
    WHERE id = v_order.table_id;
  END IF;

  -- Create platform sales record
  INSERT INTO sales (
    tenant_id,
    subtotal,
    discount,
    tax_amount,
    total_amount,
    payment_method,
    payment_status,
    source,
    table_order_id,
    notes,
    sale_date,
    created_at
  ) VALUES (
    v_order.tenant_id,
    v_subtotal,
    v_subtotal - v_after_disc,          -- discount amount
    v_service + v_vat,                  -- tax_amount = service + vat
    v_total,
    v_payment,
    'completed',
    'restaurant',
    p_order_id,
    'Table ' || COALESCE(
      (SELECT number::TEXT FROM restaurant_tables WHERE id = v_order.table_id),
      '?'
    ),
    v_now,
    v_now
  ) RETURNING id INTO v_sale_id;

  -- Create sale_items — join through menu_item_id to get product_id + cost
  INSERT INTO sale_items (
    sale_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    unit_cost,
    total_price,
    created_at
  )
  SELECT
    v_sale_id,
    mi.product_id,                      -- NULL when no linked product
    roi.product_name,
    roi.quantity,
    roi.unit_price,
    COALESCE(mi.cost_price_usd, 0),
    roi.unit_price * roi.quantity,
    v_now
  FROM restaurant_order_items roi
  LEFT JOIN restaurant_menu_items mi
         ON roi.menu_item_id = mi.id
  WHERE roi.order_id = p_order_id;

  RETURN v_sale_id;
END;
$$;

COMMENT ON FUNCTION public.fn_close_restaurant_bill(
  UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC
) IS
  'Closes a restaurant table_order, writes a sales + sale_items record into the platform. Returns the new sale_id. Accepts tip, discount, cash received, and exchange rate as optional parameters.';

GRANT EXECUTE ON FUNCTION fn_close_restaurant_bill(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
