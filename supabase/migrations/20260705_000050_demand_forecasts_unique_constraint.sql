-- Fix: restaurant_demand_forecasts was created (migration 20260622_000042_restaurant_ai.sql)
-- with a plain index on (tenant_id, date) but no UNIQUE constraint, even though the
-- restaurant-demand-forecast edge function has always relied on
-- .upsert(rows, { onConflict: 'tenant_id,date' }) for idempotent nightly overwrites.
-- Postgres requires an actual unique constraint/index matching the ON CONFLICT target,
-- so every upsert has failed with "no unique or exclusion constraint matching the ON
-- CONFLICT specification" since the table was created. Table is empty (verified via
-- `select count(*) from restaurant_demand_forecasts` = 0), so this is a safe additive fix.

ALTER TABLE restaurant_demand_forecasts
  ADD CONSTRAINT restaurant_demand_forecasts_tenant_date_key UNIQUE (tenant_id, date);
