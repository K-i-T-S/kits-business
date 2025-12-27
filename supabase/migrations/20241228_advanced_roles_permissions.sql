-- Advanced Roles and Permissions System for Enterprise Features
-- This migration creates a comprehensive RBAC system

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    resource TEXT NOT NULL, -- 'products', 'sales', 'customers', 'employees', 'inventory', 'reports', 'settings', 'workflows', 'locations', 'api'
    action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'execute', 'manage'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false, -- System roles cannot be deleted
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT tenant_system_check CHECK (
        (is_system_role = true AND tenant_id IS NULL) OR 
        (is_system_role = false AND tenant_id IS NOT NULL)
    )
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Create user_roles junction table (extends tenant_users)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, tenant_id, role_id)
);

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
-- Product permissions
('products.create', 'Create new products', 'products', 'create'),
('products.read', 'View products', 'products', 'read'),
('products.update', 'Update products', 'products', 'update'),
('products.delete', 'Delete products', 'products', 'delete'),

-- Sales permissions
('sales.create', 'Create sales', 'sales', 'create'),
('sales.read', 'View sales', 'sales', 'read'),
('sales.update', 'Update sales', 'sales', 'update'),
('sales.delete', 'Delete sales', 'sales', 'delete'),
('sales.refund', 'Process refunds', 'sales', 'execute'),

-- Customer permissions
('customers.create', 'Create customers', 'customers', 'create'),
('customers.read', 'View customers', 'customers', 'read'),
('customers.update', 'Update customers', 'customers', 'update'),
('customers.delete', 'Delete customers', 'customers', 'delete'),

-- Employee permissions
('employees.create', 'Create employees', 'employees', 'create'),
('employees.read', 'View employees', 'employees', 'read'),
('employees.update', 'Update employees', 'employees', 'update'),
('employees.delete', 'Delete employees', 'employees', 'delete'),
('employees.manage_shifts', 'Manage employee shifts', 'employees', 'execute'),

-- Inventory permissions
('inventory.read', 'View inventory levels', 'inventory', 'read'),
('inventory.update', 'Update inventory levels', 'inventory', 'update'),
('inventory.adjust', 'Adjust inventory (stock takes)', 'inventory', 'execute'),
('inventory.transfer', 'Transfer inventory between locations', 'inventory', 'execute'),

-- Reports permissions
('reports.view', 'View reports', 'reports', 'read'),
('reports.export', 'Export reports', 'reports', 'execute'),
('reports.advanced', 'Access advanced analytics', 'reports', 'manage'),

-- Settings permissions
('settings.read', 'View settings', 'settings', 'read'),
('settings.update', 'Update settings', 'settings', 'update'),
('settings.manage', 'Manage all settings', 'settings', 'manage'),

-- Workflow permissions
('workflows.create', 'Create workflows', 'workflows', 'create'),
('workflows.read', 'View workflows', 'workflows', 'read'),
('workflows.update', 'Update workflows', 'workflows', 'update'),
('workflows.delete', 'Delete workflows', 'workflows', 'delete'),
('workflows.execute', 'Execute workflows', 'workflows', 'execute'),

-- Location permissions
('locations.create', 'Create locations', 'locations', 'create'),
('locations.read', 'View locations', 'locations', 'read'),
('locations.update', 'Update locations', 'locations', 'update'),
('locations.delete', 'Delete locations', 'locations', 'delete'),
('locations.transfer', 'Transfer between locations', 'locations', 'execute'),

-- API permissions
('api.read', 'Access public API (read)', 'api', 'read'),
('api.write', 'Access public API (write)', 'api', 'update'),
('api.admin', 'Manage API keys and webhooks', 'api', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Create system roles
INSERT INTO roles (name, description, is_system_role) VALUES
('super_admin', 'Super Administrator - Full system access', true),
('admin', 'Administrator - Full tenant access', true),
('manager', 'Manager - Business operations access', true),
('cashier', 'Cashier - Sales operations access', true),
('viewer', 'Viewer - Read-only access', true),
('inventory_manager', 'Inventory Manager - Inventory operations', true),
('report_analyst', 'Report Analyst - Reports and analytics', true),
('api_user', 'API User - API access only', true)
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to system roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin permissions (everything except user management)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.name NOT LIKE 'api.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager' 
  AND p.resource IN ('products', 'sales', 'customers', 'employees', 'inventory', 'reports', 'locations')
  AND p.action IN ('create', 'read', 'update', 'execute')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Cashier permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'cashier' 
  AND (
    (p.resource = 'sales' AND p.action IN ('create', 'read')) OR
    (p.resource = 'customers' AND p.action IN ('create', 'read', 'update')) OR
    (p.resource = 'products' AND p.action = 'read') OR
    (p.resource = 'inventory' AND p.action = 'read')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'viewer' AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Inventory Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'inventory_manager' 
  AND p.resource IN ('inventory', 'products', 'locations')
  AND p.action IN ('create', 'read', 'update', 'execute')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Report Analyst permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'report_analyst' 
  AND p.resource IN ('reports', 'products', 'sales', 'customers')
  AND p.action IN ('read', 'execute')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- API User permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'api_user' AND p.resource = 'api'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- Enable RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Permissions: Everyone can read, only super_admin can write
CREATE POLICY "Permissions read policy" ON permissions
    FOR SELECT USING (true);

CREATE POLICY "Permissions write policy" ON permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users a
            JOIN user_roles ur ON a.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE a.id = auth.uid()
            AND r.name = 'super_admin'
            AND ur.is_active = true
        )
    );

-- Roles: Users can read roles in their tenant, super_admin can read all
CREATE POLICY "Roles read policy" ON roles
    FOR SELECT USING (
        is_system_role = true OR
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Role permissions: Read based on role access
CREATE POLICY "Role permissions read policy" ON role_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM roles r
            WHERE r.id = role_permissions.role_id
            AND (r.is_system_role = true OR r.tenant_id IN (
                SELECT tenant_id FROM tenant_users 
                WHERE user_id = auth.uid() AND is_active = true
            ))
        )
    );

-- User roles: Users can read their own roles, tenant managers can read tenant roles
CREATE POLICY "User roles read policy" ON user_roles
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM tenant_users tu
            WHERE tu.tenant_id = user_roles.tenant_id
            AND tu.user_id = auth.uid()
            AND tu.role IN ('owner', 'manager')
            AND tu.is_active = true
        )
    );

-- Functions for permission checking
CREATE OR REPLACE FUNCTION has_permission(user_uuid UUID, tenant_uuid UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_uuid
        AND ur.tenant_id = tenant_uuid
        AND p.name = permission_name
        AND ur.is_active = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID, tenant_uuid UUID)
RETURNS TABLE(permission_name TEXT, resource TEXT, action TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.name, p.resource, p.action
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_uuid
    AND ur.tenant_id = tenant_uuid
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has any permission on a resource
CREATE OR REPLACE FUNCTION has_resource_access(user_uuid UUID, tenant_uuid UUID, resource_name TEXT, required_action TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_uuid
        AND ur.tenant_id = tenant_uuid
        AND p.resource = resource_name
        AND p.action = required_action
        AND ur.is_active = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
