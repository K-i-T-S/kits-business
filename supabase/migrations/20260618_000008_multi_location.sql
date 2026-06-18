-- Multi-Location Support
-- Adds locations table and per-location stock tracking

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_main BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_locations" ON locations
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Per-location stock tracking (separate from products.stock_quantity which = total)
CREATE TABLE IF NOT EXISTS location_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, product_id)
);

ALTER TABLE location_stock ENABLE ROW LEVEL SECURITY;
-- Location stock is readable/writable if user can access the tenant
CREATE POLICY "tenant_location_stock" ON location_stock
  USING (EXISTS (
    SELECT 1 FROM locations l WHERE l.id = location_id AND l.tenant_id = current_tenant_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM locations l WHERE l.id = location_id AND l.tenant_id = current_tenant_id()
  ));

CREATE INDEX IF NOT EXISTS locations_tenant_idx ON locations(tenant_id);
CREATE INDEX IF NOT EXISTS location_stock_location_idx ON location_stock(location_id);
CREATE INDEX IF NOT EXISTS location_stock_product_idx ON location_stock(product_id);
