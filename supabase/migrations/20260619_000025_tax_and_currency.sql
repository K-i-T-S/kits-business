-- Migration 000025: Tax rate + multi-currency display columns on tenants.
-- Lebanese businesses need TVA (11%) on receipts and LBP equivalent display.
--
-- Adds to tenants:
--   tax_rate           NUMERIC(5,4)   — e.g. 0.1100 for Lebanon 11% TVA
--   secondary_currency TEXT           — e.g. 'LBP'
--   exchange_rate      NUMERIC(12,2)  — USD → secondary_currency rate
--   show_dual_currency BOOLEAN        — toggle LBP display on receipts/POS
--   tin                TEXT           — Tax Identification Number (required on receipts)
--
-- Also extends get_current_user_tenant() to return these columns.
-- Must include ALL existing columns — DROP+RECREATE changes the RETURNS TABLE shape.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tax_rate           NUMERIC(5,4)  DEFAULT 0.11,
  ADD COLUMN IF NOT EXISTS secondary_currency TEXT          DEFAULT 'LBP',
  ADD COLUMN IF NOT EXISTS exchange_rate      NUMERIC(12,2) DEFAULT 89500,
  ADD COLUMN IF NOT EXISTS show_dual_currency BOOLEAN       DEFAULT false,
  ADD COLUMN IF NOT EXISTS tin               TEXT;

-- Recreate get_current_user_tenant() with new columns appended.
-- Existing columns (from 000024): tenant_id, tenant_name, tenant_slug, user_role,
--   settings, subscription_plan, subscription_status, brand_logo_url, brand_primary,
--   brand_secondary, brand_tagline.
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
  brand_tagline       TEXT,
  tax_rate            NUMERIC,
  secondary_currency  TEXT,
  exchange_rate       NUMERIC,
  show_dual_currency  BOOLEAN,
  tin                 TEXT
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
    t.brand_tagline,
    t.tax_rate,
    t.secondary_currency,
    t.exchange_rate,
    t.show_dual_currency,
    t.tin
  FROM tenants t
  JOIN tenant_users tu ON t.id = tu.tenant_id
  WHERE tu.user_id = auth.uid()
    AND tu.is_active = true
    AND t.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_tenant() TO authenticated;
