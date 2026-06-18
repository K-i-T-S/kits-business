-- Per-business isolated database provisioning fields
-- Tracks the lifecycle: pending → provisioning → provisioned (or failed)
-- standalone_supabase_url / standalone_anon_key populated by KiTS admin
-- after manually creating the client's Supabase account.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS business_type       TEXT,
  ADD COLUMN IF NOT EXISTS preferred_region    TEXT NOT NULL DEFAULT 'eu-central-1',
  ADD COLUMN IF NOT EXISTS db_provision_status TEXT NOT NULL DEFAULT 'na'
    CHECK (db_provision_status IN ('na', 'pending', 'provisioning', 'provisioned', 'failed')),
  ADD COLUMN IF NOT EXISTS standalone_supabase_url TEXT,
  ADD COLUMN IF NOT EXISTS standalone_anon_key     TEXT,
  ADD COLUMN IF NOT EXISTS db_provisioned_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS db_provision_notes      TEXT;

-- Existing tenants that completed onboarding before this migration
-- are marked 'na' (not applicable — they stay on shared KiTS DB).
-- Tenants created after this migration will be set to 'pending' by the
-- onboarding wizard on completion, queuing them for their own database.

-- Update admin_list_tenants to include provisioning fields
CREATE OR REPLACE FUNCTION admin_list_tenants()
RETURNS TABLE(
  id                    UUID,
  name                  TEXT,
  slug                  TEXT,
  subscription_plan     TEXT,
  subscription_status   TEXT,
  created_at            TIMESTAMPTZ,
  owner_email           TEXT,
  user_count            BIGINT,
  business_type         TEXT,
  preferred_region      TEXT,
  db_provision_status   TEXT,
  standalone_supabase_url TEXT,
  db_provisioned_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email NOT IN ('kits.tech.co@gmail.com') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.subscription_plan,
    t.subscription_status,
    t.created_at,
    u.email                    AS owner_email,
    (SELECT COUNT(*) FROM tenant_users tu2 WHERE tu2.tenant_id = t.id) AS user_count,
    t.business_type,
    t.preferred_region,
    t.db_provision_status,
    t.standalone_supabase_url,
    t.db_provisioned_at
  FROM tenants t
  LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.role = 'owner'
  LEFT JOIN auth.users u ON u.id = tu.user_id
  ORDER BY t.created_at DESC;
END;
$$;

-- RPC to record provisioning credentials for a client project
CREATE OR REPLACE FUNCTION admin_provision_client(
  p_tenant_id             UUID,
  p_supabase_url          TEXT,
  p_anon_key              TEXT,
  p_notes                 TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email NOT IN ('kits.tech.co@gmail.com') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE tenants
  SET
    standalone_supabase_url = p_supabase_url,
    standalone_anon_key     = p_anon_key,
    db_provision_status     = 'provisioned',
    db_provisioned_at       = NOW(),
    db_provision_notes      = p_notes
  WHERE id = p_tenant_id;
END;
$$;
