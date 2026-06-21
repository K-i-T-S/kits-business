-- ============================================================
-- 20260621_000040_restaurant_sales_bridge.sql
-- Links restaurant orders to the main sales ledger:
--   1. product_id (nullable) on restaurant_menu_items — links to products catalog
--   2. product_id (nullable) on restaurant_order_items — for items tied to a product
--   3. table_order_id (nullable) on sales — marks restaurant-origin sales
--   4. finalize_restaurant_order(p_order_id) — creates a sales record when bill is closed
-- ============================================================

-- ── 1. Link restaurant menu items to products catalog ────────────────────────
ALTER TABLE restaurant_menu_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_product_id
  ON restaurant_menu_items(product_id) WHERE product_id IS NOT NULL;

-- ── 2. Link order items to products (populated when menu item has product_id) ─
ALTER TABLE restaurant_order_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_product_id
  ON restaurant_order_items(product_id) WHERE product_id IS NOT NULL;

-- ── 3. Mark restaurant-origin rows in the main sales ledger ─────────────────
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS table_order_id UUID REFERENCES table_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pos' CHECK (source IN ('pos', 'restaurant', 'online'));

CREATE INDEX IF NOT EXISTS idx_sales_table_order_id
  ON sales(table_order_id) WHERE table_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_source
  ON sales(source);

-- ── 4. RPC: finalize_restaurant_order ───────────────────────────────────────
-- Called when a table bill is closed. Creates a sales record so restaurant
-- revenue appears in the main Reports / Finance modules.
--
-- Returns: the new sale_id (UUID), or NULL if already finalized.
CREATE OR REPLACE FUNCTION finalize_restaurant_order(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order       table_orders%ROWTYPE;
  v_tenant_id   UUID;
  v_subtotal    NUMERIC(12,2);
  v_discount    NUMERIC(12,2);
  v_tax         NUMERIC(12,2);
  v_service     NUMERIC(12,2);
  v_tip         NUMERIC(12,2);
  v_total       NUMERIC(12,2);
  v_sale_id     UUID;
BEGIN
  -- Fetch the order
  SELECT * INTO v_order FROM table_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Idempotency: if a sales record already exists for this order, return it
  SELECT id INTO v_sale_id FROM sales WHERE table_order_id = p_order_id LIMIT 1;
  IF FOUND THEN
    RETURN v_sale_id;
  END IF;

  v_tenant_id := v_order.tenant_id;

  -- Compute financials from order items
  SELECT COALESCE(SUM(unit_price * quantity), 0)
    INTO v_subtotal
    FROM restaurant_order_items
   WHERE order_id = p_order_id;

  v_discount  := v_subtotal * COALESCE(v_order.discount_pct, 0) / 100.0;
  v_service   := (v_subtotal - v_discount) * COALESCE(v_order.service_charge_pct, 10) / 100.0;
  v_tax       := (v_subtotal - v_discount + v_service) * COALESCE(v_order.vat_pct, 11) / 100.0;
  v_tip       := COALESCE(v_order.tip_amount_usd, 0);
  v_total     := v_subtotal - v_discount + v_service + v_tax + v_tip;

  -- Insert into main sales ledger
  INSERT INTO sales (
    tenant_id,
    employee_id,
    subtotal,
    discount,
    tax_amount,
    total_amount,
    payment_method,
    payment_status,
    notes,
    sale_date,
    table_order_id,
    source
  )
  VALUES (
    v_tenant_id,
    v_order.waiter_id,
    v_subtotal,
    v_discount,
    v_tax + v_service,   -- combined tax+service in tax_amount field
    v_total,
    COALESCE(v_order.payment_method, 'cash'),
    'completed',
    'Restaurant table ' || (
      SELECT number::TEXT FROM restaurant_tables WHERE id = v_order.table_id
    ),
    COALESCE(v_order.paid_at, now()),
    p_order_id,
    'restaurant'
  )
  RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$;

-- Grant execute to authenticated users (RLS on underlying tables still applies)
GRANT EXECUTE ON FUNCTION finalize_restaurant_order(UUID) TO authenticated;

-- ── 5. Convenience view: restaurant daily revenue ────────────────────────────
-- Useful for analytics + ML forecasting queries
CREATE OR REPLACE VIEW restaurant_daily_revenue AS
SELECT
  s.tenant_id,
  DATE(s.sale_date AT TIME ZONE 'Asia/Beirut') AS sale_day,
  EXTRACT(DOW FROM s.sale_date AT TIME ZONE 'Asia/Beirut')::INT AS day_of_week,  -- 0=Sun
  EXTRACT(HOUR FROM s.sale_date AT TIME ZONE 'Asia/Beirut')::INT AS close_hour,
  COUNT(*)                    AS order_count,
  SUM(s.subtotal)             AS subtotal_usd,
  SUM(s.discount)             AS discount_usd,
  SUM(s.tax_amount)           AS tax_service_usd,
  SUM(s.total_amount)         AS total_usd,
  AVG(s.total_amount)         AS avg_check_usd,
  SUM(CASE WHEN s.payment_method = 'cash' THEN s.total_amount ELSE 0 END) AS cash_usd,
  SUM(CASE WHEN s.payment_method = 'card' THEN s.total_amount ELSE 0 END) AS card_usd
FROM sales s
WHERE s.source = 'restaurant'
  AND s.payment_status = 'completed'
GROUP BY 1, 2, 3, 4;

-- ── 6. Convenience view: menu item velocity ───────────────────────────────────
-- Tracks item sales frequency for ML item-velocity anomaly detection
CREATE OR REPLACE VIEW restaurant_item_velocity AS
SELECT
  roi.tenant_id,
  roi.product_name,
  DATE(o.paid_at AT TIME ZONE 'Asia/Beirut') AS sale_day,
  SUM(roi.quantity)                AS qty_sold,
  SUM(roi.unit_price * roi.quantity) AS revenue_usd,
  AVG(roi.unit_price)              AS avg_price_usd
FROM restaurant_order_items roi
JOIN table_orders o ON o.id = roi.order_id
WHERE o.status = 'paid'
GROUP BY 1, 2, 3;

COMMENT ON VIEW restaurant_daily_revenue IS 'Beirut-TZ daily revenue roll-up for restaurant analytics and ML forecasting';
COMMENT ON VIEW restaurant_item_velocity IS 'Per-item daily sales velocity for anomaly detection and menu engineering';
