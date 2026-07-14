-- Fixes BUG-035 and BUG-034 (docs/qa-bug-tracker.md):
--   BUG-035 (Critical) -- POS.tsx calls supabase.rpc('upsert_customer_points', ...)
--     on every sale to a loyalty-enrolled customer. Independently confirmed live
--     via pg_proc: no such function has ever existed. Loyalty points have likely
--     never been earned on a single real sale, for any tenant, ever, silently
--     (the call is fire-and-forget with zero error handling).
--   BUG-034 (Medium) -- the redemption path (and, found while fixing this, the
--     manual "Adjust Points" flow in LoyaltyPanel.tsx's AdjustPointsModal -- same
--     bug class, not separately numbered) both read points_balance, compute the
--     new value in JavaScript, then write it back -- the same unsafe
--     read-then-write race already fixed once for stock receiving (BUG-031).
--
-- One atomic RPC closes all three call sites (POS earn, POS redeem, manual
-- adjust) rather than three separate patches, since all three were hitting the
-- same nonexistent/unsafe loyalty-points layer.
--
-- SECURITY INVOKER, matching apply_product_stock_delta's (migration 000078)
-- established rationale: customer_points/point_transactions' existing RLS
-- policies (USING (tenant_id = current_tenant_id()), no explicit WITH CHECK,
-- so Postgres reuses USING as the insert check) already permit any
-- authenticated tenant member to read/write their own tenant's rows -- this
-- RPC only adds atomicity, not privilege.
--
-- Tier thresholds (bronze < 500 <= silver < 2000 <= gold) are not a new
-- decision -- they mirror LoyaltyPanel.tsx's existing computeTier() exactly,
-- already live and customer-facing (LoyaltyPanel.tsx:30-33), so this RPC
-- stays consistent with what customers already see rather than introducing a
-- second, divergent threshold.
CREATE OR REPLACE FUNCTION public.apply_customer_points_delta(
  p_customer_id uuid,
  p_delta integer,
  p_type text,
  p_sale_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID := current_tenant_id();
  v_balance INTEGER;
  v_lifetime INTEGER;
  v_tier TEXT;
BEGIN
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'no_active_tenant';
  END IF;

  IF p_type NOT IN ('earned', 'redeemed', 'adjusted', 'expired') THEN
    RAISE EXCEPTION 'invalid_type: %', p_type;
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'invalid_delta: %', p_delta;
  END IF;

  INSERT INTO customer_points (tenant_id, customer_id, points_balance, lifetime_points, tier)
  VALUES (
    v_tenant_id,
    p_customer_id,
    GREATEST(0, p_delta),
    GREATEST(0, p_delta),
    CASE WHEN GREATEST(0, p_delta) >= 2000 THEN 'gold' WHEN GREATEST(0, p_delta) >= 500 THEN 'silver' ELSE 'bronze' END
  )
  ON CONFLICT (tenant_id, customer_id) DO UPDATE SET
    points_balance = GREATEST(0, customer_points.points_balance + p_delta),
    lifetime_points = customer_points.lifetime_points + GREATEST(0, p_delta),
    tier = CASE
      WHEN (customer_points.lifetime_points + GREATEST(0, p_delta)) >= 2000 THEN 'gold'
      WHEN (customer_points.lifetime_points + GREATEST(0, p_delta)) >= 500 THEN 'silver'
      ELSE 'bronze'
    END,
    updated_at = now()
  RETURNING points_balance, lifetime_points, tier INTO v_balance, v_lifetime, v_tier;

  INSERT INTO point_transactions (tenant_id, customer_id, sale_id, type, points, balance_after, description)
  VALUES (v_tenant_id, p_customer_id, p_sale_id, p_type, p_delta, v_balance, p_description);

  RETURN jsonb_build_object('points_balance', v_balance, 'lifetime_points', v_lifetime, 'tier', v_tier);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_customer_points_delta(uuid, integer, text, uuid, text) TO authenticated;
