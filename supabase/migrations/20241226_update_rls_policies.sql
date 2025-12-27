-- Add tenant context setting function for RLS
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Set the tenant context for the current session
    PERFORM set_config('app.current_tenant_id', tenant_id::TEXT, true);
END;
$$;

-- Update existing RLS policies to use the tenant context
DROP POLICY IF EXISTS "Users can view their tenant products" ON products;
CREATE POLICY "Users can view their tenant products" ON products
FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

DROP POLICY IF EXISTS "Owners and managers can manage products" ON products;
CREATE POLICY "Owners and managers can manage products" ON products
FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
    AND current_user_role() IN ('owner', 'manager')
);

-- Update other table policies similarly
DROP POLICY IF EXISTS "Users can view their tenant sales" ON sales;
CREATE POLICY "Users can view their tenant sales" ON sales
FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

DROP POLICY IF EXISTS "All staff can create sales" ON sales;
CREATE POLICY "All staff can create sales" ON sales
FOR INSERT WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
    AND current_user_role() IN ('owner', 'manager', 'cashier')
);

DROP POLICY IF EXISTS "Owners and managers can update sales" ON sales;
CREATE POLICY "Owners and managers can update sales" ON sales
FOR UPDATE USING (
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
    AND current_user_role() IN ('owner', 'manager')
);

DROP POLICY IF EXISTS "Owners can delete sales" ON sales;
CREATE POLICY "Owners can delete sales" ON sales
FOR DELETE USING (
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
    AND current_user_role() = 'owner'
);

-- Customers table policies
DROP POLICY IF EXISTS "Users can view their tenant customers" ON customers;
CREATE POLICY "Users can view their tenant customers" ON customers
FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

DROP POLICY IF EXISTS "Owners and managers can manage customers" ON customers;
CREATE POLICY "Owners and managers can manage customers" ON customers
FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
    AND current_user_role() IN ('owner', 'manager')
);

-- Employees table policies
DROP POLICY IF EXISTS "Users can view their tenant employees" ON employees;
CREATE POLICY "Users can view their tenant employees" ON employees
FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

DROP POLICY IF EXISTS "Owners and managers can manage employees" ON employees;
CREATE POLICY "Owners and managers can manage employees" ON employees
FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
    AND current_user_role() IN ('owner', 'manager')
);
