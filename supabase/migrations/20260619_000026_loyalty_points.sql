-- ── Migration 000026: Customer Loyalty Points System ──────────────────────────
-- Growth plan feature. Adds:
--   • customer_points  — one row per customer per tenant (running balance + tier)
--   • point_transactions — immutable ledger of every earn/redeem/adjust/expire
--   • loyalty config columns on tenants table
--   • get_current_user_tenant() extended with loyalty columns

-- ── Tables ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, customer_id)
);

CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'adjusted', 'expired')),
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.customer_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Drop first in case migration is re-run
DROP POLICY IF EXISTS "tenant_isolation_customer_points" ON public.customer_points;
DROP POLICY IF EXISTS "tenant_isolation_point_transactions" ON public.point_transactions;

CREATE POLICY "tenant_isolation_customer_points" ON public.customer_points
  USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_isolation_point_transactions" ON public.point_transactions
  USING (tenant_id = current_tenant_id());

-- ── Loyalty config on tenants ──────────────────────────────────────────────────

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_dollar NUMERIC(6,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS loyalty_points_redeem_rate NUMERIC(6,4) DEFAULT 0.01;
  -- redeem_rate: 0.01 means 1 point = $0.01 (100 points = $1)

-- ── Extend get_current_user_tenant() with loyalty columns ─────────────────────
-- Must DROP + RECREATE because RETURNS TABLE shape is changing.
-- This includes ALL columns from migration 000025 to avoid breaking existing
-- queries.

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
  tin                 TEXT,
  loyalty_enabled            BOOLEAN,
  loyalty_points_per_dollar  NUMERIC,
  loyalty_points_redeem_rate NUMERIC
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
    t.loyalty_points_redeem_rate
  FROM tenants t
  JOIN tenant_users tu ON t.id = tu.tenant_id
  WHERE tu.user_id = auth.uid()
    AND tu.is_active = true
    AND t.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_tenant() TO authenticated;
