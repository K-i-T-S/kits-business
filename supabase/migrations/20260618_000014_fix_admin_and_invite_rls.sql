-- ============================================================
-- Fix 1: admin_list_tenants — DROP + RECREATE to add provisioning columns
--   CREATE OR REPLACE cannot change RETURNS TABLE shape.
-- Fix 2: pending_invitations SELECT RLS for invited users
--   TenantSelection queries this BEFORE a tenant is selected, so
--   current_tenant_id() is NULL and the existing tenant-scoped
--   policies block the query. Allow users to read their own invites.
-- ============================================================

-- ── Fix 1: admin_list_tenants ─────────────────────────────────────────────────

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

-- ── Fix 2: pending_invitations — allow users to read their own invites ────────
-- Needed so TenantSelection can redirect to /accept-invite before tenant
-- context is set (current_tenant_id() would return NULL at that point).

DROP POLICY IF EXISTS "users_can_read_own_invitations" ON pending_invitations;

CREATE POLICY "users_can_read_own_invitations"
  ON pending_invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(
      (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
    )
  );
