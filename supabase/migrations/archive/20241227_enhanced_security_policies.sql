-- Enhanced Security Policies Migration
-- Implements proper RLS policies with tenant isolation and role-based access

-- First, drop all existing permissive policies
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON tenants;
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON tenants;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON tenants;
DROP POLICY IF EXISTS "Enable read access for tenant_users" ON tenant_users;
DROP POLICY IF EXISTS "Enable insert for tenant_users" ON tenant_users;
DROP POLICY IF EXISTS "Enable update for tenant_users" ON tenant_users;
DROP POLICY IF EXISTS "Enable read access for products" ON products;
DROP POLICY IF EXISTS "Enable manage access for products" ON products;
DROP POLICY IF EXISTS "Enable read access for customers" ON customers;
DROP POLICY IF EXISTS "Enable manage access for customers" ON customers;
DROP POLICY IF EXISTS "Enable read access for sales" ON sales;
DROP POLICY IF EXISTS "Enable manage access for sales" ON sales;
DROP POLICY IF EXISTS "Enable read access for employees" ON employees;
DROP POLICY IF EXISTS "Enable manage access for employees" ON employees;

-- Enhanced function to get current tenant context with better error handling
CREATE OR REPLACE FUNCTION get_current_tenant_context()
RETURNS TABLE(tenant_id UUID, user_id UUID, user_role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Get current user ID from auth
    RETURN QUERY
    SELECT 
        tu.tenant_id,
        au.id as user_id,
        tu.role as user_role
    FROM auth.users au
    JOIN tenant_users tu ON au.id = tu.user_id
    WHERE au.id = auth.uid()
      AND tu.is_active = true
      AND au.id IS NOT NULL
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Return empty result if no valid tenant context
        RETURN;
    END IF;
END;
$$;

-- Enhanced role verification function with security checks
CREATE OR REPLACE FUNCTION verify_role_permission(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_context RECORD;
    valid_roles TEXT[] := ARRAY['owner', 'manager', 'cashier', 'viewer'];
BEGIN
    -- Validate required role
    IF NOT (required_role = ANY(valid_roles)) THEN
        RAISE EXCEPTION 'Invalid required role: %', required_role;
    END IF;
    
    -- Get current user context
    SELECT * INTO user_context FROM get_current_tenant_context();
    
    IF user_context IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Set tenant context for RLS
    PERFORM set_config('app.current_tenant_id', user_context.tenant_id::TEXT, true);
    PERFORM set_config('app.current_user_id', user_context.user_id::TEXT, true);
    PERFORM set_config('app.current_user_role', user_context.user_role, true);
    
    -- Check role hierarchy
    IF required_role = 'viewer' THEN
        RETURN user_context.user_role IN ('owner', 'manager', 'cashier', 'viewer');
    ELSIF required_role = 'cashier' THEN
        RETURN user_context.user_role IN ('owner', 'manager', 'cashier');
    ELSIF required_role = 'manager' THEN
        RETURN user_context.user_role IN ('owner', 'manager');
    ELSIF required_role = 'owner' THEN
        RETURN user_context.user_role = 'owner';
    END IF;
    
    RETURN FALSE;
END;
$$;

-- Enhanced RLS Policies for tenants table
CREATE POLICY "Tenants - View own tenant only" ON tenants
    FOR SELECT USING (
        id IN (SELECT tenant_id FROM get_current_tenant_context())
    );

CREATE POLICY "Tenants - Owners can update tenant" ON tenants
    FOR UPDATE USING (
        id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('owner')
    );

-- Enhanced RLS Policies for tenant_users table
CREATE POLICY "Tenant Users - View own tenant memberships" ON tenant_users
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
    );

CREATE POLICY "Tenant Users - Owners can manage users" ON tenant_users
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('owner')
    );

CREATE POLICY "Tenant Users - Managers can view and update non-owners" ON tenant_users
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('manager')
    );

CREATE POLICY "Tenant Users - Managers can update cashiers and viewers" ON tenant_users
    FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('manager')
        AND role IN ('cashier', 'viewer')
    );

-- Enhanced RLS Policies for products table
CREATE POLICY "Products - All roles can view" ON products
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('viewer')
    );

CREATE POLICY "Products - Managers can create" ON products
    FOR INSERT WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('manager')
    );

CREATE POLICY "Products - Managers can update" ON products
    FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('manager')
    );

CREATE POLICY "Products - Owners can delete" ON products
    FOR DELETE USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('owner')
    );

-- Enhanced RLS Policies for customers table
CREATE POLICY "Customers - All roles can view" ON customers
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('viewer')
    );

CREATE POLICY "Customers - Cashiers can create" ON customers
    FOR INSERT WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('cashier')
    );

CREATE POLICY "Customers - Managers can update" ON customers
    FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('manager')
    );

CREATE POLICY "Customers - Owners can delete" ON customers
    FOR DELETE USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('owner')
    );

-- Enhanced RLS Policies for sales table
CREATE POLICY "Sales - All roles can view own tenant sales" ON sales
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('viewer')
    );

CREATE POLICY "Sales - Cashiers can create sales" ON sales
    FOR INSERT WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('cashier')
    );

CREATE POLICY "Sales - Managers can update sales" ON sales
    FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('manager')
    );

CREATE POLICY "Sales - Owners can delete sales" ON sales
    FOR DELETE USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('owner')
    );

-- Enhanced RLS Policies for employees table
CREATE POLICY "Employees - All roles can view" ON employees
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('viewer')
    );

CREATE POLICY "Employees - Managers can create and update" ON employees
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('manager')
        AND role != 'owner' -- Managers can't create other owners
    );

CREATE POLICY "Employees - Owners have full control" ON employees
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
        AND verify_role_permission('owner')
    );

-- Security constraint functions
CREATE OR REPLACE FUNCTION check_tenant_access(table_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN table_tenant_id IN (SELECT tenant_id FROM get_current_tenant_context());
END;
$$;

-- Add security constraints for additional tables if they exist
DO $$
BEGIN
    -- Check if sale_items table exists and add policies
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sale_items') THEN
        DROP POLICY IF EXISTS "Enable read access for sale_items" ON sale_items;
        DROP POLICY IF EXISTS "Enable manage access for sale_items" ON sale_items;
        
        ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Sale Items - View through sales" ON sale_items
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM sales s 
                    WHERE s.id = sale_items.sale_id 
                    AND s.tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
                )
            );
            
        CREATE POLICY "Sale Items - Manage through sales" ON sale_items
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM sales s 
                    WHERE s.id = sale_items.sale_id 
                    AND s.tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
                    AND verify_role_permission('cashier')
                )
            );
    END IF;
    
    -- Check if inventory_movements table exists and add policies
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory_movements') THEN
        DROP POLICY IF EXISTS "Users can view inventory_movements" ON inventory_movements;
        DROP POLICY IF EXISTS "Users can manage inventory_movements" ON inventory_movements;
        
        ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Inventory Movements - All roles can view" ON inventory_movements
            FOR SELECT USING (
                verify_role_permission('viewer')
                AND EXISTS (
                    SELECT 1 FROM products p
                    WHERE p.id = inventory_movements.product_id
                    AND p.tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
                )
            );
            
        CREATE POLICY "Inventory Movements - Cashiers can create" ON inventory_movements
            FOR INSERT WITH CHECK (
                verify_role_permission('cashier')
                AND EXISTS (
                    SELECT 1 FROM products p
                    WHERE p.id = inventory_movements.product_id
                    AND p.tenant_id IN (SELECT tenant_id FROM get_current_tenant_context())
                )
            );
    END IF;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_current_tenant_context TO authenticated;
GRANT EXECUTE ON FUNCTION verify_role_permission TO authenticated;
GRANT EXECUTE ON FUNCTION check_tenant_access TO authenticated;

-- Add security indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_users_composite ON tenant_users(tenant_id, user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_date ON sales(tenant_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_active ON customers(tenant_id);

-- Security logging function for policy violations
CREATE OR REPLACE FUNCTION log_policy_violation(
    table_name TEXT,
    operation TEXT,
    reason TEXT
) RETURNS void AS $$
BEGIN
    PERFORM log_security_event(
        'policy_violation',
        format('RLS policy violation on %s: %s - %s', table_name, operation, reason),
        'high',
        json_build_object(
            'table_name', table_name,
            'operation', operation,
            'reason', reason,
            'user_id', auth.uid(),
            'timestamp', NOW()
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_policy_violation TO authenticated;
