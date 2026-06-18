-- Admin functions for KiTS internal use only
-- Both functions are SECURITY DEFINER and restricted to kits.tech.co@gmail.com

-- List all tenants (KiTS admin only)
CREATE OR REPLACE FUNCTION admin_list_tenants()
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  subscription_plan TEXT,
  subscription_status TEXT,
  created_at TIMESTAMPTZ,
  owner_email TEXT,
  user_count BIGINT
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
    u.email AS owner_email,
    (SELECT COUNT(*) FROM tenant_users tu2 WHERE tu2.tenant_id = t.id) AS user_count
  FROM tenants t
  LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.role = 'owner'
  LEFT JOIN auth.users u ON u.id = tu.user_id
  ORDER BY t.created_at DESC;
END;
$$;

-- Set tenant subscription plan (KiTS admin only)
CREATE OR REPLACE FUNCTION admin_set_tenant_plan(
  p_tenant_id UUID,
  p_plan TEXT,
  p_status TEXT DEFAULT 'active'
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
  IF p_plan NOT IN ('starter', 'growth', 'business') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;
  IF p_status NOT IN ('active', 'trialing', 'past_due', 'canceled') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;
  UPDATE tenants
  SET subscription_plan = p_plan, subscription_status = p_status
  WHERE id = p_tenant_id;
END;
$$;
