-- ── Migration 000030: Industry Column & Vertical Routing ──────────────────────
-- The `industry` column was added in 000004_onboarding.sql.
-- This migration extends get_current_user_tenant() to expose it to the frontend.

-- Backfill: copy business_type → industry for tenants that set it during onboarding
UPDATE tenants SET industry = LOWER(
  CASE business_type
    WHEN 'Food & Beverage' THEN 'restaurant'
    WHEN 'Pharmacy'        THEN 'pharmacy'
    WHEN 'Supermarket'     THEN 'supermarket'
    WHEN 'Clothing & Fashion' THEN 'fashion'
    WHEN 'Electronics'     THEN 'electronics'
    ELSE 'retail'
  END
) WHERE industry IS NULL AND business_type IS NOT NULL;

-- Extend get_current_user_tenant() to include industry.
-- Must DROP + RECREATE because RETURNS TABLE shape is changing.

DROP FUNCTION IF EXISTS get_current_user_tenant();

CREATE FUNCTION get_current_user_tenant()
RETURNS TABLE (
  tenant_id                  UUID,
  tenant_name                TEXT,
  tenant_slug                TEXT,
  user_role                  TEXT,
  settings                   JSONB,
  subscription_plan          TEXT,
  subscription_status        TEXT,
  brand_logo_url             TEXT,
  brand_primary              TEXT,
  brand_secondary            TEXT,
  brand_tagline              TEXT,
  tax_rate                   NUMERIC,
  secondary_currency         TEXT,
  exchange_rate              NUMERIC,
  show_dual_currency         BOOLEAN,
  tin                        TEXT,
  loyalty_enabled            BOOLEAN,
  loyalty_points_per_dollar  NUMERIC,
  loyalty_points_redeem_rate NUMERIC,
  industry                   TEXT
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
    t.tin,
    t.loyalty_enabled,
    t.loyalty_points_per_dollar,
    t.loyalty_points_redeem_rate,
    t.industry
  FROM tenants t
  JOIN tenant_users tu ON t.id = tu.tenant_id
  WHERE tu.user_id = auth.uid()
    AND tu.is_active = true
    AND t.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_tenant() TO authenticated;
