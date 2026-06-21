-- Restaurant Intelligence Layer
-- Sprint: analytics, shifts, slow alerts, EOD reports, argile tracking, feedback
-- Safe to re-run (uses IF NOT EXISTS)

-- ── restaurant_shifts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'evening', 'night', 'split', 'full')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  is_closed BOOLEAN DEFAULT false,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── restaurant_shift_assignments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES restaurant_shifts(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('waiter','chef','sous_chef','cashier','busboy','argile','manager','host')),
  section TEXT,
  station TEXT,
  clocked_in_at TIMESTAMPTZ,
  clocked_out_at TIMESTAMPTZ,
  UNIQUE(shift_id, employee_id)
);

-- ── restaurant_slow_alerts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_slow_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES restaurant_tables(id),
  order_id UUID REFERENCES table_orders(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('no_order_placed','order_not_served','table_not_cleared','payment_waiting','argile_not_serviced')),
  minutes_elapsed INTEGER,
  acknowledged_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── restaurant_table_feedback ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_table_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES restaurant_tables(id),
  order_id UUID REFERENCES table_orders(id),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
  service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
  comment TEXT,
  waiter_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- ── restaurant_eod_reports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_eod_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  total_revenue_usd NUMERIC(12,2) DEFAULT 0,
  total_covers INTEGER DEFAULT 0,
  avg_ticket_usd NUMERIC(10,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  top_items JSONB DEFAULT '[]',
  waiter_performance JSONB DEFAULT '[]',
  argile_revenue_usd NUMERIC(12,2) DEFAULT 0,
  service_charge_usd NUMERIC(12,2) DEFAULT 0,
  vat_usd NUMERIC(12,2) DEFAULT 0,
  tips_collected_usd NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, report_date)
);

-- ── restaurant_argile_sessions ───────────────────────────────────────────────
-- Argile (shisha/hookah) sessions linked to tables
CREATE TABLE IF NOT EXISTS restaurant_argile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  order_id UUID REFERENCES table_orders(id) ON DELETE SET NULL,
  tobacco_flavor TEXT,
  price_usd NUMERIC(10,2) DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  fa7em_assigned UUID REFERENCES employees(id) ON DELETE SET NULL,
  fa7em_response_minutes INTEGER
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE restaurant_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_slow_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_table_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_eod_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_argile_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_shifts" ON restaurant_shifts FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_shift_assignments" ON restaurant_shift_assignments FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_slow_alerts" ON restaurant_slow_alerts FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_table_feedback" ON restaurant_table_feedback FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_eod_reports" ON restaurant_eod_reports FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_argile_sessions" ON restaurant_argile_sessions FOR ALL USING (tenant_id = current_tenant_id());

-- Allow public (QR-code) feedback submissions without needing tenant context
CREATE POLICY "public_insert_feedback" ON restaurant_table_feedback FOR INSERT WITH CHECK (true);

-- ── Extend table_orders with additional analytics columns ────────────────────
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10,2) DEFAULT 0;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS tips NUMERIC(10,2) DEFAULT 0;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS covers INTEGER DEFAULT 1;
