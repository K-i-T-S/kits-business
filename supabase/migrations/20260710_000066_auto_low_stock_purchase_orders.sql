-- ============================================================
-- Migration: Automatic Low-Stock Purchase Order Generation
--
-- Closes the last Tier 2 roadmap item. RecipeInventory.tsx already had
-- a manual "Auto-Create PO" button, but it dumped every shortage into
-- one PO with no supplier and required a staff member to be looking at
-- this exact screen. This adds: (1) supplier-grouped generation shared
-- by both the manual button and a new nightly unattended sweep, and
-- (2) duplicate-safe exclusion of ingredients already on an open PO.
--
-- Full design: docs/superpowers/specs/2026-07-10-auto-low-stock-purchase-orders-design.md
-- ============================================================

CREATE OR REPLACE FUNCTION fn_generate_low_stock_pos_for_tenant(p_tenant_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_supplier RECORD;
  v_po_id UUID;
  v_po_count INT := 0;
  v_seq INT := 0;
BEGIN
  FOR v_supplier IN
    SELECT DISTINCT supplier_id
    FROM restaurant_ingredients
    WHERE tenant_id = p_tenant_id
      AND is_active = true
      AND par_level > 0
      AND current_stock < par_level
      AND id NOT IN (
        SELECT poi.ingredient_id
        FROM restaurant_purchase_order_items poi
        JOIN restaurant_purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.tenant_id = p_tenant_id AND po.status IN ('draft', 'ordered')
      )
  LOOP
    v_seq := v_seq + 1;

    INSERT INTO restaurant_purchase_orders (tenant_id, supplier_id, order_number, status, notes, total_estimated)
    SELECT
      p_tenant_id,
      v_supplier.supplier_id,
      'PO-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || lpad((extract(milliseconds FROM clock_timestamp())::int + v_seq)::text, 4, '0'),
      'draft',
      'Auto-generated from low stock alert',
      COALESCE(SUM(GREATEST(ri.par_level - ri.current_stock, 0) * ri.cost_per_unit), 0)
    FROM restaurant_ingredients ri
    WHERE ri.tenant_id = p_tenant_id
      AND ri.is_active = true
      AND ri.par_level > 0
      AND ri.current_stock < ri.par_level
      AND ri.supplier_id IS NOT DISTINCT FROM v_supplier.supplier_id
      AND ri.id NOT IN (
        SELECT poi.ingredient_id
        FROM restaurant_purchase_order_items poi
        JOIN restaurant_purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.tenant_id = p_tenant_id AND po.status IN ('draft', 'ordered')
      )
    RETURNING id INTO v_po_id;

    INSERT INTO restaurant_purchase_order_items (purchase_order_id, ingredient_id, quantity_ordered, quantity_received, unit_cost)
    SELECT
      v_po_id,
      ri.id,
      GREATEST(ri.par_level - ri.current_stock, 0),
      0,
      ri.cost_per_unit
    FROM restaurant_ingredients ri
    WHERE ri.tenant_id = p_tenant_id
      AND ri.is_active = true
      AND ri.par_level > 0
      AND ri.current_stock < ri.par_level
      AND ri.supplier_id IS NOT DISTINCT FROM v_supplier.supplier_id
      AND ri.id NOT IN (
        SELECT poi.ingredient_id
        FROM restaurant_purchase_order_items poi
        JOIN restaurant_purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.tenant_id = p_tenant_id AND po.status IN ('draft', 'ordered')
      );

    v_po_count := v_po_count + 1;
  END LOOP;

  RETURN v_po_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_generate_low_stock_pos_for_tenant(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION generate_low_stock_purchase_orders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id UUID := current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN fn_generate_low_stock_pos_for_tenant(v_tenant_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_low_stock_purchase_orders() FROM anon;

CREATE OR REPLACE FUNCTION fn_generate_low_stock_pos_all_tenants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN SELECT id FROM tenants WHERE is_active = true LOOP
    PERFORM fn_generate_low_stock_pos_for_tenant(v_tenant.id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_generate_low_stock_pos_all_tenants() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'nightly-low-stock-po-generation',
  '0 5 * * *',
  $$SELECT fn_generate_low_stock_pos_all_tenants()$$
);
