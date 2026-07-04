# F&B Tier 0 Fixes: Restore Delivery Webhook + AI Analytics Pipelines

**Date:** 2026-07-05
**Status:** Approved for implementation planning
**Source:** `docs/fnb-competitive-gap-analysis.md`, Part 3, Tier 0

## Problem

Two cleanup commits (`0ba94338`, `e4adf8bf`) correctly removed edge functions with zero callers at the time, but left four F&B screens presenting as functional while doing nothing:

1. **`DeliveryIntegrations.tsx`** generates and displays a live webhook URL (`.../functions/v1/delivery-webhook?platform=...&tenant=...`) for Toters/Talabat/Zomato/Careem. The `delivery-webhook` edge function was deleted — this URL 404s today. Any restaurant that configures a delivery platform with this URL gets nothing.
2. **Three analytics panels** — demand forecast (`RestaurantAnalytics.tsx` `ForecastTab`), menu engineering matrix (`MenuEngineeringMatrix.tsx`), and upsell suggestions (used in `WaiterInterface.tsx` via `useUpsellRules`) — all read from cache tables (`restaurant_demand_forecasts`, `restaurant_menu_engineering_cache`, `restaurant_upsell_rules`) that nothing writes to anymore. Their compute edge functions (`restaurant-demand-forecast`, `restaurant-menu-engineering`, `restaurant-upsell-compute`) were deleted as "unwired."

Investigation confirmed all four deleted functions were fully built, not stubs: their target tables, RPCs, and calling conventions still exist unchanged in the current schema. This is a restoration + wiring job.

**Explicitly out of scope:** `restaurant_delivery_orders` (customer name/phone/address, per-order status lanes `new→accepted→preparing→ready→picked_up→delivered`) has no UI anywhere in the codebase. Building that fulfillment screen is Tier 1 work ("Real delivery aggregator integration") per the gap-analysis roadmap, not this fix. This fix only makes the webhook stop 404ing and land orders into `table_orders` (visible in KDS/Waiter Interface as a generic order, tagged via the `notes` field: `DELIVERY: <platform> #<external_order_id>`).

## Design

### 1. Delivery webhook restoration

- Restore `supabase/functions/delivery-webhook/index.ts` verbatim from `git show e4adf8bf^:supabase/functions/delivery-webhook/index.ts`.
- No code changes needed: it already supports the exact `?platform=<id>&tenant=<id>` legacy call pattern `DeliveryIntegrations.tsx` uses, calls the still-existing `inject_delivery_order` RPC (migration `20260621_000039_restaurant_multi_branch.sql`), validates `webhook_secret` per-integration, and handles `auto_accept`.
- Deploy: `npx supabase functions deploy delivery-webhook --project-ref pytndxjeznhhyycjasep`.

### 2. AI analytics pipelines restoration

- Restore all three verbatim from `git show 0ba94338^:supabase/functions/<name>/index.ts`:
  - `restaurant-demand-forecast` (nightly 7-day forecast with Lebanese/MENA seasonality — Ramadan, public holidays, summer peak)
  - `restaurant-menu-engineering` (stars/plowhorses/puzzles/dogs classification)
  - `restaurant-upsell-compute` (association-rule upsell suggestions)
- Confirmed: none call an LLM (pure SQL/statistical compute over `restaurant_order_items`, `table_orders`, `tenants`) — no Groq/Anthropic routing concerns.
- Deploy each via `npx supabase functions deploy <name> --project-ref pytndxjeznhhyycjasep`.

### 3. Cron automation (new)

New migration `supabase/migrations/20260705_000050_fnb_analytics_cron.sql`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Service-role key is NOT stored in this file. After running this migration,
-- set it once via the Supabase SQL Editor (never commit the real value):
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');

create or replace function invoke_edge_function(function_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_key text;
  v_project_url text := 'https://pytndxjeznhhyycjasep.supabase.co';
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'service_role_key';

  if v_key is null then
    raise exception 'service_role_key not set in vault — run vault.create_secret first';
  end if;

  perform net.http_post(
    url := v_project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
end;
$$;

select cron.schedule('nightly-demand-forecast', '0 23 * * *',
  $$select invoke_edge_function('restaurant-demand-forecast')$$);
select cron.schedule('nightly-menu-engineering', '15 23 * * *',
  $$select invoke_edge_function('restaurant-menu-engineering')$$);
select cron.schedule('nightly-upsell-compute', '30 23 * * *',
  $$select invoke_edge_function('restaurant-upsell-compute')$$);
```

Design notes:
- Follows the same "schema in migration, secret set manually via dashboard" pattern already established in this codebase for the admin PIN (migration `20260619_000023_admin_pin_config_table.sql`), because `ALTER DATABASE` (the more common tutorial approach for storing secrets as GUCs) is not available in Supabase's hosted SQL Editor — this project already hit that exact wall once (migrations `000022`→`000023`).
- Jobs are staggered 15 minutes apart to avoid concurrent load on the same tables at midnight.
- Times are UTC; `23:00/23:15/23:30 UTC` ≈ 1–2am Beirut (UTC+2/+3 depending on DST) — approximate, matching the original function's "nightly ~2am Beirut" intent without over-engineering DST handling.
- `cron.job_run_details` (built into `pg_cron`) gives free execution history — no custom logging needed.

### 4. Verification plan

No staging environment exists, so verification is:
1. `npm run typecheck && npm run lint && npm run build` after restoring the four functions (schema/type compatibility check).
2. Manual smoke test per function: deploy, then invoke once directly (`supabase functions invoke <name> --project-ref ...` or a curl with the anon/service key) and confirm real rows appear in the target cache table.
3. Hand off the migration SQL + a post-migration verification query (`select * from cron.job_run_details order by start_time desc limit 5;`) for you to run in the Supabase Dashboard, since I cannot execute migrations against your live project.

### 5. Rollback

All changes are additive — no existing file or table is modified, only restored/added. Revert paths:
- Delivery webhook: redeploy the previous (deleted) state, or disable via the existing `is_active` toggle in `DeliveryIntegrations.tsx` per platform.
- Cron jobs: `select cron.unschedule('nightly-demand-forecast');` (etc.) — single statement per job.

## Out of scope (explicitly)

- `restaurant_delivery_orders` fulfillment UI (Tier 1).
- Customer table transfer, waiter table transfer, waitlist management (Tier 1 — separate spec).
- Preset order bundles (Tier 2 — separate spec).
