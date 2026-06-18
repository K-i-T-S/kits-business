-- ============================================================
-- Fix: admin_list_tenants — unqualified `id` is ambiguous in PL/pgSQL.
-- RETURNS TABLE declares `id UUID` as an OUT parameter.
-- The line `WHERE id = auth.uid()` inside the body was unqualified,
-- causing PostgreSQL 42702 "column reference id is ambiguous".
-- Fix: add table alias `au` on auth.users in the email lookup.
-- ============================================================

DROP FUNCTION IF EXISTS admin_list_tenants();

CREATE FUNCTION admin_list_tenants()
RETURNS TABLE(
  id                      UUID,
  name                    TEXT,
  slug                    TEXT,
  subscription_plan       TEXT,
  subscription_status     TEXT,
  created_at              TIMESTAMPTZ,
  owner_email             TEXT,
  user_count              BIGINT,
  business_type           TEXT,
  preferred_region        TEXT,
  db_provision_status     TEXT,
  standalone_supabase_url TEXT,
  db_provisioned_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Use alias `au` so `au.id` is unambiguous (RETURNS TABLE also declares `id` as an OUT param)
  SELECT au.email INTO v_user_email FROM auth.users au WHERE au.id = auth.uid();
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
    (SELECT COUNT(*) FROM tenant_users tu2 WHERE tu2.tenant_id = t.id)::BIGINT AS user_count,
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

GRANT EXECUTE ON FUNCTION admin_list_tenants() TO authenticated;
