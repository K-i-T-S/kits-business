-- ============================================================
-- Stock Management: Suppliers, Purchase Orders, Stock Transfers
-- Run after 20260618_000005_subscription_tiers.sql
-- ============================================================

-- ── Suppliers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  payment_terms TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_suppliers" ON suppliers
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Purchase Orders ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id       UUID REFERENCES suppliers(id),
  order_number      TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sent','received','cancelled')),
  expected_delivery DATE,
  notes             TEXT,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at       TIMESTAMPTZ
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_purchase_orders" ON purchase_orders
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Purchase Order Items ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  quantity_ordered    INTEGER NOT NULL DEFAULT 0,
  quantity_received   INTEGER NOT NULL DEFAULT 0,
  unit_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost          NUMERIC(12,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED
);

-- ── Stock Transfers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_location  TEXT NOT NULL DEFAULT 'main',
  to_location    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','in_transit','completed','cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_stock_transfers" ON stock_transfers
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Stock Transfer Items ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    INTEGER NOT NULL DEFAULT 0
);

-- ── Add supplier_id to products ────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS suppliers_tenant_idx       ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS purchase_orders_tenant_idx ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS stock_transfers_tenant_idx ON stock_transfers(tenant_id);
