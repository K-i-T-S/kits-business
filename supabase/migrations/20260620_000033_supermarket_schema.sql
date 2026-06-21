-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 2.4 — Supermarket / Grocery Vertical
-- ─────────────────────────────────────────────────────────────────────────────

-- Grocery departments (per tenant, 8 default seeded departments)
CREATE TABLE IF NOT EXISTS supermarket_departments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  code         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '🛒',
  color        TEXT NOT NULL DEFAULT '#10b981',
  shrinkage_target NUMERIC(5,2) NOT NULL DEFAULT 2.0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Grocery lot tracking: batch + expiry per product
CREATE TABLE IF NOT EXISTS grocery_lots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  department_id       UUID REFERENCES supermarket_departments(id) ON DELETE SET NULL,
  lot_number          TEXT NOT NULL,
  expiry_date         DATE NOT NULL,
  quantity_received   INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_remaining  INTEGER NOT NULL DEFAULT 0 CHECK (quantity_remaining >= 0),
  unit_cost_usd       NUMERIC(10,2) NOT NULL DEFAULT 0,
  received_at         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PLU codes for weight-based produce items
CREATE TABLE IF NOT EXISTS plu_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plu_code      TEXT NOT NULL,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  price_per_kg  NUMERIC(10,2) NOT NULL DEFAULT 0,
  department_id UUID REFERENCES supermarket_departments(id) ON DELETE SET NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, plu_code)
);

-- Bulk / tiered pricing rules
CREATE TABLE IF NOT EXISTS bulk_pricing_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rule_type        TEXT NOT NULL CHECK (rule_type IN ('qty_break', 'bogo', 'case_price')),
  min_quantity     INTEGER NOT NULL DEFAULT 2 CHECK (min_quantity >= 2),
  discount_percent NUMERIC(5,2),
  fixed_price_usd  NUMERIC(10,2),
  free_qty         INTEGER,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Waste / pull-and-destroy records
CREATE TABLE IF NOT EXISTS waste_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_id        UUID REFERENCES grocery_lots(id) ON DELETE SET NULL,
  department_id UUID REFERENCES supermarket_departments(id) ON DELETE SET NULL,
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason        TEXT NOT NULL CHECK (reason IN ('expired', 'damaged', 'shrinkage', 'recall', 'other')),
  cost_usd      NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  recorded_by   TEXT,
  recorded_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- End-of-day till reconciliation
CREATE TABLE IF NOT EXISTS till_reconciliation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  till_name         TEXT NOT NULL,
  cashier_name      TEXT NOT NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  -- LBP denominations (count of each bill)
  lbp_100k_count    INTEGER NOT NULL DEFAULT 0,
  lbp_50k_count     INTEGER NOT NULL DEFAULT 0,
  lbp_20k_count     INTEGER NOT NULL DEFAULT 0,
  lbp_10k_count     INTEGER NOT NULL DEFAULT 0,
  lbp_5k_count      INTEGER NOT NULL DEFAULT 0,
  lbp_1k_count      INTEGER NOT NULL DEFAULT 0,
  -- USD denominations
  usd_100_count     INTEGER NOT NULL DEFAULT 0,
  usd_50_count      INTEGER NOT NULL DEFAULT 0,
  usd_20_count      INTEGER NOT NULL DEFAULT 0,
  usd_10_count      INTEGER NOT NULL DEFAULT 0,
  usd_5_count       INTEGER NOT NULL DEFAULT 0,
  usd_1_count       INTEGER NOT NULL DEFAULT 0,
  -- Electronic payments received
  whish_amount_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
  card_amount_usd   NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- System expected totals
  expected_cash_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  expected_cash_lbp NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Safe drop to safe at end of shift
  safe_drop_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'flagged')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS Policies ──────────────────────────────────────────────────────────────

ALTER TABLE supermarket_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE plu_codes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_pricing_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE till_reconciliation     ENABLE ROW LEVEL SECURITY;

-- supermarket_departments
CREATE POLICY "dept_tenant_select" ON supermarket_departments FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "dept_tenant_insert" ON supermarket_departments FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "dept_tenant_update" ON supermarket_departments FOR UPDATE USING (tenant_id = current_tenant_id());
CREATE POLICY "dept_tenant_delete" ON supermarket_departments FOR DELETE USING (tenant_id = current_tenant_id());

-- grocery_lots
CREATE POLICY "lots_tenant_select" ON grocery_lots FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "lots_tenant_insert" ON grocery_lots FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "lots_tenant_update" ON grocery_lots FOR UPDATE USING (tenant_id = current_tenant_id());
CREATE POLICY "lots_tenant_delete" ON grocery_lots FOR DELETE USING (tenant_id = current_tenant_id());

-- plu_codes
CREATE POLICY "plu_tenant_select" ON plu_codes FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "plu_tenant_insert" ON plu_codes FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "plu_tenant_update" ON plu_codes FOR UPDATE USING (tenant_id = current_tenant_id());
CREATE POLICY "plu_tenant_delete" ON plu_codes FOR DELETE USING (tenant_id = current_tenant_id());

-- bulk_pricing_rules
CREATE POLICY "bulk_tenant_select" ON bulk_pricing_rules FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "bulk_tenant_insert" ON bulk_pricing_rules FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "bulk_tenant_update" ON bulk_pricing_rules FOR UPDATE USING (tenant_id = current_tenant_id());
CREATE POLICY "bulk_tenant_delete" ON bulk_pricing_rules FOR DELETE USING (tenant_id = current_tenant_id());

-- waste_records
CREATE POLICY "waste_tenant_select" ON waste_records FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "waste_tenant_insert" ON waste_records FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "waste_tenant_update" ON waste_records FOR UPDATE USING (tenant_id = current_tenant_id());
CREATE POLICY "waste_tenant_delete" ON waste_records FOR DELETE USING (tenant_id = current_tenant_id());

-- till_reconciliation
CREATE POLICY "till_tenant_select" ON till_reconciliation FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "till_tenant_insert" ON till_reconciliation FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "till_tenant_update" ON till_reconciliation FOR UPDATE USING (tenant_id = current_tenant_id());
CREATE POLICY "till_tenant_delete" ON till_reconciliation FOR DELETE USING (tenant_id = current_tenant_id());
