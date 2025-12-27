-- Public API and Webhooks System
-- This migration creates a comprehensive public API with webhooks support

-- Create api_keys table for API authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE, -- Hashed API key
    key_prefix TEXT NOT NULL, -- First few characters for identification
    permissions JSONB NOT NULL DEFAULT '{}', -- Granular permissions
    rate_limit INTEGER DEFAULT 1000, -- Requests per hour
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create webhooks table for webhook configurations
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '[]', -- Array of event types to subscribe to
    secret TEXT, -- Webhook secret for signature verification
    active BOOLEAN DEFAULT true,
    retry_config JSONB DEFAULT '{"max_retries": 3, "retry_delay": 60}', -- Retry configuration
    headers JSONB DEFAULT '{}', -- Additional headers to send
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_triggered_at TIMESTAMP WITH TIME ZONE
);

-- Create webhook_deliveries table for tracking webhook delivery attempts
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    response_status INTEGER,
    response_body TEXT,
    attempt_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT
);

-- Create api_usage_logs table for tracking API usage
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    request_size INTEGER,
    response_size INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create api_endpoints table for configurable API endpoints
CREATE TABLE IF NOT EXISTS api_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
    description TEXT,
    required_permissions JSONB NOT NULL DEFAULT '[]',
    rate_limit_override INTEGER,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(path, method)
);

-- Insert default API endpoints
INSERT INTO api_endpoints (path, method, description, required_permissions) VALUES
('/products', 'GET', 'List products', '["products.read"]'),
('/products', 'POST', 'Create product', '["products.create"]'),
('/products/{id}', 'GET', 'Get product details', '["products.read"]'),
('/products/{id}', 'PUT', 'Update product', '["products.update"]'),
('/products/{id}', 'DELETE', 'Delete product', '["products.delete"]'),
('/sales', 'GET', 'List sales', '["sales.read"]'),
('/sales', 'POST', 'Create sale', '["sales.create"]'),
('/sales/{id}', 'GET', 'Get sale details', '["sales.read"]'),
('/customers', 'GET', 'List customers', '["customers.read"]'),
('/customers', 'POST', 'Create customer', '["customers.create"]'),
('/customers/{id}', 'GET', 'Get customer details', '["customers.read"]'),
('/customers/{id}', 'PUT', 'Update customer', '["customers.update"]'),
('/customers/{id}', 'DELETE', 'Delete customer', '["customers.delete"]'),
('/inventory', 'GET', 'Get inventory levels', '["inventory.read"]'),
('/inventory/{product_id}', 'PUT', 'Update inventory', '["inventory.update"]'),
('/locations', 'GET', 'List locations', '["locations.read"]'),
('/locations', 'POST', 'Create location', '["locations.create"]'),
('/locations/{id}', 'GET', 'Get location details', '["locations.read"]'),
('/locations/{id}', 'PUT', 'Update location', '["locations.update"]'),
('/locations/{id}', 'DELETE', 'Delete location', '["locations.delete"]'),
('/reports/sales', 'GET', 'Get sales reports', '["reports.view"]'),
('/webhooks', 'GET', 'List webhooks', '["api.admin"]'),
('/webhooks', 'POST', 'Create webhook', '["api.admin"]'),
('/webhooks/{id}', 'PUT', 'Update webhook', '["api.admin"]'),
('/webhooks/{id}', 'DELETE', 'Delete webhook', '["api.admin"]')
ON CONFLICT (path, method) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_id ON webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry_at ON webhook_deliveries(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_tenant_id ON api_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_id ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_endpoints_path ON api_endpoints(path);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_endpoints ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- API Keys: Users with API permissions can manage keys in their tenant
CREATE POLICY "API keys manage policy" ON api_keys
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        ) AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = api_keys.tenant_id
            AND p.name = 'api.admin'
            AND ur.is_active = true
        )
    );

CREATE POLICY "API keys read policy" ON api_keys
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        ) AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = api_keys.tenant_id
            AND p.name IN ('api.read', 'api.admin')
            AND ur.is_active = true
        )
    );

-- Webhooks: Same as API keys
CREATE POLICY "Webhooks manage policy" ON webhooks
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        ) AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = webhooks.tenant_id
            AND p.name = 'api.admin'
            AND ur.is_active = true
        )
    );

CREATE POLICY "Webhooks read policy" ON webhooks
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        ) AND
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN role_permissions rp ON ur.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = webhooks.tenant_id
            AND p.name IN ('api.read', 'api.admin')
            AND ur.is_active = true
        )
    );

-- Webhook deliveries: Based on webhook access
CREATE POLICY "Webhook deliveries read policy" ON webhook_deliveries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM webhooks w
            WHERE w.id = webhook_deliveries.webhook_id
            AND w.tenant_id IN (
                SELECT tenant_id FROM tenant_users 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- API usage logs: Users can view logs for their tenant
CREATE POLICY "API usage logs read policy" ON api_usage_logs
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- API endpoints: Everyone can read enabled endpoints
CREATE POLICY "API endpoints read policy" ON api_endpoints
    FOR SELECT USING (is_enabled = true);

-- Functions for API operations

-- Generate API key function
CREATE OR REPLACE FUNCTION generate_api_key(
    tenant_uuid UUID,
    key_name TEXT,
    permissions_param JSONB DEFAULT '{}',
    rate_limit_param INTEGER DEFAULT 1000,
    expires_at_param TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    new_key TEXT;
    key_hash_val TEXT;
    key_prefix_val TEXT;
    api_key_id UUID;
BEGIN
    -- Check permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = tenant_uuid
        AND p.name = 'api.admin'
        AND ur.is_active = true
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    -- Generate secure API key
    new_key := 'akit_' || encode(gen_random_bytes(32), 'base64');
    key_hash_val := crypt(new_key, gen_salt('bf'));
    key_prefix_val := substr(new_key, 1, 8);
    
    -- Insert API key
    INSERT INTO api_keys (
        tenant_id, name, key_hash, key_prefix, 
        permissions, rate_limit, expires_at, created_by
    )
    VALUES (
        tenant_uuid, key_name, key_hash_val, key_prefix_val,
        permissions_param, rate_limit_param, expires_at_param, auth.uid()
    )
    RETURNING id INTO api_key_id;
    
    RETURN new_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate API key function
CREATE OR REPLACE FUNCTION validate_api_key(key_text TEXT, endpoint_path TEXT, method_param TEXT)
RETURNS TABLE(api_key_id UUID, tenant_id UUID, permissions JSONB) AS $$
DECLARE
    key_record RECORD;
    endpoint_record RECORD;
BEGIN
    -- Find API key by hash
    SELECT * INTO key_record
    FROM api_keys
    WHERE key_hash = crypt(key_text, key_hash)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Update last used timestamp
    UPDATE api_keys
    SET last_used_at = NOW()
    WHERE id = key_record.id;
    
    -- Check rate limiting
    IF EXISTS (
        SELECT 1 FROM api_usage_logs
        WHERE api_key_id = key_record.id
        AND created_at > NOW() - INTERVAL '1 hour'
        HAVING COUNT(*) >= key_record.rate_limit
    ) THEN
        RAISE EXCEPTION 'Rate limit exceeded';
    END IF;
    
    -- Check endpoint permissions
    SELECT * INTO endpoint_record
    FROM api_endpoints
    WHERE path = endpoint_path
    AND method = method_param
    AND is_enabled = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Endpoint not found';
    END IF;
    
    -- Check if API key has required permissions
    IF NOT (key_record.permissions @> endpoint_record.required_permissions) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    RETURN QUERY
    SELECT key_record.id, key_record.tenant_id, key_record.permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger webhook function
CREATE OR REPLACE FUNCTION trigger_webhook(
    tenant_uuid UUID,
    event_type_param TEXT,
    payload_param JSONB
)
RETURNS VOID AS $$
DECLARE
    webhook_record RECORD;
BEGIN
    -- Find active webhooks for this tenant and event
    FOR webhook_record IN
        SELECT * FROM webhooks
        WHERE tenant_id = tenant_uuid
        AND active = true
        AND events @> jsonb_build_array(event_type_param)
    LOOP
        -- Create webhook delivery record
        INSERT INTO webhook_deliveries (
            webhook_id, event_type, payload, status
        )
        VALUES (
            webhook_record.id, event_type_param, payload_param, 'pending'
        );
        
        -- Update webhook last triggered
        UPDATE webhooks
        SET last_triggered_at = NOW()
        WHERE id = webhook_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
    api_key_uuid UUID,
    tenant_uuid UUID,
    endpoint_path TEXT,
    method_param TEXT,
    status_code_param INTEGER,
    response_time_ms_param INTEGER DEFAULT NULL,
    request_size_param INTEGER DEFAULT NULL,
    response_size_param INTEGER DEFAULT NULL,
    ip_address_param INET DEFAULT NULL,
    user_agent_param TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO api_usage_logs (
        api_key_id, tenant_id, endpoint, method, status_code,
        response_time_ms, request_size, response_size, ip_address, user_agent
    )
    VALUES (
        api_key_uuid, tenant_uuid, endpoint_path, method_param, status_code_param,
        response_time_ms_param, request_size_param, response_size_param, ip_address_param, user_agent_param
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get API usage statistics
CREATE OR REPLACE FUNCTION get_api_usage_stats(
    tenant_uuid UUID,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
    date DATE,
    total_requests BIGINT,
    successful_requests BIGINT,
    failed_requests BIGINT,
    avg_response_time NUMERIC,
    unique_ips BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
        COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
        AVG(response_time_ms) as avg_response_time,
        COUNT(DISTINCT ip_address) as unique_ips
    FROM api_usage_logs
    WHERE tenant_id = tenant_uuid
    AND created_at BETWEEN start_date AND end_date
    GROUP BY DATE(created_at)
    ORDER BY date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retry failed webhook deliveries
CREATE OR REPLACE FUNCTION retry_failed_webhook_deliveries()
RETURNS INTEGER AS $$
DECLARE
    delivery_count INTEGER := 0;
    delivery_record RECORD;
BEGIN
    -- Find failed deliveries that need retry
    FOR delivery_record IN
        SELECT wd.*, w.url, w.secret, w.retry_config, w.headers
        FROM webhook_deliveries wd
        JOIN webhooks w ON wd.webhook_id = w.id
        WHERE wd.status = 'failed'
        AND wd.attempt_count < (w.retry_config->>'max_retries')::INTEGER
        AND (wd.next_retry_at IS NULL OR wd.next_retry_at <= NOW())
        LIMIT 100
    LOOP
        -- Update delivery status
        UPDATE webhook_deliveries
        SET status = 'retrying', attempt_count = attempt_count + 1
        WHERE id = delivery_record.id;
        
        -- In a real implementation, this would trigger an actual HTTP request
        -- For now, we'll simulate success after a few attempts
        IF delivery_record.attempt_count >= 2 THEN
            UPDATE webhook_deliveries
            SET status = 'delivered', delivered_at = NOW()
            WHERE id = delivery_record.id;
        ELSE
            UPDATE webhook_deliveries
            SET status = 'failed',
                next_retry_at = NOW() + (delivery_record.retry_config->>'retry_delay')::INTEGER * INTERVAL '1 second'
            WHERE id = delivery_record.id;
        END IF;
        
        delivery_count := delivery_count + 1;
    END LOOP;
    
    RETURN delivery_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
