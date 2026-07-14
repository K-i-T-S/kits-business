-- Fixes BUG-054 (delivery sales have zero employee attribution) and
-- BUG-055 (no idempotency on retry) fully; makes a genuine, honest partial
-- fix for BUG-053 (docs/qa-bug-tracker.md).
--
-- BUG-053, corrected on investigation: the original finding described this
-- as "same bug class as BUG-033" (real values computed but not threaded
-- through). That's not what's actually happening here -- independently
-- verified live: restaurant_delivery_orders has NO discount_usd/tax_usd
-- columns at all, and inject_delivery_order (the webhook intake function)
-- doesn't even capture subtotal_usd from the platform payload, only a lump
-- total_usd. There is no real tax/discount data anywhere upstream to pass
-- through -- capturing it would need per-platform (Toters/Talabat/Zomato/
-- Careem) webhook payload research, a materially larger and less certain
-- piece of work than this fix. This migration adds the columns and makes
-- complete_delivery_order carry real values once/if webhook intake is later
-- extended to populate them, rather than fabricating numbers that don't
-- exist today. discount/tax_amount on the resulting sale remain 0 for now
-- -- that's honest given no source data exists, not a remaining bug in this
-- function.
--
-- BUG-055, re-assessed on investigation: the existing SELECT ... FOR UPDATE
-- already makes a genuinely concurrent double-click race-safe at the
-- Postgres level -- the second call blocks until the first commits, then
-- sees status <> 'ready' and would raise. The real gap was narrower than
-- described: a *sequential* retry (e.g. a flaky-network client retrying
-- after the first call actually succeeded server-side but the response was
-- lost) hit a hard error instead of idempotently returning the
-- already-created sale. Fixed: if status is already 'picked_up', look up
-- and return the existing sale rather than erroring.
--
-- BUG-054: resolves the calling employee via employees.user_id = auth.uid()
-- (Track 1's employee<->tenant_user linkage) and stamps sales.employee_id,
-- matching how dine-in sales are attributed. Falls back to NULL (not an
-- error) if no employee row is linked -- attribution is a nice-to-have here,
-- never a blocker on completing a real delivery.
ALTER TABLE public.restaurant_delivery_orders
  ADD COLUMN IF NOT EXISTS discount_usd numeric,
  ADD COLUMN IF NOT EXISTS tax_usd numeric;

CREATE OR REPLACE FUNCTION public.complete_delivery_order(p_delivery_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_status TEXT;
  v_table_order_id UUID;
  v_platform TEXT;
  v_external_order_id TEXT;
  v_subtotal_usd NUMERIC;
  v_total_usd NUMERIC;
  v_discount_usd NUMERIC;
  v_tax_usd NUMERIC;
  v_sale_id UUID;
  v_employee_id UUID;
BEGIN
  SELECT tenant_id, status, table_order_id, platform, external_order_id, subtotal_usd, total_usd, discount_usd, tax_usd
    INTO v_tenant_id, v_status, v_table_order_id, v_platform, v_external_order_id, v_subtotal_usd, v_total_usd, v_discount_usd, v_tax_usd
    FROM restaurant_delivery_orders
    WHERE id = p_delivery_order_id
    FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Delivery order % not found', p_delivery_order_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Idempotent retry (BUG-055): a sequential retry of an already-completed
  -- completion returns the sale that was already created instead of
  -- erroring or creating a duplicate.
  IF v_status = 'picked_up' THEN
    SELECT id INTO v_sale_id FROM sales WHERE table_order_id = v_table_order_id AND source = 'delivery' LIMIT 1;
    IF v_sale_id IS NOT NULL THEN
      RETURN v_sale_id;
    END IF;
    -- picked_up with no matching sale is a genuinely inconsistent state --
    -- fall through to the status guard below rather than guess.
  END IF;

  IF v_status <> 'ready' THEN
    RAISE EXCEPTION 'Delivery order % is not completable (status = %)', p_delivery_order_id, v_status;
  END IF;

  -- BUG-054: attribute the sale to whoever completed it, matching dine-in.
  SELECT id INTO v_employee_id FROM employees WHERE user_id = auth.uid() AND tenant_id = v_tenant_id LIMIT 1;

  UPDATE restaurant_delivery_orders SET status = 'picked_up' WHERE id = p_delivery_order_id;
  UPDATE table_orders SET status = 'paid', closed_at = now() WHERE id = v_table_order_id;

  INSERT INTO sales (
    tenant_id, subtotal, discount, tax_amount, total_amount,
    payment_method, payment_status, notes, sale_date, table_order_id, source, employee_id
  ) VALUES (
    v_tenant_id,
    COALESCE(v_subtotal_usd, 0), COALESCE(v_discount_usd, 0), COALESCE(v_tax_usd, 0), COALESCE(v_total_usd, 0),
    'platform', 'completed',
    v_platform || ' #' || v_external_order_id,
    now(), v_table_order_id, 'delivery', v_employee_id
  ) RETURNING id INTO v_sale_id;

  RETURN v_sale_id;
END;
$function$;
