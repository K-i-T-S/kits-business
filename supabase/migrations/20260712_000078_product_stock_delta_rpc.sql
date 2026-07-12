-- Track: offline-first architecture, Phase 1b (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
-- Used by src/powersync/connector.ts's uploadData() to apply
-- products.stock_quantity changes as a delta (new - previous, computed
-- client-side via the schema's trackPrevious option) rather than an
-- absolute overwrite -- the founder-locked conflict rule for inventory,
-- so two terminals decrementing the same item offline both count instead
-- of the second sync clobbering the first.
--
-- SECURITY INVOKER deliberately: runs as the calling (authenticated) user,
-- so products' existing RLS policies still apply normally -- no privilege
-- escalation, this is purely an atomic-increment helper.
CREATE OR REPLACE FUNCTION apply_product_stock_delta(p_product_id uuid, p_delta integer)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = 'public'
AS $$
  UPDATE products SET stock_quantity = stock_quantity + p_delta WHERE id = p_product_id;
$$;
