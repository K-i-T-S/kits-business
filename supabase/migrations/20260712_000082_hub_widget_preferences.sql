-- Track: owner-facing hub widget customization
-- (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
--
-- Founder-approved design (2026-07-12): owners can toggle visibility and
-- reorder the widgets on each role-native hub (Stockkeeper/Accountant/
-- Receptionist/Operations) -- editable from a new "Hub Layout" tab in
-- SystemSettings.tsx, reflected on every device that role logs into
-- (hence a real table, not a per-device localStorage blob like the
-- existing ReportBuilder.tsx precedent).
--
-- One row per (tenant, hub, widget) rather than a single JSONB blob per
-- hub -- explicitly chosen over the JSONB-on-tenants.settings alternative
-- for a more conventional relational shape. hub_key covers Operations
-- Hub's three scopes (owner/manager/supervisor) as independently
-- configurable rows, matching how that hub already shows different
-- widgets per scope today.
--
-- widget_id values are a static catalog per hub_key (src/constants/
-- hubWidgets.ts) -- not user-defined free text, but not FK-enforced
-- either, since the "widgets" are fixed, bespoke, pre-built KPIs/queues
-- baked into each hub's own component code, not a generic pluggable
-- widget type a user could invent new values for.
--
-- No row for a given (tenant, hub, widget) means "not yet customized" --
-- each hub component falls back to today's hardcoded default (visible,
-- catalog order) for any widget with no stored preference, so existing
-- tenants see zero behavior change until an owner explicitly customizes.
CREATE TABLE hub_widget_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hub_key text NOT NULL CHECK (
    hub_key IN ('stockkeeper', 'accountant', 'receptionist', 'operations_owner', 'operations_manager', 'operations_supervisor')
  ),
  widget_id text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, hub_key, widget_id)
);

CREATE INDEX idx_hub_widget_preferences_tenant_hub ON hub_widget_preferences(tenant_id, hub_key);

ALTER TABLE hub_widget_preferences ENABLE ROW LEVEL SECURITY;

-- Any tenant member can read -- every hub needs to load its own config to
-- render, regardless of who's signed in (a stockkeeper viewing their own
-- hub isn't "owner-facing" editing, just reading the owner's layout).
CREATE POLICY "tenant members can view hub widget preferences"
  ON hub_widget_preferences FOR SELECT
  USING (tenant_id = current_tenant_id());

-- Only the owner (current_user_role() already normalizes platform admins
-- to 'owner' -- see current_user_role()'s own definition) can customize
-- hub layouts -- this is explicitly an owner-level decision, narrower
-- than trusted_terminals' owner/admin/manager write access.
CREATE POLICY "owner can manage hub widget preferences"
  ON hub_widget_preferences FOR ALL
  USING (tenant_id = current_tenant_id() AND current_user_role() = 'owner')
  WITH CHECK (tenant_id = current_tenant_id() AND current_user_role() = 'owner');

GRANT SELECT, INSERT, UPDATE, DELETE ON hub_widget_preferences TO authenticated;
