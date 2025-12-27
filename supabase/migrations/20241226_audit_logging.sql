-- Audit Logging and Activity Tracking Migration
-- Creates comprehensive audit trail for all multi-tenant operations

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create activity_log table for user-facing activity feed
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_id ON activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);

-- Enable RLS on audit tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_logs
CREATE POLICY "Users can view audit logs in their tenant" ON audit_logs
    FOR SELECT USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- RLS policies for activity_log
CREATE POLICY "Users can view activity in their tenant" ON activity_log
    FOR SELECT USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
    );

CREATE POLICY "System can insert activity logs" ON activity_log
    FOR INSERT WITH CHECK (true);

-- Audit logging function
CREATE OR REPLACE FUNCTION log_audit(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        tenant_id,
        store_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        current_setting('app.current_tenant_id', true)::UUID,
        current_setting('app.current_store_id', true)::UUID,
        current_setting('app.current_user_id', true)::UUID,
        p_action,
        p_entity_type,
        p_entity_id,
        p_old_values,
        p_new_values,
        inet_client_addr(),
        current_setting('app.user_agent', true),
        p_metadata
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activity logging function
CREATE OR REPLACE FUNCTION log_activity(
    p_action TEXT,
    p_description TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO activity_log (
        tenant_id,
        store_id,
        user_id,
        action,
        description,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        current_setting('app.current_tenant_id', true)::UUID,
        current_setting('app.current_store_id', true)::UUID,
        current_setting('app.current_user_id', true)::UUID,
        p_action,
        p_description,
        p_entity_type,
        p_entity_id,
        p_metadata
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger functions for automatic audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS TRIGGER AS $$
BEGIN
    -- Log the change
    PERFORM log_audit(
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'user_id', current_setting('app.current_user_id', true)::UUID
        )
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for important tables
CREATE TRIGGER audit_products_trigger
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_sales_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_customers_trigger
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_employees_trigger
    AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_stores_trigger
    AFTER INSERT OR UPDATE OR DELETE ON stores
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_tenant_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tenant_users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Activity logging helper functions
CREATE OR REPLACE FUNCTION log_user_login(user_id UUID) RETURNS void AS $$
BEGIN
    PERFORM log_activity(
        'user.login',
        'User logged in to the system',
        'user',
        user_id,
        json_build_object('login_time', NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_user_logout(user_id UUID) RETURNS void AS $$
BEGIN
    PERFORM log_activity(
        'user.logout',
        'User logged out of the system',
        'user',
        user_id,
        json_build_object('logout_time', NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_tenant_switch(tenant_id UUID, old_tenant_id UUID DEFAULT NULL) RETURNS void AS $$
BEGIN
    PERFORM log_activity(
        'tenant.switch',
        format('User switched to tenant %s', tenant_id),
        'tenant',
        tenant_id,
        json_build_object(
            'old_tenant_id', old_tenant_id,
            'new_tenant_id', tenant_id
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_store_switch(store_id UUID, old_store_id UUID DEFAULT NULL) RETURNS void AS $$
BEGIN
    PERFORM log_activity(
        'store.switch',
        format('User switched to store %s', store_id),
        'store',
        store_id,
        json_build_object(
            'old_store_id', old_store_id,
            'new_store_id', store_id
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Core audit logging function
CREATE OR REPLACE FUNCTION log_audit(
    action TEXT,
    entity_type TEXT,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB
) RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        user_id,
        tenant_id,
        store_id
    ) VALUES (
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        auth.uid(),
        current_setting('app.current_tenant_id', true)::UUID,
        current_setting('app.current_store_id', true)::UUID
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security event logging
CREATE OR REPLACE FUNCTION log_security_event(
    event_type TEXT,
    description TEXT,
    severity TEXT DEFAULT 'medium',
    metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
BEGIN
    PERFORM log_audit(
        'security.' || event_type,
        'security_event',
        NULL,
        NULL,
        json_build_object('event_type', event_type, 'description', description, 'severity', severity),
        metadata
    );
    
    RETURN log_activity(
        'security.' || event_type,
        description,
        'security_event',
        NULL,
        json_build_object('severity', severity, metadata)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function for old audit logs (keeps 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs() RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';
    DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT ON activity_log TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit TO authenticated;
GRANT EXECUTE ON FUNCTION log_activity TO authenticated;
GRANT EXECUTE ON FUNCTION log_user_login TO authenticated;
GRANT EXECUTE ON FUNCTION log_user_logout TO authenticated;
GRANT EXECUTE ON FUNCTION log_tenant_switch TO authenticated;
GRANT EXECUTE ON FUNCTION log_store_switch TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated;
