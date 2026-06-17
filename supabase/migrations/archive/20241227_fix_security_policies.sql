-- Security Fixes Migration
-- Addresses critical security gaps identified in the system

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view products" ON products;
DROP POLICY IF EXISTS "Users can manage products" ON products;
DROP POLICY IF EXISTS "Users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can manage customers" ON customers;
DROP POLICY IF EXISTS "Users can view sales" ON sales;
DROP POLICY IF EXISTS "Users can manage sales" ON sales;
DROP POLICY IF EXISTS "Users can view sale_items" ON sale_items;
DROP POLICY IF EXISTS "Users can manage sale_items" ON sale_items;
DROP POLICY IF EXISTS "Users can view employees" ON employees;
DROP POLICY IF EXISTS "Users can manage employees" ON employees;
DROP POLICY IF EXISTS "Users can view inventory_movements" ON inventory_movements;
DROP POLICY IF EXISTS "Users can manage inventory_movements" ON inventory_movements;

-- Create secure RLS policies with proper tenant isolation and role-based access

-- Products table policies
CREATE POLICY "Users can view products in their tenant" ON products
    FOR SELECT USING (
        tenant_id = current_tenant_id()
    );

CREATE POLICY "Owners and managers can insert products" ON products
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

CREATE POLICY "Owners and managers can update products" ON products
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

CREATE POLICY "Owners can delete products" ON products
    FOR DELETE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() = 'owner'
    );

-- Customers table policies
CREATE POLICY "Users can view customers in their tenant" ON customers
    FOR SELECT USING (
        tenant_id = current_tenant_id()
    );

CREATE POLICY "Owners and managers can insert customers" ON customers
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

CREATE POLICY "Owners and managers can update customers" ON customers
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

CREATE POLICY "Owners can delete customers" ON customers
    FOR DELETE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() = 'owner'
    );

-- Sales table policies
CREATE POLICY "Users can view sales in their tenant" ON sales
    FOR SELECT USING (
        tenant_id = current_tenant_id()
    );

CREATE POLICY "Staff can create sales" ON sales
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

-- Sale items table policies
CREATE POLICY "Users can view sale items in their tenant" ON sale_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sales 
            WHERE sales.id = sale_items.sale_id 
            AND sales.tenant_id = current_tenant_id()
        )
    );

CREATE POLICY "Staff can create sale items" ON sale_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sales 
            WHERE sales.id = sale_items.sale_id 
            AND sales.tenant_id = current_tenant_id()
        )
        AND current_user_role() IN ('owner', 'manager', 'cashier')
    );

CREATE POLICY "Owners and managers can update sale items" ON sale_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sales 
            WHERE sales.id = sale_items.sale_id 
            AND sales.tenant_id = current_tenant_id()
        )
        AND current_user_role() IN ('owner', 'manager')
    );

CREATE POLICY "Owners can delete sale items" ON sale_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM sales 
            WHERE sales.id = sale_items.sale_id 
            AND sales.tenant_id = current_tenant_id()
        )
        AND current_user_role() = 'owner'
    );

-- Employees table policies
CREATE POLICY "Users can view employees in their tenant" ON employees
    FOR SELECT USING (
        tenant_id = current_tenant_id()
    );

CREATE POLICY "Owners and managers can insert employees" ON employees
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

CREATE POLICY "Owners and managers can update employees" ON employees
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

CREATE POLICY "Owners can delete employees" ON employees
    FOR DELETE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() = 'owner'
    );

-- Inventory movements table policies
CREATE POLICY "Users can view inventory movements in their tenant" ON inventory_movements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM products 
            WHERE products.id = inventory_movements.product_id 
            AND products.tenant_id = current_tenant_id()
        )
    );

CREATE POLICY "Staff can create inventory movements" ON inventory_movements
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM products 
            WHERE products.id = inventory_movements.product_id 
            AND products.tenant_id = current_tenant_id()
        )
        AND current_user_role() IN ('owner', 'manager', 'cashier')
    );

-- Add security constraints for sensitive operations
CREATE POLICY "Prevent role escalation in tenant_users" ON tenant_users
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() = 'owner'
        AND (
            -- Owners can only assign roles equal or lower than their own
            (current_user_role() = 'owner' AND role IN ('owner', 'manager', 'cashier', 'viewer')) OR
            -- Managers cannot assign owner roles
            (current_user_role() = 'manager' AND role IN ('cashier', 'viewer'))
        )
    );

CREATE POLICY "Prevent self-role modification" ON tenant_users
    FOR UPDATE USING (
        user_id != auth.uid()
    );

-- Enhanced security functions
CREATE OR REPLACE FUNCTION verify_role_permission(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := current_user_role();
    
    -- Role hierarchy: owner > manager > cashier > viewer
    IF required_role = 'viewer' THEN
        RETURN user_role IN ('owner', 'manager', 'cashier', 'viewer');
    ELSIF required_role = 'cashier' THEN
        RETURN user_role IN ('owner', 'manager', 'cashier');
    ELSIF required_role = 'manager' THEN
        RETURN user_role IN ('owner', 'manager');
    ELSIF required_role = 'owner' THEN
        RETURN user_role = 'owner';
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- Function to log security events automatically
CREATE OR REPLACE FUNCTION security_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Log sensitive operations
    IF TG_TABLE_NAME = 'tenant_users' AND TG_OP IN ('UPDATE', 'DELETE') THEN
        PERFORM log_security_event(
            'role_change',
            format('Role %s for user %s in tenant %s', TG_OP, OLD.user_id, OLD.tenant_id),
            'high',
            json_build_object(
                'old_role', OLD.role,
                'new_role', COALESCE(NEW.role, 'deleted'),
                'user_id', OLD.user_id,
                'tenant_id', OLD.tenant_id
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add security audit trigger to tenant_users
CREATE TRIGGER security_audit_tenant_users_trigger
    AFTER UPDATE OR DELETE ON tenant_users
    FOR EACH ROW EXECUTE FUNCTION security_audit_trigger();

-- Rate limiting helper function
CREATE OR REPLACE FUNCTION check_rate_limit(
    user_id UUID,
    operation TEXT,
    max_requests INTEGER DEFAULT 100,
    window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    request_count INTEGER;
BEGIN
    -- Count requests in the time window
    SELECT COUNT(*) INTO request_count
    FROM audit_logs
    WHERE user_id = check_rate_limit.user_id
    AND action = operation
    AND created_at > NOW() - INTERVAL '1 minute' * window_minutes;
    
    -- Return false if over limit
    RETURN request_count < max_requests;
END;
$$;

-- Input validation functions
CREATE OR REPLACE FUNCTION validate_email(email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;

CREATE OR REPLACE FUNCTION validate_phone(phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Basic phone validation (can be enhanced based on requirements)
    RETURN phone ~ '^\+?[0-9\s\-\(\)]{10,}$';
END;
$$;

CREATE OR REPLACE FUNCTION sanitize_input(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Basic sanitization - remove potential SQL injection patterns
    RETURN regexp_replace(input, '[;''"\\]', '', 'g');
END;
$$;

-- Add constraints to tables for data integrity
ALTER TABLE customers ADD CONSTRAINT valid_customer_email 
    CHECK (email IS NULL OR validate_email(email));

ALTER TABLE customers ADD CONSTRAINT valid_customer_phone 
    CHECK (phone IS NULL OR validate_phone(phone));

ALTER TABLE employees ADD CONSTRAINT valid_employee_email 
    CHECK (email IS NULL OR validate_email(email));

ALTER TABLE employees ADD CONSTRAINT valid_employee_phone 
    CHECK (phone IS NULL OR validate_phone(phone));

-- Create security event types table for monitoring
CREATE TABLE IF NOT EXISTS security_event_types (
    id SERIAL PRIMARY KEY,
    event_type TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_active BOOLEAN DEFAULT true
);

-- Insert common security event types
INSERT INTO security_event_types (event_type, description, severity) VALUES
('multiple_failed_logins', 'Multiple failed login attempts', 'high'),
('role_escalation', 'Attempted role escalation', 'critical'),
('unauthorized_access', 'Unauthorized access attempt', 'medium'),
('data_export', 'Large data export attempt', 'medium'),
('bulk_delete', 'Bulk delete operation', 'high'),
('tenant_switch', 'Tenant context switch', 'low')
ON CONFLICT (event_type) DO NOTHING;

-- Grant permissions for security functions
GRANT EXECUTE ON FUNCTION verify_role_permission TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION validate_email TO authenticated;
GRANT EXECUTE ON FUNCTION validate_phone TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_input TO authenticated;
