-- ============================================================
-- 20260621_000035_restaurant_order_flow.sql
-- Order Flow Engine: pending orders, bill splits, settings
-- ============================================================

-- Extend table_orders with order flow configuration
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS order_flow TEXT DEFAULT 'waiter_confirm' CHECK (order_flow IN ('direct', 'waiter_confirm'));
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'waiter_only' CHECK (payment_mode IN ('customer_can_pay', 'waiter_only'));
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS service_charge_pct NUMERIC(5,2) DEFAULT 10;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS vat_pct NUMERIC(5,2) DEFAULT 11;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS tip_amount_usd NUMERIC(10,2) DEFAULT 0;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Pending customer orders (customer ordered from QR menu, waiting waiter confirmation)
CREATE TABLE IF NOT EXISTS restaurant_pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES restaurant_tables(id),
  table_order_id UUID REFERENCES table_orders(id),
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES employees(id) ON DELETE SET NULL
);

-- Split bill tracking
CREATE TABLE IF NOT EXISTS restaurant_bill_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES table_orders(id) ON DELETE CASCADE,
  split_type TEXT NOT NULL CHECK (split_type IN ('by_seat', 'by_item', 'equal')),
  split_count INTEGER DEFAULT 1,
  splits JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Restaurant settings per tenant
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  default_order_flow TEXT DEFAULT 'waiter_confirm' CHECK (default_order_flow IN ('direct', 'waiter_confirm')),
  default_payment_mode TEXT DEFAULT 'waiter_only' CHECK (default_payment_mode IN ('customer_can_pay', 'waiter_only')),
  service_charge_enabled BOOLEAN DEFAULT true,
  service_charge_pct NUMERIC(5,2) DEFAULT 10,
  vat_enabled BOOLEAN DEFAULT true,
  vat_pct NUMERIC(5,2) DEFAULT 11,
  tip_pool_enabled BOOLEAN DEFAULT false,
  slow_service_threshold_minutes INTEGER DEFAULT 15,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE restaurant_pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'restaurant_pending_orders' AND policyname = 'tenant_pending_orders'
  ) THEN
    CREATE POLICY "tenant_pending_orders" ON restaurant_pending_orders FOR ALL USING (tenant_id = current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'restaurant_bill_splits' AND policyname = 'tenant_bill_splits'
  ) THEN
    CREATE POLICY "tenant_bill_splits" ON restaurant_bill_splits FOR ALL USING (tenant_id = current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'restaurant_settings' AND policyname = 'tenant_restaurant_settings'
  ) THEN
    CREATE POLICY "tenant_restaurant_settings" ON restaurant_settings FOR ALL USING (tenant_id = current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'restaurant_pending_orders' AND policyname = 'public_insert_pending_orders'
  ) THEN
    -- Public insert for QR menu order submission
    CREATE POLICY "public_insert_pending_orders" ON restaurant_pending_orders FOR INSERT WITH CHECK (true);
  END IF;
END $$;
