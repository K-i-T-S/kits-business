-- Migration 000044: Per-branch menu item availability overrides
-- Allows individual branches to disable specific menu items without affecting other branches.
-- Default behaviour (no override row) = item is available at all branches.

CREATE TABLE IF NOT EXISTS restaurant_menu_items_branch_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES restaurant_branches(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES restaurant_menu_items(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  price_override_usd NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, branch_id, menu_item_id)
);

ALTER TABLE restaurant_menu_items_branch_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_branch_overrides" ON restaurant_menu_items_branch_overrides
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_branch_menu_overrides_branch
  ON restaurant_menu_items_branch_overrides(tenant_id, branch_id);
