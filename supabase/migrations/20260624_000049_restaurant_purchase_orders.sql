-- ============================================================
-- Restaurant Purchase Orders
-- Ingredient-level POs linked to restaurant_ingredient_suppliers
-- Run after 20260621_000037_restaurant_recipes.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES restaurant_ingredient_suppliers(id) ON DELETE SET NULL,
  order_number    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  expected_date   DATE,
  notes           TEXT,
  total_estimated NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at     TIMESTAMPTZ
);

ALTER TABLE restaurant_purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_restaurant_purchase_orders" ON restaurant_purchase_orders
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── PO Items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_purchase_order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES restaurant_purchase_orders(id) ON DELETE CASCADE,
  ingredient_id       UUID NOT NULL REFERENCES restaurant_ingredients(id) ON DELETE CASCADE,
  quantity_ordered    NUMERIC(12,4) NOT NULL DEFAULT 0,
  quantity_received   NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit_cost           NUMERIC(12,4) NOT NULL DEFAULT 0,
  notes               TEXT
);

-- Items inherit tenant isolation via purchase_order_id → restaurant_purchase_orders
ALTER TABLE restaurant_purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_restaurant_po_items" ON restaurant_purchase_order_items
  USING (
    purchase_order_id IN (
      SELECT id FROM restaurant_purchase_orders WHERE tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    purchase_order_id IN (
      SELECT id FROM restaurant_purchase_orders WHERE tenant_id = current_tenant_id()
    )
  );

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS restaurant_po_tenant_idx      ON restaurant_purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS restaurant_po_supplier_idx    ON restaurant_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS restaurant_po_status_idx      ON restaurant_purchase_orders(status);
CREATE INDEX IF NOT EXISTS restaurant_po_items_order_idx ON restaurant_purchase_order_items(purchase_order_id);
