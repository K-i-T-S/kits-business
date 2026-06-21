-- Restaurant branches (extends the existing locations concept for restaurants)
CREATE TABLE IF NOT EXISTS restaurant_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  manager_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Delivery platform integrations
CREATE TABLE IF NOT EXISTS restaurant_delivery_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES restaurant_branches(id),
  platform TEXT NOT NULL CHECK (platform IN ('toters', 'zomato', 'talabat', 'careem_food')),
  is_active BOOLEAN DEFAULT true,
  webhook_secret TEXT,
  external_restaurant_id TEXT,
  auto_accept BOOLEAN DEFAULT false,
  prep_time_minutes INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, branch_id, platform)
);

-- Delivery orders (injected from Toters/Zomato etc.)
CREATE TABLE IF NOT EXISTS restaurant_delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES restaurant_branches(id),
  platform TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal_usd NUMERIC(10,2) DEFAULT 0,
  delivery_fee_usd NUMERIC(10,2) DEFAULT 0,
  total_usd NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled')),
  estimated_pickup_at TIMESTAMPTZ,
  table_order_id UUID REFERENCES table_orders(id),
  notes TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  UNIQUE(tenant_id, platform, external_order_id)
);

-- Branch-level performance metrics cache (refreshed daily)
CREATE TABLE IF NOT EXISTS restaurant_branch_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES restaurant_branches(id),
  metric_date DATE NOT NULL,
  total_revenue_usd NUMERIC(12,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_covers INTEGER DEFAULT 0,
  avg_ticket_usd NUMERIC(10,2) DEFAULT 0,
  food_cost_pct NUMERIC(5,2),
  table_turnover_rate NUMERIC(5,2),
  avg_service_minutes NUMERIC(8,2),
  argile_revenue_usd NUMERIC(10,2) DEFAULT 0,
  delivery_revenue_usd NUMERIC(10,2) DEFAULT 0,
  customer_rating_avg NUMERIC(3,2),
  UNIQUE(branch_id, metric_date)
);

-- RLS
ALTER TABLE restaurant_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_delivery_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_branch_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_branches" ON restaurant_branches FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_delivery_integrations" ON restaurant_delivery_integrations FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_delivery_orders" ON restaurant_delivery_orders FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_branch_metrics" ON restaurant_branch_metrics FOR ALL USING (tenant_id = current_tenant_id());

-- Webhook endpoint function (called from Edge Function)
CREATE OR REPLACE FUNCTION inject_delivery_order(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_platform TEXT,
  p_external_order_id TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_total_usd NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID;
  v_table_order_id UUID;
BEGIN
  -- Create the delivery order record
  INSERT INTO restaurant_delivery_orders (
    tenant_id, branch_id, platform, external_order_id, customer_name, items, total_usd, notes, status
  ) VALUES (
    p_tenant_id, p_branch_id, p_platform, p_external_order_id, p_customer_name, p_items, p_total_usd, p_notes, 'new'
  ) ON CONFLICT (tenant_id, platform, external_order_id) DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN RETURN NULL; END IF;

  -- Create a corresponding table_order for KDS routing (delivery orders appear in KDS)
  INSERT INTO table_orders (tenant_id, status, notes, current_course)
  VALUES (p_tenant_id, 'open', 'DELIVERY: ' || p_platform || ' #' || p_external_order_id, 'mains')
  RETURNING id INTO v_table_order_id;

  UPDATE restaurant_delivery_orders SET table_order_id = v_table_order_id WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;
