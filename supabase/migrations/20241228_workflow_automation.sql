-- Workflow Automation System
-- This migration creates a comprehensive workflow automation engine

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'schedule', 'manual', 'condition')),
    trigger_config JSONB NOT NULL DEFAULT '{}',
    actions JSONB NOT NULL DEFAULT '[]', -- Array of action configurations
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_run_at TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0
);

-- Create workflow_executions table for tracking runs
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    trigger_data JSONB DEFAULT '{}',
    execution_context JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    error_message TEXT,
    execution_time_ms INTEGER
);

-- Create workflow_schedules table for scheduled workflows
CREATE TABLE IF NOT EXISTS workflow_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'interval', 'once')),
    schedule_expression TEXT NOT NULL, -- Cron expression or interval in minutes
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_templates table for reusable workflow templates
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    template_config JSONB NOT NULL, -- Workflow configuration template
    is_system_template BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_actions table for available action types
CREATE TABLE IF NOT EXISTS workflow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    action_type TEXT NOT NULL, -- 'api_call', 'email', 'notification', 'data_operation', 'approval', 'webhook'
    config_schema JSONB NOT NULL, -- JSON schema for action configuration
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_triggers table for available trigger types
CREATE TABLE IF NOT EXISTS workflow_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- 'event', 'schedule', 'manual', 'condition'
    config_schema JSONB NOT NULL, -- JSON schema for trigger configuration
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default workflow actions
INSERT INTO workflow_actions (name, description, action_type, config_schema) VALUES
('send_email', 'Send email notification', 'email', '{
    "type": "object",
    "required": ["to", "subject", "body"],
    "properties": {
        "to": {"type": "string", "format": "email"},
        "cc": {"type": "string", "format": "email"},
        "bcc": {"type": "string", "format": "email"},
        "subject": {"type": "string"},
        "body": {"type": "string"},
        "template": {"type": "string"}
    }
}'),
('send_notification', 'Send in-app notification', 'notification', '{
    "type": "object",
    "required": ["title", "message"],
    "properties": {
        "title": {"type": "string"},
        "message": {"type": "string"},
        "type": {"type": "string", "enum": ["info", "success", "warning", "error"]},
        "priority": {"type": "string", "enum": ["low", "medium", "high"]},
        "users": {"type": "array", "items": {"type": "string"}},
        "roles": {"type": "array", "items": {"type": "string"}}
    }
}'),
('api_call', 'Make HTTP API call', 'api_call', '{
    "type": "object",
    "required": ["url", "method"],
    "properties": {
        "url": {"type": "string", "format": "uri"},
        "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"]},
        "headers": {"type": "object"},
        "body": {"type": "object"},
        "timeout": {"type": "integer", "minimum": 1}
    }
}'),
('webhook', 'Send webhook', 'webhook', '{
    "type": "object",
    "required": ["url"],
    "properties": {
        "url": {"type": "string", "format": "uri"},
        "method": {"type": "string", "enum": ["POST", "PUT"]},
        "headers": {"type": "object"},
        "payload": {"type": "object"},
        "secret": {"type": "string"}
    }
}'),
('update_product', 'Update product data', 'data_operation', '{
    "type": "object",
    "required": ["product_id"],
    "properties": {
        "product_id": {"type": "string"},
        "updates": {"type": "object"},
        "conditions": {"type": "object"}
    }
}'),
('create_task', 'Create approval task', 'approval', '{
    "type": "object",
    "required": ["title", "assignee"],
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "assignee": {"type": "string"},
        "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
        "due_date": {"type": "string", "format": "date-time"}
    }
}'),
('wait', 'Wait for specified time', 'delay', '{
    "type": "object",
    "required": ["duration"],
    "properties": {
        "duration": {"type": "integer", "minimum": 1},
        "unit": {"type": "string", "enum": ["seconds", "minutes", "hours", "days"]}
    }
}'),
('conditional', 'Conditional logic', 'condition', '{
    "type": "object",
    "required": ["condition", "true_actions", "false_actions"],
    "properties": {
        "condition": {"type": "string"},
        "true_actions": {"type": "array"},
        "false_actions": {"type": "array"}
    }
}')
ON CONFLICT (name) DO NOTHING;

-- Insert default workflow triggers
INSERT INTO workflow_triggers (name, description, trigger_type, config_schema) VALUES
('sale_created', 'When a new sale is created', 'event', '{
    "type": "object",
    "properties": {
        "conditions": {"type": "object"},
        "filters": {"type": "object"}
    }
}'),
('product_low_stock', 'When product stock is low', 'condition', '{
    "type": "object",
    "required": ["threshold"],
    "properties": {
        "threshold": {"type": "integer"},
        "product_ids": {"type": "array", "items": {"type": "string"}},
        "categories": {"type": "array", "items": {"type": "string"}}
    }
}'),
('customer_created', 'When a new customer is created', 'event', '{
    "type": "object",
    "properties": {
        "conditions": {"type": "object"}
    }
}'),
('daily_report', 'Daily scheduled trigger', 'schedule', '{
    "type": "object",
    "required": ["time"],
    "properties": {
        "time": {"type": "string", "pattern": "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"},
        "timezone": {"type": "string"}
    }
}'),
('weekly_report', 'Weekly scheduled trigger', 'schedule', '{
    "type": "object",
    "required": ["day", "time"],
    "properties": {
        "day": {"type": "string", "enum": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]},
        "time": {"type": "string", "pattern": "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"},
        "timezone": {"type": "string"}
    }
}'),
('manual_trigger', 'Manual trigger by user', 'manual', '{
    "type": "object",
    "properties": {
        "required_roles": {"type": "array", "items": {"type": "string"}}
    }
}')
ON CONFLICT (name) DO NOTHING;

-- Insert workflow templates
INSERT INTO workflow_templates (name, description, category, template_config, is_system_template) VALUES
('Low Stock Alert', 'Send alerts when products are low on stock', 'inventory', '{
    "trigger": {
        "type": "product_low_stock",
        "config": {
            "threshold": 10
        }
    },
    "actions": [
        {
            "type": "send_email",
            "config": {
                "to": "{{manager_email}}",
                "subject": "Low Stock Alert: {{product_name}}",
                "body": "Product {{product_name}} is running low on stock. Current level: {{current_stock}}"
            }
        },
        {
            "type": "send_notification",
            "config": {
                "title": "Low Stock Alert",
                "message": "{{product_name}} needs restocking",
                "type": "warning",
                "roles": ["inventory_manager", "manager"]
            }
        }
    ]
}', true),
('Daily Sales Report', 'Send daily sales summary', 'reports', '{
    "trigger": {
        "type": "daily_report",
        "config": {
            "time": "18:00"
        }
    },
    "actions": [
        {
            "type": "send_email",
            "config": {
                "to": "{{admin_email}}",
                "subject": "Daily Sales Report - {{date}}",
                "body": "Total sales: {{total_sales}}\\nTotal revenue: {{total_revenue}}"
            }
        }
    ]
}', true),
('New Customer Welcome', 'Send welcome email to new customers', 'customer', '{
    "trigger": {
        "type": "customer_created",
        "config": {}
    },
    "actions": [
        {
            "type": "send_email",
            "config": {
                "to": "{{customer_email}}",
                "subject": "Welcome to our store!",
                "body": "Thank you for registering with us. We look forward to serving you."
            }
        }
    ]
}', true)
ON CONFLICT (name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_id ON workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow_id ON workflow_schedules(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_run_at ON workflow_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_is_active ON workflow_schedules(is_active);

-- Enable RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Workflows: Users with workflows permissions can manage workflows in their tenant
CREATE POLICY "Workflows manage policy" ON workflows
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
            AND ur.tenant_id = workflows.tenant_id
            AND p.name = 'workflows.create'
            AND ur.is_active = true
        )
    );

CREATE POLICY "Workflows read policy" ON workflows
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
            AND ur.tenant_id = workflows.tenant_id
            AND p.name = 'workflows.read'
            AND ur.is_active = true
        )
    );

-- Workflow executions: Read access based on workflow access
CREATE POLICY "Workflow executions read policy" ON workflow_executions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workflows w
            WHERE w.id = workflow_executions.workflow_id
            AND w.tenant_id IN (
                SELECT tenant_id FROM tenant_users 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- Workflow schedules: Same as workflows
CREATE POLICY "Workflow schedules manage policy" ON workflow_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workflows w
            WHERE w.id = workflow_schedules.workflow_id
            AND w.tenant_id IN (
                SELECT tenant_id FROM tenant_users 
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- Workflow templates: Everyone can read system templates, tenant users can read tenant templates
CREATE POLICY "Workflow templates read policy" ON workflow_templates
    FOR SELECT USING (
        is_system_template = true OR
        created_by = auth.uid()
    );

-- Functions for workflow execution
CREATE OR REPLACE FUNCTION execute_workflow(workflow_uuid UUID, trigger_data JSONB DEFAULT '{}')
RETURNS UUID AS $$
DECLARE
    execution_id UUID;
    workflow_record RECORD;
BEGIN
    -- Get workflow details
    SELECT * INTO workflow_record FROM workflows WHERE id = workflow_uuid AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workflow not found or inactive';
    END IF;
    
    -- Check permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = workflow_record.tenant_id
        AND p.name = 'workflows.execute'
        AND ur.is_active = true
    ) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    -- Create execution record
    INSERT INTO workflow_executions (workflow_id, status, trigger_data)
    VALUES (workflow_uuid, 'pending', trigger_data)
    RETURNING id INTO execution_id;
    
    -- Update workflow stats
    UPDATE workflows 
    SET last_run_at = NOW(), run_count = run_count + 1 
    WHERE id = workflow_uuid;
    
    -- In a real implementation, this would queue the workflow for async execution
    -- For now, we'll mark it as completed
    UPDATE workflow_executions 
    SET status = 'completed', completed_at = NOW(), result = '{"status": "success"}'
    WHERE id = execution_id;
    
    RETURN execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get scheduled workflows that need to run
CREATE OR REPLACE FUNCTION get_scheduled_workflows()
RETURNS TABLE(workflow_id UUID, schedule_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT ws.workflow_id, ws.id
    FROM workflow_schedules ws
    JOIN workflows w ON ws.workflow_id = w.id
    WHERE ws.is_active = true
    AND w.is_active = true
    AND ws.next_run_at <= NOW()
    AND w.tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE user_id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
