-- Track 1a (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
-- restore the admin->owner RLS aliasing that migration 000021 added
-- ("so all existing policies work without modification") but that
-- migration 000064's rewrite (fixing the multi-tenant active-tenant bug,
-- 2026-07-09) silently dropped when it switched current_user_role() to
-- join through user_active_tenant instead of tenant_users directly.
--
-- Confirmed via pg_policies: all 11 policies that check current_user_role()
-- today (custom_roles, customers, employees, inventory_movements,
-- pending_invitations, products, sale_items, sales x2, tenant_users,
-- tenants) check for 'owner'/'manager'/'cashier' only -- none include
-- 'admin'. Since 2026-07-09, the KiTS platform-admin's tenant_users
-- 'admin' rows (see migration 000068's platform_admins/is_kits_staff
-- work) have had NO special DB-level access via any of these policies --
-- a real, previously-undocumented regression, not a new feature.
--
-- Deliberately NOT extended to supervisor/accountant/stockkeeper here --
-- unlike admin (which is meant to be owner-equivalent, a platform-staff
-- god-mode pattern), those three roles were never aliased even in the
-- original 000021 migration, and giving each of the 11 policies above
-- the right per-policy access for those roles is a real judgment call
-- (should stockkeeper delete a sale? should accountant manage employees?)
-- -- deferred to a dedicated, later pass, not bundled into this
-- single-function regression fix.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT CASE WHEN tu.role = 'admin' THEN 'owner' ELSE tu.role END
    FROM user_active_tenant uat
    JOIN tenant_users tu
      ON tu.tenant_id = uat.tenant_id
     AND tu.user_id   = uat.user_id
     AND tu.is_active  = true
    WHERE uat.user_id = auth.uid();
$$;
