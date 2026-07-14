-- Fixes BUG-038 (docs/qa-bug-tracker.md): TipsManagement.tsx's tip-split
-- distribution records (`tips_records_${tenantId}`) were localStorage-only
-- -- confirmed no tip_distributions/similar table exists anywhere in the
-- migration history. A real money-distribution record was therefore
-- device-local, lost on browser data clear, and invisible to a manager
-- logging in from a different terminal.
--
-- Stores `breakdown` as jsonb matching the frontend's existing shape
-- (name/amount pairs) rather than a normalized per-employee child table:
-- two of the four split algorithms (role_split, and the "pool" portion of
-- waiter_pool) distribute by role/pool, not to individual named employees,
-- so a strict per-employee foreign-keyed table wouldn't fit all cases
-- without either fabricating per-employee splits the algorithm never
-- computed, or a nullable employee_id -- the jsonb shape is what's actually
-- being decided each time, an honest match rather than a synthetic
-- normalization.
CREATE TABLE IF NOT EXISTS public.restaurant_tip_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  distribution_date date NOT NULL,
  total_tips_usd numeric NOT NULL,
  algorithm text NOT NULL,
  breakdown jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tip_distributions_tenant_date
  ON public.restaurant_tip_distributions (tenant_id, distribution_date DESC);

ALTER TABLE public.restaurant_tip_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_tip_distributions" ON public.restaurant_tip_distributions
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
