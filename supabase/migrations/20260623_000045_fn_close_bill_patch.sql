-- ============================================================
-- 20260623_000045_fn_close_bill_patch.sql
-- Patches fn_close_restaurant_bill to:
--   1. Derive v_currency from p_payment_method (cash_lbp → lbp, else usd)
--   2. Write payment_currency = v_currency on the table_orders UPDATE
--   3. Add cash_usd / cash_lbp as explicit CASE arms mapping to 'cash'
--      (Sprint 7 added payment_currency TEXT column to table_orders)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_close_restaurant_bill(
  p_order_id       UUID,
  p_payment_method TEXT
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
  v_currency    TEXT;
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
    WHEN 'cash'     THEN 'cash'
    WHEN 'cash_usd' THEN 'cash'
    WHEN 'cash_lbp' THEN 'cash'
    WHEN 'card'     THEN 'card'
    WHEN 'transfer' THEN 'transfer'
    ELSE 'other'
  END;

  -- Derive payment currency
  v_currency := CASE p_payment_method
    WHEN 'cash_lbp' THEN 'lbp'
    ELSE 'usd'
  END;

  -- Compute subtotal from order items
  SELECT COALESCE(SUM(unit_price * quantity), 0)
  INTO v_subtotal
  FROM restaurant_order_items
  WHERE order_id = p_order_id;

  -- Apply discount, service charge, VAT (read from order row)
  v_after_disc := v_subtotal * (1 - COALESCE(v_order.discount_pct, 0) / 100);
  v_service    := v_after_disc * (COALESCE(v_order.service_charge_pct, 10) / 100);
  v_vat        := (v_after_disc + v_service) * (COALESCE(v_order.vat_pct, 11) / 100);
  v_total      := v_after_disc + v_service + v_vat + COALESCE(v_order.tip_amount_usd, 0);

  -- Close the table_order
  UPDATE table_orders SET
    status           = 'paid',
    paid_at          = v_now,
    closed_at        = v_now,
    payment_method   = v_payment,
    payment_currency = v_currency
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
    v_subtotal - v_after_disc,        -- discount amount
    v_service + v_vat,                 -- tax_amount = service + vat
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
    mi.product_id,                           -- NULL when no linked product
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

COMMENT ON FUNCTION fn_close_restaurant_bill IS
  'Closes a restaurant table_order, writes a sales + sale_items record into the platform. Returns the new sale_id. v2: sets payment_currency on table_orders; handles cash_usd/cash_lbp payment method variants.';
