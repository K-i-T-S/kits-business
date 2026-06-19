-- Migration 000024: Brand identity columns on tenants.
-- Allows each tenant to customise their logo, colours, and tagline.
-- KiTS branding ("Powered by KiTS") is always rendered client-side and cannot be removed.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS brand_logo_url    TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary     TEXT NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS brand_secondary   TEXT NOT NULL DEFAULT '#0ea5e9',
  ADD COLUMN IF NOT EXISTS brand_tagline     TEXT;

-- Expose these columns in get_current_user_tenant() so the frontend
-- gets brand data on login without an extra query.
DROP FUNCTION IF EXISTS get_current_user_tenant();

CREATE FUNCTION get_current_user_tenant()
RETURNS TABLE (
  tenant_id           UUID,
  tenant_name         TEXT,
  tenant_slug         TEXT,
  user_role           TEXT,
  settings            JSONB,
  subscription_plan   TEXT,
  subscription_status TEXT,
  brand_logo_url      TEXT,
  brand_primary       TEXT,
  brand_secondary     TEXT,
  brand_tagline       TEXT
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
    t.subscription_status,
    t.brand_logo_url,
    t.brand_primary,
    t.brand_secondary,
    t.brand_tagline
  FROM tenants t
  JOIN tenant_users tu ON t.id = tu.tenant_id
  WHERE tu.user_id = auth.uid()
    AND tu.is_active = true
    AND t.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_tenant() TO authenticated;

-- Storage bucket for brand assets (logos, favicons).
-- Create via Supabase Dashboard → Storage → New Bucket → name: brand-assets, public: false
-- Then add the policy below via SQL or the Dashboard policy editor.
-- (Supabase Storage buckets cannot be created via SQL migrations — use the Dashboard.)
