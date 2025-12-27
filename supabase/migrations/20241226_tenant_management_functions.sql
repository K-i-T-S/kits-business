-- Additional tenant management functions and procedures

-- Function to create a new tenant
CREATE OR REPLACE FUNCTION create_tenant(
    tenant_name TEXT,
    tenant_slug TEXT,
    owner_user_id UUID,
    settings JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    -- Create the tenant
    INSERT INTO tenants (name, slug, settings)
    VALUES (tenant_name, tenant_slug, settings)
    RETURNING id INTO new_tenant_id;
    
    -- Add the owner as a tenant user
    INSERT INTO tenant_users (tenant_id, user_id, role)
    VALUES (new_tenant_id, owner_user_id, 'owner');
    
    RETURN new_tenant_id;
END;
$$;

-- Function to add user to tenant
CREATE OR REPLACE FUNCTION add_user_to_tenant(
    tenant_id_param UUID,
    user_id_param UUID,
    user_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if current user is owner or manager of this tenant
    IF current_user_role() NOT IN ('owner', 'manager') THEN
        RAISE EXCEPTION 'Only owners and managers can add users to tenants';
    END IF;
    
    -- Add the user to the tenant
    INSERT INTO tenant_users (tenant_id, user_id, role)
    VALUES (tenant_id_param, user_id_param, user_role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        role = user_role,
        updated_at = NOW(),
        is_active = true;
    
    RETURN true;
END;
$$;

-- Function to remove user from tenant
CREATE OR REPLACE FUNCTION remove_user_from_tenant(
    tenant_id_param UUID,
    user_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if current user is owner of this tenant
    IF current_user_role() != 'owner' THEN
        RAISE EXCEPTION 'Only owners can remove users from tenants';
    END IF;
    
    -- Remove the user from the tenant
    DELETE FROM tenant_users
    WHERE tenant_id = tenant_id_param AND user_id = user_id_param;
    
    RETURN true;
END;
$$;

-- Function to get tenant info for current user
CREATE OR REPLACE FUNCTION get_current_user_tenant()
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tenant_slug TEXT,
    user_role TEXT,
    settings JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        tu.role,
        t.settings
    FROM tenants t
    JOIN tenant_users tu ON t.id = tu.tenant_id
    WHERE tu.user_id = auth.uid()
    AND tu.is_active = true
    AND t.is_active = true;
END;
$$;

-- Function to check if user has specific role in tenant
CREATE OR REPLACE FUNCTION user_has_role(
    required_role TEXT
)
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
        RETURN user_role IN ('viewer', 'cashier', 'manager', 'owner');
    ELSIF required_role = 'cashier' THEN
        RETURN user_role IN ('cashier', 'manager', 'owner');
    ELSIF required_role = 'manager' THEN
        RETURN user_role IN ('manager', 'owner');
    ELSIF required_role = 'owner' THEN
        RETURN user_role = 'owner';
    ELSE
        RETURN false;
    END IF;
END;
$$;

-- Function to get all tenants for a user
CREATE OR REPLACE FUNCTION get_tenants_by_user(user_id_param UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    settings JSONB,
    subscription_plan TEXT,
    is_active BOOLEAN,
    user_role TEXT,
    user_active BOOLEAN,
    user_added_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        t.settings,
        t.subscription_plan,
        t.is_active,
        tu.role as user_role,
        tu.is_active as user_active,
        tu.created_at as user_added_at
    FROM tenants t
    JOIN tenant_users tu ON t.id = tu.tenant_id
    WHERE tu.user_id = user_id_param AND t.is_active = true
    ORDER BY t.created_at;
END;
$$;

-- Create view for easy tenant management
CREATE OR REPLACE VIEW tenant_user_details AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.settings,
    t.subscription_plan,
    t.is_active as tenant_active,
    tu.user_id,
    tu.role as user_role,
    tu.is_active as user_active,
    tu.created_at as user_added_at,
    u.email,
    u.created_at as user_created_at
FROM tenants t
JOIN tenant_users tu ON t.id = tu.tenant_id
JOIN auth.users u ON tu.user_id = u.id;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON tenants TO authenticated;
GRANT ALL ON tenant_users TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON sales TO authenticated;
GRANT ALL ON customers TO authenticated;
GRANT ALL ON employees TO authenticated;
GRANT EXECUTE ON FUNCTION create_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_to_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION remove_user_from_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_tenant TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenants_by_user TO authenticated;
GRANT EXECUTE ON FUNCTION current_tenant_id TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_role TO authenticated;
GRANT SELECT ON tenant_user_details TO authenticated;
