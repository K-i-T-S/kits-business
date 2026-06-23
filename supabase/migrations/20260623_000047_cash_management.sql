-- Cash drawer management for restaurant shifts
-- Note: restaurant_cash_sessions was created in 000043 with a compatible schema.
-- This migration adds the cash movements table for granular cash tracking.

CREATE TABLE IF NOT EXISTS restaurant_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES restaurant_cash_sessions(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'refund', 'expense', 'float_add', 'float_remove', 'tip_out')),
  amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_lbp NUMERIC(14,2) NOT NULL DEFAULT 0,
  reference_id UUID, -- order ID or expense ID
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE restaurant_cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON restaurant_cash_movements
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_cash_movements_session
  ON restaurant_cash_movements(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant
  ON restaurant_cash_movements(tenant_id, created_at DESC);
