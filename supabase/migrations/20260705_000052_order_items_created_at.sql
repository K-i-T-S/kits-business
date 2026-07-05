-- Fix: restaurant_order_items (created in migration 20260620_000031_restaurant_schema.sql)
-- has no created_at column, even though the restaurant-upsell-compute edge function has
-- always relied on `.gte('created_at', sinceIso)` for its 90-day association-mining
-- lookback window. Pre-existing bug, unrelated to this restore — the function was marked
-- "unwired" when deleted, so it was never invoked end-to-end before this fix.
--
-- Table has only 7 rows in this project (verified via
-- `select count(*) from restaurant_order_items` = 7), so the one-time backfill-to-now for
-- existing rows (Postgres evaluates a volatile DEFAULT once per ALTER TABLE statement) is
-- inconsequential. All future INSERTs get a correct, real insert-time value. This matches
-- the existing created_at pattern already used elsewhere in this schema (e.g.
-- restaurant_upsell_rules.created_at, added in 20260622_000042_restaurant_ai.sql).

ALTER TABLE restaurant_order_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
