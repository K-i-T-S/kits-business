-- Migration 000020: Extend get_current_user_tenant() to include
-- subscription_plan and subscription_status.
--
-- CREATE OR REPLACE cannot change the RETURNS TABLE shape, so we must
-- DROP first. Any code that depends on this function already uses
-- supabase.rpc('get_current_user_tenant') and expects positional or
-- named columns — adding columns at the end is safe for callers that
-- destructure by name (which all frontend and SubscriptionContext code does).
--
-- Safe to re-run: DROP IF EXISTS + CREATE.

DROP FUNCTION IF EXISTS get_current_user_tenant();

CREATE FUNCTION get_current_user_tenant()
RETURNS TABLE (
    tenant_id            UUID,
    tenant_name          TEXT,
    tenant_slug          TEXT,
    user_role            TEXT,
    settings             JSONB,
    subscription_plan    TEXT,
    subscription_status  TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        t.id,
        t.name,
        t.slug,
        tu.role,
        t.settings,
        t.subscription_plan,
        t.subscription_status
    FROM tenants t
    JOIN tenant_users tu ON t.id = tu.tenant_id
    WHERE tu.user_id = auth.uid()
      AND tu.is_active = true
      AND t.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_tenant() TO authenticated;
