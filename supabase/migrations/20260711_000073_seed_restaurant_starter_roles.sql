-- Pre-seed suggested starter custom roles for the restaurant vertical
-- (Track 1b-v, docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
--
-- Founder-confirmed pattern: "KiTS suggests, owner/manager customizes" --
-- same as Track 9's SOPs. Fires when a tenant's industry is set (or
-- changed) to 'restaurant', seeding 5 starter roles the owner can then
-- freely edit or delete via the existing CustomRolesManager CRUD UI --
-- this is a starting point, not a locked-in requirement.
--
-- Idempotent via the existing UNIQUE(tenant_id, name) constraint +
-- ON CONFLICT DO NOTHING, so re-firing (e.g. industry changed away from
-- and back to 'restaurant') never duplicates rows.
--
-- Base roles and permission overrides match the founder-approved mapping
-- from today's session:
--   Receptionist  - base cashier,    minus make_sales (no checkout duties)
--   Waiter        - base cashier,    as-is (WaiterInterface.tsx already
--                   gates real actions behind make_sales)
--   Head Chef     - base supervisor, plus manage_products (menu/recipe
--                   authority beyond a line supervisor)
--   Sous Chef     - base stockkeeper, as-is
--   Argile Staff  - base cashier,    as-is (tobacco refills are billable
--                   events per the argile schema)

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

  INSERT INTO public.custom_roles (tenant_id, name, display_name, base_role, permissions)
  VALUES
    (NEW.id, 'receptionist', 'Receptionist', 'cashier', '{"make_sales": false}'::jsonb),
    (NEW.id, 'waiter', 'Waiter', 'cashier', '{}'::jsonb),
    (NEW.id, 'head_chef', 'Head Chef', 'supervisor', '{"manage_products": true}'::jsonb),
    (NEW.id, 'sous_chef', 'Sous Chef', 'stockkeeper', '{}'::jsonb),
    (NEW.id, 'argile_staff', 'Argile Staff', 'cashier', '{}'::jsonb)
  ON CONFLICT (tenant_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_restaurant_starter_roles ON public.tenants;
CREATE TRIGGER trg_seed_restaurant_starter_roles
  AFTER INSERT OR UPDATE OF industry ON public.tenants
  FOR EACH ROW
  WHEN (NEW.industry = 'restaurant')
  EXECUTE FUNCTION public.seed_restaurant_starter_roles();

-- Backfill: the trigger only fires on future inserts/updates, so existing
-- restaurant tenants (set up before this migration) need the same seed
-- applied once, retroactively.
INSERT INTO public.custom_roles (tenant_id, name, display_name, base_role, permissions)
SELECT t.id, r.name, r.display_name, r.base_role, r.permissions
FROM public.tenants t
CROSS JOIN (VALUES
  ('receptionist', 'Receptionist', 'cashier', '{"make_sales": false}'::jsonb),
  ('waiter', 'Waiter', 'cashier', '{}'::jsonb),
  ('head_chef', 'Head Chef', 'supervisor', '{"manage_products": true}'::jsonb),
  ('sous_chef', 'Sous Chef', 'stockkeeper', '{}'::jsonb),
  ('argile_staff', 'Argile Staff', 'cashier', '{}'::jsonb)
) AS r(name, display_name, base_role, permissions)
WHERE t.industry = 'restaurant'
ON CONFLICT (tenant_id, name) DO NOTHING;
