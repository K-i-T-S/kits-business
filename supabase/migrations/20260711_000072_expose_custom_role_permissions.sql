-- Custom-role enforcement, part 2 (Track 1b-iv,
-- docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
--
-- get_current_user_tenant() is the RPC SubscriptionContext.load() calls to
-- resolve plan/role. It never returned custom_role_id or the custom role's
-- permissions JSONB, so even with migration 000071's fix (custom_role_id
-- now propagates onto tenant_users at invite-accept time), the frontend
-- had no way to actually read and apply those permission overrides -
-- custom_roles.permissions has been stored but never consumed by anything
-- since the feature was first built. This closes that gap: adds
-- custom_role_id and custom_role_permissions (via a LEFT JOIN to
-- custom_roles) to the returned row.
--
-- DROP+CREATE (not CREATE OR REPLACE) because PostgreSQL doesn't allow
-- changing a RETURNS TABLE column list in place - same pattern already
-- used in this codebase (see 000014's admin_list_tenants fix). Purely
-- additive at the end of the column list; every existing consumer reads
-- named fields (PostgREST returns JSON objects, not positional arrays),
-- so this doesn't break any current caller.

DROP FUNCTION IF EXISTS public.get_current_user_tenant();

CREATE FUNCTION public.get_current_user_tenant()
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  user_role text,
  settings jsonb,
  subscription_plan text,
  subscription_status text,
  brand_logo_url text,
  brand_primary text,
  brand_secondary text,
  brand_tagline text,
  tax_rate numeric,
  secondary_currency text,
  exchange_rate numeric,
  show_dual_currency boolean,
  tin text,
  loyalty_enabled boolean,
  loyalty_points_per_dollar numeric,
  loyalty_points_redeem_rate numeric,
  industry text,
  custom_role_id uuid,
  custom_role_permissions jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    t.id,
    t.name,
    t.slug,
    tu.role,
    t.settings,
    t.subscription_plan,
    t.subscription_status,
    t.brand_logo_url,
    t.brand_primary,
    t.brand_secondary,
    t.brand_tagline,
    t.tax_rate,
    t.secondary_currency,
    t.exchange_rate,
    t.show_dual_currency,
    t.tin,
    t.loyalty_enabled,
    t.loyalty_points_per_dollar,
    t.loyalty_points_redeem_rate,
    t.industry,
    tu.custom_role_id,
    cr.permissions
  FROM tenants t
  JOIN tenant_users tu ON t.id = tu.tenant_id
  LEFT JOIN custom_roles cr ON cr.id = tu.custom_role_id
  WHERE tu.user_id = auth.uid()
    AND tu.is_active = true
    AND t.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_tenant() TO authenticated;
