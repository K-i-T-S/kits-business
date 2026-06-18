-- ============================================================
-- Fix: admin_list_tenants — type mismatch 42804.
-- auth.users.email is character varying(255); RETURNS TABLE
-- declares owner_email as TEXT. PostgreSQL strict return-type
-- matching rejects the implicit coercion (column 7).
-- Fix: explicit ::TEXT cast on every string column so the
-- function signature matches regardless of underlying column type.
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
  SELECT au.email INTO v_user_email FROM auth.users au WHERE au.id = auth.uid();
  IF v_user_email NOT IN ('kits.tech.co@gmail.com') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    t.id,
    t.name::TEXT,
    t.slug::TEXT,
    t.subscription_plan::TEXT,
    t.subscription_status::TEXT,
    t.created_at,
    u.email::TEXT                                                              AS owner_email,
    (SELECT COUNT(*) FROM tenant_users tu2 WHERE tu2.tenant_id = t.id)::BIGINT AS user_count,
    t.business_type::TEXT,
    t.preferred_region::TEXT,
    t.db_provision_status::TEXT,
    t.standalone_supabase_url::TEXT,
    t.db_provisioned_at
  FROM tenants t
  LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.role = 'owner'
  LEFT JOIN auth.users u    ON u.id = tu.user_id
  ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_tenants() TO authenticated;
