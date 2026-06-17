-- Create tenant schema for multi-tenancy
-- This migration adds tenant support to the existing database

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}',
    subscription_plan TEXT DEFAULT 'free',
    is_active BOOLEAN DEFAULT true
);

-- Create tenant_users table to link users with tenants and roles
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, user_id)
);

-- Add tenant_id to existing tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_id ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Create function to get current tenant_id from user context
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    tenant_record RECORD;
BEGIN
    -- Get current user ID from auth
    current_user_id := auth.uid();
    
    -- Get tenant_id from tenant_users table
    SELECT tenant_id INTO tenant_record
    FROM tenant_users
    WHERE user_id = current_user_id AND is_active = true
    LIMIT 1;
    
    IF tenant_record IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN tenant_record.tenant_id;
END;
$$;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    role_record RECORD;
BEGIN
    -- Get current user ID from auth
    current_user_id := auth.uid();
    
    -- Get role from tenant_users table
    SELECT role INTO role_record
    FROM tenant_users
    WHERE user_id = current_user_id AND is_active = true
    LIMIT 1;
    
    IF role_record IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN role_record.role;
END;
$$;

-- RLS Policies for tenants table
CREATE POLICY "Users can view their own tenant" ON tenants
FOR SELECT USING (id = current_tenant_id());

CREATE POLICY "Users can update their own tenant" ON tenants
FOR UPDATE USING (id = current_tenant_id());

-- RLS Policies for tenant_users table
CREATE POLICY "Users can view their tenant membership" ON tenant_users
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners can manage tenant users" ON tenant_users
FOR ALL USING (
    tenant_id = current_tenant_id() 
    AND current_user_role() = 'owner'
);

-- RLS Policies for products table
CREATE POLICY "Users can view their tenant products" ON products
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners and managers can manage products" ON products
FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for sales table
CREATE POLICY "Users can view their tenant sales" ON sales
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "All staff can create sales" ON sales
FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager', 'cashier')
);

CREATE POLICY "Owners and managers can update sales" ON sales
FOR UPDATE USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

CREATE POLICY "Owners can delete sales" ON sales
FOR DELETE USING (
    tenant_id = current_tenant_id()
    AND current_user_role() = 'owner'
);

-- RLS Policies for customers table
CREATE POLICY "Users can view their tenant customers" ON customers
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners and managers can manage customers" ON customers
FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

-- RLS Policies for employees table
CREATE POLICY "Users can view their tenant employees" ON employees
FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "Owners and managers can manage employees" ON employees
FOR ALL USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'manager')
);

-- Create a default tenant for existing data
INSERT INTO tenants (name, slug, settings)
VALUES ('Default Store', 'default-store', '{}')
ON CONFLICT (slug) DO NOTHING;

-- Get the default tenant ID
DO $$
DECLARE
    default_tenant_id UUID;
BEGIN
    SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'default-store';
    
    -- Update existing records to belong to default tenant
    UPDATE products SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE sales SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE customers SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    UPDATE employees SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    
    -- Create tenant_users entries for existing auth users
    INSERT INTO tenant_users (tenant_id, user_id, role)
    SELECT default_tenant_id, id, 'owner'
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM tenant_users)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
END $$;
