-- Fixes BUG-088 (docs/qa-bug-tracker.md): StockkeeperHomeHub.tsx's
-- handleMarkReceived() updated restaurant_ingredients.current_stock via a
-- read-then-write (select current_stock, compute new value in JavaScript,
-- write it back) per line item -- the same unsafe race already fixed twice
-- this session via atomic RPCs (products.stock_quantity via
-- apply_product_stock_delta, migration 000078; customer_points via
-- apply_customer_points_delta, migration 000083), on a table that didn't
-- have one yet. Two stockkeepers marking overlapping purchase orders
-- received concurrently, with a shared ingredient, could lose one of the
-- two increments.
--
-- SECURITY INVOKER, matching apply_product_stock_delta's established
-- rationale -- restaurant_ingredients' existing RLS (tenant_id =
-- current_tenant_id(), ALL commands) already permits any authenticated
-- tenant member to read/write their own tenant's rows, so this only adds
-- atomicity, not privilege.
CREATE OR REPLACE FUNCTION public.apply_ingredient_stock_delta(p_ingredient_id uuid, p_delta numeric)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  UPDATE restaurant_ingredients
  SET current_stock = current_stock + p_delta, last_restocked_at = now()
  WHERE id = p_ingredient_id;
$$;
