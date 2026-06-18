CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_tenant_idx ON activity_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON activity_log(entity_type, entity_id);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_activity_log_select" ON activity_log
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_activity_log_insert" ON activity_log
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
