-- Track 2, Phase A (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
-- role-native landing screens for the four archetypes with a real
-- dedicated screen already built (Waiter, Kitchen, Argile, POS/Cashier).
--
-- Adds `home_hub` to custom_roles, decoupled from `base_role`/`permissions`
-- (which stay purely about RLS/action-level access) but constrained to a
-- known enum and only ever set to values the frontend restricts based on
-- the role's chosen base_role — this avoids the login redirect-bounce
-- failure mode an adversarial review flagged for a fully free-text field
-- (RoleRoute would immediately redirect a role that can't reach its own
-- assigned home_hub straight back to /dashboard on every login).
--
-- 'owner'/'admin'/'accountant'/'viewer' base roles get no Phase A option
-- (none of the four hubs are reachable by those base roles per App.tsx's
-- RoleRoute allowedRoles); the office-role hubs (owner/manager/supervisor/
-- accountant/stockkeeper/reception) are explicitly deferred to Phase B.

ALTER TABLE public.custom_roles
  ADD COLUMN IF NOT EXISTS home_hub TEXT
  CHECK (home_hub IS NULL OR home_hub IN ('waiter', 'kitchen', 'argile', 'pos_cashier'));

-- Assign home_hub to the existing restaurant starter roles (migration 000073).
UPDATE public.custom_roles SET home_hub = 'waiter' WHERE name = 'waiter' AND home_hub IS NULL;
UPDATE public.custom_roles SET home_hub = 'argile' WHERE name = 'argile_staff' AND home_hub IS NULL;
UPDATE public.custom_roles SET home_hub = 'kitchen' WHERE name IN ('head_chef', 'sous_chef') AND home_hub IS NULL;
-- Receptionist gets no Phase A hub (no dedicated reception screen yet) —
-- stays NULL, falls back to the existing generic landing.

-- Extend the starter-role seed trigger with a 6th role: "Kitchen Staff",
-- for line cooks with no elevated Head Chef/Sous Chef authority. Base
-- 'cashier' matches the Waiter/Argile Staff pattern for hourly line-level
-- staff; /restaurant/kds's RoleRoute already allows 'cashier'.
CREATE OR REPLACE FUNCTION public.seed_restaurant_starter_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.industry != 'restaurant' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.industry IS NOT DISTINCT FROM NEW.industry THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.custom_roles (tenant_id, name, display_name, base_role, permissions, home_hub)
  VALUES
    (NEW.id, 'receptionist', 'Receptionist', 'cashier', '{"make_sales": false}'::jsonb, NULL),
    (NEW.id, 'waiter', 'Waiter', 'cashier', '{}'::jsonb, 'waiter'),
    (NEW.id, 'head_chef', 'Head Chef', 'supervisor', '{"manage_products": true}'::jsonb, 'kitchen'),
    (NEW.id, 'sous_chef', 'Sous Chef', 'stockkeeper', '{}'::jsonb, 'kitchen'),
    (NEW.id, 'kitchen_staff', 'Kitchen Staff', 'cashier', '{}'::jsonb, 'kitchen'),
    (NEW.id, 'argile_staff', 'Argile Staff', 'cashier', '{}'::jsonb, 'argile')
  ON CONFLICT (tenant_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill "Kitchen Staff" for existing restaurant tenants (the trigger
-- only fires on future industry inserts/updates, same reasoning as 000073).
INSERT INTO public.custom_roles (tenant_id, name, display_name, base_role, permissions, home_hub)
SELECT t.id, 'kitchen_staff', 'Kitchen Staff', 'cashier', '{}'::jsonb, 'kitchen'
FROM public.tenants t
WHERE t.industry = 'restaurant'
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Extend get_current_user_tenant() to also return the resolved custom
-- role's home_hub, so the frontend can redirect a just-authenticated user
-- straight to it without a second round-trip query. Return-type change
-- requires DROP+CREATE (same reason migration 000072 needed it); every
-- other column/clause below is copied verbatim from the live
-- pg_get_functiondef() output as of this migration, not reconstructed
-- from prior migration files, to avoid silently dropping something a
-- later, undocumented change had already added (e.g. this function does
-- NOT join user_active_tenant -- it filters tu.is_active/t.is_active
-- directly, which is not what earlier session notes assumed).
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
  custom_role_permissions jsonb,
  home_hub text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    cr.permissions,
    cr.home_hub
  FROM tenants t
  JOIN tenant_users tu ON t.id = tu.tenant_id
  LEFT JOIN custom_roles cr ON cr.id = tu.custom_role_id
  WHERE tu.user_id = auth.uid()
    AND tu.is_active = true
    AND t.is_active = true;
$function$;

-- Preserve the exact grant state DROP FUNCTION would otherwise reset —
-- verified via information_schema.routine_privileges before writing this:
-- PUBLIC (and therefore postgres/anon/authenticated/service_role) all had
-- EXECUTE. Restoring it explicitly rather than relying on Postgres's
-- default-grants-to-PUBLIC behavior for a freshly created function.
GRANT EXECUTE ON FUNCTION public.get_current_user_tenant() TO PUBLIC;
