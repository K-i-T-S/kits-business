-- Quick fix for RLS policies - make them more permissive during development
-- Run this in Supabase SQL Editor

-- Drop restrictive policies and create simpler ones
DROP POLICY IF EXISTS "Users can view tenants in their tenant" ON tenants;
DROP POLICY IF EXISTS "Users can manage tenants in their tenant" ON tenants;
DROP POLICY IF EXISTS "Users can view tenant_users in their tenant" ON tenant_users;
DROP POLICY IF EXISTS "Users can manage tenant_users in their tenant" ON tenant_users;

-- Create simpler policies for development
CREATE POLICY "Enable read access for all authenticated users" ON tenants
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for all authenticated users" ON tenants
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for all authenticated users" ON tenants
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for tenant_users" ON tenant_users
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for tenant_users" ON tenant_users
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for tenant_users" ON tenant_users
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Also fix base table policies
DROP POLICY IF EXISTS "Users can view products" ON products;
DROP POLICY IF EXISTS "Users can manage products" ON products;
DROP POLICY IF EXISTS "Users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can manage customers" ON customers;
DROP POLICY IF EXISTS "Users can view sales" ON sales;
DROP POLICY IF EXISTS "Users can manage sales" ON sales;
DROP POLICY IF EXISTS "Users can view employees" ON employees;
DROP POLICY IF EXISTS "Users can manage employees" ON employees;

CREATE POLICY "Enable read access for products" ON products
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable manage access for products" ON products
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for customers" ON customers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable manage access for customers" ON customers
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for sales" ON sales
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable manage access for sales" ON sales
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for employees" ON employees
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable manage access for employees" ON employees
    FOR ALL USING (auth.role() = 'authenticated');
