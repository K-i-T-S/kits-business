-- Platform-admin identity separation (Tier 0.7, docs/superpowers/specs/2026-07-11-platform-roadmap-design.md)
--
-- Problem: "KiTS platform staff" identity was implemented as a hardcoded email
-- string ('kits.tech.co@gmail.com') independently duplicated across 5 live
-- SECURITY DEFINER functions (admin_list_tenants, admin_set_tenant_plan,
-- admin_provision_client, verify_admin_pin, add_kits_admin_to_tenant) plus
-- 2 more checks in src/pages/AdminPanel.tsx. It also overloaded the tenant-
-- scoped 'admin' role: add_kits_admin_to_tenant() auto-inserted that one
-- email as role='admin' into every tenant's own tenant_users table, so the
-- string 'admin' meant two different things depending on which email held
-- the row ("this business's admin-tier employee" vs "KiTS platform staff").
--
-- Fix: a real platform_admins table + is_kits_staff() SECURITY DEFINER
-- function as the single source of truth. All 5 functions above now check
-- is_kits_staff() instead of comparing auth.uid()'s email to a literal
-- string. add_kits_admin_to_tenant() is generalized to grant every current
-- platform_admins row admin access to new tenants (was: exactly one
-- hardcoded email) -- this preserves today's actual behavior for the
-- existing KiTS staff account while making the mechanism table-driven.
--
-- Deliberately NOT touched in this migration: the existing tenant_users
-- 'admin' rows already created by the old trigger, and the existing
-- 'admin' role's aliasing to 'owner' in current_user_role() -- retiring
-- that in-tenant support-access pattern is a separate design decision,
-- not a side effect of this identity-source cleanup.

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
-- No client-facing RLS policies: this table is only ever read/written by
-- SECURITY DEFINER functions below, never queried directly by the app.

INSERT INTO public.platform_admins (user_id, notes)
SELECT id, 'Seeded from the pre-existing hardcoded kits.tech.co@gmail.com pattern'
FROM auth.users
WHERE email = 'kits.tech.co@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_kits_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_kits_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_tenants()
RETURNS TABLE(id uuid, name text, slug text, subscription_plan text, subscription_status text, created_at timestamp with time zone, owner_email text, user_count bigint, business_type text, preferred_region text, db_provision_status text, standalone_supabase_url text, db_provisioned_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_kits_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT t.id, t.name::TEXT, t.slug::TEXT, t.subscription_plan::TEXT, t.subscription_status::TEXT,
    t.created_at, u.email::TEXT AS owner_email,
    (SELECT COUNT(*) FROM tenant_users tu2 WHERE tu2.tenant_id = t.id)::BIGINT AS user_count,
    t.business_type::TEXT, t.preferred_region::TEXT, t.db_provision_status::TEXT,
    t.standalone_supabase_url::TEXT, t.db_provisioned_at
  FROM tenants t
  LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.role = 'owner'
  LEFT JOIN auth.users u ON u.id = tu.user_id
  ORDER BY t.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_plan(p_tenant_id uuid, p_plan text, p_status text DEFAULT 'active'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_kits_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_plan NOT IN ('starter', 'growth', 'business') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;
  IF p_status NOT IN ('active', 'trialing', 'past_due', 'canceled') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;
  UPDATE tenants SET subscription_plan = p_plan, subscription_status = p_status WHERE id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_provision_client(p_tenant_id uuid, p_supabase_url text, p_anon_key text, p_notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_kits_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE tenants SET standalone_supabase_url = p_supabase_url, standalone_anon_key = p_anon_key,
    db_provision_status = 'provisioned', db_provisioned_at = NOW(), db_provision_notes = p_notes
  WHERE id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_pin(attempt text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'extensions', 'public'
AS $$
DECLARE
  stored TEXT;
BEGIN
  IF NOT public.is_kits_staff() THEN
    RETURN FALSE;
  END IF;
  SELECT value INTO stored FROM public.kits_admin_config WHERE key = 'admin_pin_hash';
  IF stored IS NULL OR stored = 'not-configured' THEN
    RAISE EXCEPTION 'Admin PIN not configured';
  END IF;
  RETURN crypt(attempt, stored) = stored;
END;
$$;

-- Generalized: grants tenant-level 'admin' access to every current
-- platform_admins row, not just one hardcoded email. Preserves existing
-- behavior (the seeded row above is the same account the old version
-- granted) while making future platform-admin additions automatic.
CREATE OR REPLACE FUNCTION public.add_kits_admin_to_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when the first owner is added (tenant just created)
  IF NEW.role != 'owner' THEN RETURN NEW; END IF;
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  SELECT NEW.tenant_id, pa.user_id, 'admin'
  FROM public.platform_admins pa
  WHERE pa.user_id != NEW.user_id
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
