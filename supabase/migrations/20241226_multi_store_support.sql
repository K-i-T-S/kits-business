-- Multi-Store Support Migration
-- Adds store management within each tenant

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    phone TEXT,
    email TEXT,
    manager_id UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add store_id to existing tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- Update existing records to use default store
UPDATE stores SET code = 'DEFAULT-' || LEFT(id::text, 8) WHERE code IS NULL OR code = '';

-- Create default store for each tenant
INSERT INTO stores (tenant_id, name, code, address)
SELECT 
    id,
    name || ' - Main Store',
    'MAIN-' || LEFT(id::text, 8),
    'Main business location'
FROM tenants 
WHERE id NOT IN (SELECT DISTINCT tenant_id FROM stores);

-- Update existing records to point to default store
UPDATE products SET store_id = (
    SELECT s.id FROM stores s 
    WHERE s.tenant_id = products.tenant_id 
    AND s.code LIKE 'MAIN-%'
    LIMIT 1
) WHERE store_id IS NULL;

UPDATE sales SET store_id = (
    SELECT s.id FROM stores s 
    WHERE s.tenant_id = sales.tenant_id 
    AND s.code LIKE 'MAIN-%'
    LIMIT 1
) WHERE store_id IS NULL;

UPDATE customers SET store_id = (
    SELECT s.id FROM stores s 
    WHERE s.tenant_id = customers.tenant_id 
    AND s.code LIKE 'MAIN-%'
    LIMIT 1
) WHERE store_id IS NULL;

UPDATE employees SET store_id = (
    SELECT s.id FROM stores s 
    WHERE s.tenant_id = employees.tenant_id 
    AND s.code LIKE 'MAIN-%'
    LIMIT 1
) WHERE store_id IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_tenant_id ON stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stores_code ON stores(code);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_employees_store_id ON employees(store_id);

-- Enable RLS on stores table
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- RLS policies for stores
CREATE POLICY "Users can view stores in their tenant" ON stores
    FOR SELECT USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY "Owners and managers can manage stores" ON stores
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND current_setting('app.current_user_role', true) IN ('owner', 'manager')
    );

-- Update existing RLS policies to include store filtering
DROP POLICY IF EXISTS "Users can view products in their tenant" ON products;
CREATE POLICY "Users can view products in their tenant and store" ON products
    FOR SELECT USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND (store_id IS NULL OR store_id = current_setting('app.current_store_id', true)::UUID)
    );

DROP POLICY IF EXISTS "Users can manage products in their tenant" ON products;
CREATE POLICY "Users can manage products in their tenant and store" ON products
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND (store_id IS NULL OR store_id = current_setting('app.current_store_id', true)::UUID)
        AND current_setting('app.current_user_role', true) IN ('owner', 'manager')
    );

-- Similar updates for other tables
DROP POLICY IF EXISTS "Users can view sales in their tenant" ON sales;
CREATE POLICY "Users can view sales in their tenant and store" ON sales
    FOR SELECT USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND (store_id IS NULL OR store_id = current_setting('app.current_store_id', true)::UUID)
    );

DROP POLICY IF EXISTS "Users can manage sales in their tenant" ON sales;
CREATE POLICY "Users can manage sales in their tenant and store" ON sales
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND (store_id IS NULL OR store_id = current_setting('app.current_store_id', true)::UUID)
    );

-- Store management functions
CREATE OR REPLACE FUNCTION create_store(
    store_name TEXT,
    store_code TEXT,
    store_address TEXT DEFAULT NULL,
    store_phone TEXT DEFAULT NULL,
    store_email TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    new_store_id UUID;
BEGIN
    INSERT INTO stores (tenant_id, name, code, address, phone, email)
    VALUES (
        current_setting('app.current_tenant_id', true)::UUID,
        store_name,
        store_code,
        store_address,
        store_phone,
        store_email
    ) RETURNING id INTO new_store_id;
    
    RETURN new_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_current_store() RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_store_id', true)::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_store_context(store_id UUID) RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_store_id', store_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Store user assignments
CREATE TABLE IF NOT EXISTS store_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('manager', 'cashier', 'viewer')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(store_id, user_id)
);

-- Enable RLS on store_users
ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view store assignments in their tenant" ON store_users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM stores s 
            WHERE s.id = store_users.store_id 
            AND s.tenant_id = current_setting('app.current_tenant_id', true)::UUID
        )
    );

CREATE POLICY "Managers can manage store assignments" ON store_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM stores s 
            WHERE s.id = store_users.store_id 
            AND s.tenant_id = current_setting('app.current_tenant_id', true)::UUID
        ) AND current_setting('app.current_user_role', true) IN ('owner', 'manager')
    );
