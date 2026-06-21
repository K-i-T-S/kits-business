-- ============================================================
-- 20260621_000040_restaurant_bridge.sql
-- Bridges restaurant module → main platform (sales, inventory)
--
-- 1. restaurant_menu_items.product_id  → optional FK to products
-- 2. restaurant_order_items.menu_item_id → optional FK to menu items
-- 3. sale_items.product_id nullable + product_name column
-- 4. sales.source + sales.table_order_id
-- 5. fn_close_restaurant_bill() RPC
-- ============================================================

-- 1. Link restaurant menu items to platform products (optional)
ALTER TABLE restaurant_menu_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_product
  ON restaurant_menu_items(product_id) WHERE product_id IS NOT NULL;

-- 2. Link order items to the specific menu item that was ordered (optional)
ALTER TABLE restaurant_order_items
  ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES restaurant_menu_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_menu_item
  ON restaurant_order_items(menu_item_id) WHERE menu_item_id IS NOT NULL;

-- 3. sale_items: make product_id nullable (restaurant items may not map to a product),
--    add product_name fallback for display
ALTER TABLE sale_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS product_name TEXT;

-- 4. sales: track source and back-reference to restaurant order
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'pos'
    CHECK (source IN ('pos', 'restaurant'));

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS table_order_id UUID REFERENCES table_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_table_order
  ON sales(table_order_id) WHERE table_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_source
  ON sales(tenant_id, source);

-- 5. fn_close_restaurant_bill
--    Closes a table_order, creates sales + sale_items, returns new sale_id.
--    Reads tip/discount/VAT/service from the order row itself (already persisted
--    by updateTip / updateDiscount hooks before this is called).

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
    WHEN 'card'     THEN 'card'
    WHEN 'transfer' THEN 'transfer'
    ELSE 'other'
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
  'Closes a restaurant table_order, writes a sales + sale_items record into the platform. Returns the new sale_id.';
