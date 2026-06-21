-- ============================================================
-- 20260621_000041_restaurant_views.sql
-- Depends on: 20260621_000040_restaurant_bridge.sql
--
-- Adds:
--   1. restaurant_order_items.product_id — direct FK to products
--      (complement to menu_item_id from migration 40; for direct stock tracking)
--   2. restaurant_daily_revenue view — Beirut-TZ daily revenue rollup
--   3. restaurant_item_velocity view — per-item daily qty for ML
--   4. finalize_restaurant_order() — idempotent sale-creation for already-closed
--      orders (e.g. backfilling history). Primary close path uses fn_close_restaurant_bill.
-- ============================================================

-- 1. Direct product FK on order items (complement to menu_item_id)
ALTER TABLE restaurant_order_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_product_id
  ON restaurant_order_items(product_id) WHERE product_id IS NOT NULL;

-- 2. Daily revenue view (Beirut timezone, restaurant orders only)
CREATE OR REPLACE VIEW restaurant_daily_revenue AS
SELECT
  s.tenant_id,
  DATE(s.sale_date AT TIME ZONE 'Asia/Beirut') AS sale_day,
  EXTRACT(DOW FROM s.sale_date AT TIME ZONE 'Asia/Beirut')::INT AS day_of_week,
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

COMMENT ON VIEW restaurant_daily_revenue IS
  'Beirut-TZ daily revenue roll-up for restaurant analytics and ML forecasting';

-- 3. Item velocity view (for menu engineering and anomaly detection)
CREATE OR REPLACE VIEW restaurant_item_velocity AS
SELECT
  roi.tenant_id,
  roi.product_name,
  DATE(o.paid_at AT TIME ZONE 'Asia/Beirut') AS sale_day,
  SUM(roi.quantity)                            AS qty_sold,
  SUM(roi.unit_price * roi.quantity)           AS revenue_usd,
  AVG(roi.unit_price)                          AS avg_price_usd
FROM restaurant_order_items roi
JOIN table_orders o ON o.id = roi.order_id
WHERE o.status = 'paid'
GROUP BY 1, 2, 3;

COMMENT ON VIEW restaurant_item_velocity IS
  'Per-item daily sales velocity for anomaly detection and menu engineering';

-- 4. finalize_restaurant_order — idempotent, for already-closed orders
--    Primary bill-close path should use fn_close_restaurant_bill() instead.
CREATE OR REPLACE FUNCTION finalize_restaurant_order(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order     table_orders%ROWTYPE;
  v_subtotal  NUMERIC(12,2);
  v_discount  NUMERIC(12,2);
  v_service   NUMERIC(12,2);
  v_tax       NUMERIC(12,2);
  v_tip       NUMERIC(12,2);
  v_total     NUMERIC(12,2);
  v_sale_id   UUID;
BEGIN
  SELECT * INTO v_order FROM table_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found: %', p_order_id;
  END IF;
  IF v_order.tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Idempotent: return existing sale if already finalized
  SELECT id INTO v_sale_id FROM sales WHERE table_order_id = p_order_id LIMIT 1;
  IF FOUND THEN RETURN v_sale_id; END IF;

  SELECT COALESCE(SUM(unit_price * quantity), 0)
  INTO v_subtotal FROM restaurant_order_items WHERE order_id = p_order_id;

  v_discount := v_subtotal * COALESCE(v_order.discount_pct, 0) / 100.0;
  v_service  := (v_subtotal - v_discount) * COALESCE(v_order.service_charge_pct, 10) / 100.0;
  v_tax      := (v_subtotal - v_discount + v_service) * COALESCE(v_order.vat_pct, 11) / 100.0;
  v_tip      := COALESCE(v_order.tip_amount_usd, 0);
  v_total    := v_subtotal - v_discount + v_service + v_tax + v_tip;

  INSERT INTO sales (
    tenant_id, employee_id, subtotal, discount, tax_amount, total_amount,
    payment_method, payment_status, notes, sale_date, table_order_id, source
  ) VALUES (
    v_order.tenant_id,
    v_order.waiter_id,
    v_subtotal, v_discount, v_service + v_tax, v_total,
    COALESCE(v_order.payment_method, 'cash'),
    'completed',
    'Table ' || COALESCE(
      (SELECT number::TEXT FROM restaurant_tables WHERE id = v_order.table_id), '?'
    ),
    COALESCE(v_order.paid_at, now()),
    p_order_id, 'restaurant'
  ) RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION finalize_restaurant_order(UUID) TO authenticated;

COMMENT ON FUNCTION finalize_restaurant_order IS
  'Idempotent — creates a sales record for an already-closed table_order. For live bill-close use fn_close_restaurant_bill() instead.';
