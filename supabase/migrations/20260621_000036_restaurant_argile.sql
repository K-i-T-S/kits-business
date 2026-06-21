-- ============================================================
-- Migration: Restaurant Argile / KDS Station Schema
-- 20260621_000036_restaurant_argile.sql
-- ============================================================

-- KDS station configuration
CREATE TABLE IF NOT EXISTS restaurant_kds_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Assign menu items to KDS stations (many-to-many via category or explicit)
CREATE TABLE IF NOT EXISTS restaurant_item_stations (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES restaurant_kds_stations(id) ON DELETE CASCADE,
  item_identifier TEXT NOT NULL,
  identifier_type TEXT DEFAULT 'category' CHECK (identifier_type IN ('category', 'item')),
  PRIMARY KEY (station_id, item_identifier)
);

-- Argile sessions (one per table when argile is ordered)
CREATE TABLE IF NOT EXISTS restaurant_argile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES restaurant_tables(id),
  table_order_id UUID REFERENCES table_orders(id),
  tobacco_brand TEXT,
  tobacco_flavor TEXT,
  tobacco_flavor_ar TEXT,
  coal_type TEXT DEFAULT 'natural' CHECK (coal_type IN ('natural', 'quick_light')),
  head_size TEXT DEFAULT 'regular' CHECK (head_size IN ('regular', 'jumbo')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  tobacco_refill_count INTEGER DEFAULT 0,
  coal_delivery_count INTEGER DEFAULT 0,
  base_price_usd NUMERIC(10,2) DEFAULT 0,
  refill_price_usd NUMERIC(10,2) DEFAULT 0
);

-- Argile session events (fa7em calls, coal deliveries, tobacco refills)
CREATE TABLE IF NOT EXISTS restaurant_argile_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES restaurant_argile_sessions(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES restaurant_tables(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('fa7em_request', 'coal_delivered', 'tobacco_refill', 'session_closed')),
  notes TEXT,
  handled_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  handled_at TIMESTAMPTZ
);

-- Argile tobacco catalog (flavors the restaurant offers)
CREATE TABLE IF NOT EXISTS restaurant_argile_flavors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  flavor TEXT NOT NULL,
  flavor_ar TEXT,
  base_price_usd NUMERIC(10,2) DEFAULT 0,
  refill_price_usd NUMERIC(10,2) DEFAULT 0,
  ingredient_id UUID,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE restaurant_kds_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_item_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_argile_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_argile_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_argile_flavors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_kds_stations" ON restaurant_kds_stations
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_item_stations" ON restaurant_item_stations
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_argile_sessions" ON restaurant_argile_sessions
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_argile_events" ON restaurant_argile_events
  FOR ALL USING (tenant_id = current_tenant_id());

-- Public insert for fa7em requests (customer from QR menu, no tenant context)
CREATE POLICY "public_insert_argile_events" ON restaurant_argile_events
  FOR INSERT WITH CHECK (event_type = 'fa7em_request');

CREATE POLICY "tenant_argile_flavors" ON restaurant_argile_flavors
  FOR ALL USING (tenant_id = current_tenant_id());
