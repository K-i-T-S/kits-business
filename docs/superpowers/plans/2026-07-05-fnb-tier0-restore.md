# F&B Tier 0 Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the `delivery-webhook` edge function and the three dead-cache AI analytics edge functions (`restaurant-demand-forecast`, `restaurant-menu-engineering`, `restaurant-upsell-compute`), deploy them, and wire the three analytics functions to real nightly `pg_cron` automation — so four currently-broken/decorative F&B screens start working.

**Architecture:** All four functions already exist verbatim in git history (deleted by cleanup commits `e4adf8bf` and `0ba94338` for having zero callers at the time) and their target tables/RPCs are still live and unchanged. This is byte-for-byte restoration + redeploy + one new migration — no new application code, no schema changes to existing tables.

**Tech Stack:** Supabase Edge Functions (Deno), Supabase CLI (`npx supabase`, already linked to project ref `pytndxjeznhhyycjasep`), PostgreSQL `pg_cron`/`pg_net`/Vault extensions.

## Global Constraints

- Deploy target is project ref `pytndxjeznhhyycjasep` ("kits-dev", confirmed `ACTIVE_HEALTHY` and linked via `npx supabase projects list`).
- None of the four functions call any LLM provider (verified: no Groq/Anthropic imports) — no conflict with the project's Groq-only AI convention.
- Migrations are applied manually via Supabase Dashboard → SQL Editor per this project's established convention (see `CLAUDE.md` "Database Migrations" section) — this plan creates the migration file but does **not** run it against the live database automatically.
- Never write the real service-role key value into any file committed to git. The Vault secret is set by the user, once, directly in the SQL Editor.
- Next migration sequence number was `000050` (last existing was `20260624_000049_restaurant_purchase_orders.sql`); `000050` was consumed mid-execution by an unplanned constraint fix discovered during Task 2 (see Task 2 Addendum below), so Task 5's cron migration is now `000051`.
- `delivery-webhook` must deploy with `--no-verify-jwt` — it's called by third-party platforms (Toters/Talabat/Zomato/Careem) that will never have a Supabase JWT; its own `x-webhook-secret` header check (already in the restored code) is the real auth boundary. The three AI functions keep normal JWT verification (only `pg_cron`, using the service-role key, calls them).

---

### Task 1: Restore and deploy `delivery-webhook`

**Files:**
- Create: `supabase/functions/delivery-webhook/index.ts`

**Interfaces:**
- Consumes: existing RPC `inject_delivery_order(p_tenant_id, p_branch_id, p_platform, p_external_order_id, p_customer_name, p_items, p_total_usd, p_notes)` (migration `20260621_000039_restaurant_multi_branch.sql:86`) — unchanged, no action needed.
- Produces: a live `POST https://pytndxjeznhhyycjasep.supabase.co/functions/v1/delivery-webhook?platform=<id>&tenant=<uuid>` endpoint matching the URL `DeliveryIntegrations.tsx:117` already generates.

- [ ] **Step 1: Restore the file from git history**

```bash
git show e4adf8bf^:supabase/functions/delivery-webhook/index.ts > supabase/functions/delivery-webhook/index.ts
```

- [ ] **Step 2: Verify byte-for-byte restoration**

```bash
sha256sum supabase/functions/delivery-webhook/index.ts
```

Expected output: `b719c714299f971e0308b3d5808997d5a5addf5673b7b65502bda0b6984af29b  supabase/functions/delivery-webhook/index.ts`

- [ ] **Step 3: Deploy with JWT verification disabled**

```bash
npx supabase functions deploy delivery-webhook --project-ref pytndxjeznhhyycjasep --no-verify-jwt
```

Expected: deploy succeeds (this itself is the syntax/import check — no local Deno toolchain is installed, so a successful deploy is the verification that the bundle is valid).

- [ ] **Step 4: Smoke test — invalid tenant/platform returns a clean 404 (no data mutation)**

```bash
curl -s -X POST "https://pytndxjeznhhyycjasep.supabase.co/functions/v1/delivery-webhook?platform=talabat&tenant=00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"smoke-test-1","items":[{"name":"Test Item","qty":1,"price":1}],"total":1}'
```

Expected: `{"success":false,"error":"Integration not found for this tenant/platform"}` with HTTP 404 — confirms the function is live, reachable without a Supabase JWT, and the tenant/platform lookup path executes correctly, without writing any rows (lookup fails before any INSERT).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/delivery-webhook/index.ts
git commit -m "fix(f&b): restore delivery-webhook edge function, deploy with --no-verify-jwt

Deleted in e4adf8bf as an unused stub, but it was fully wired to the
existing inject_delivery_order RPC and matches DeliveryIntegrations.tsx's
webhook URL exactly. Restoring stops the 404 a restaurant would hit when
pasting this URL into Toters/Talabat/Zomato/Careem."
```

---

### Task 2: Restore and deploy `restaurant-demand-forecast`

**Files:**
- Create: `supabase/functions/restaurant-demand-forecast/index.ts`

**Interfaces:**
- Consumes: `table_orders`, `tenants` tables (unchanged); reads/writes `restaurant_demand_forecasts` (unchanged schema).
- Produces: rows in `restaurant_demand_forecasts` consumed by `src/hooks/useDemandForecast.ts` and rendered in `src/pages/restaurant/RestaurantAnalytics.tsx`'s `ForecastTab` (`forecasts[0]`, `.date`, `.predicted_covers`, `.predicted_revenue`, `.confidence`, `.staff_recommendation`, `.factors`, `.prep_recommendations` — all already consumed by existing frontend code, no frontend changes needed).

- [ ] **Step 1: Restore the file from git history**

```bash
git show 0ba94338^:supabase/functions/restaurant-demand-forecast/index.ts > supabase/functions/restaurant-demand-forecast/index.ts
```

- [ ] **Step 2: Verify byte-for-byte restoration**

```bash
sha256sum supabase/functions/restaurant-demand-forecast/index.ts
```

Expected: `159ec5a9adb249e2136a8b94c62dd898e4b78c2be51d3af6a8ada77a838da8ab  supabase/functions/restaurant-demand-forecast/index.ts`

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy restaurant-demand-forecast --project-ref pytndxjeznhhyycjasep
```

Expected: deploy succeeds.

- [ ] **Step 4: Smoke test — invalid tenant_id returns a clean response, no crash**

```bash
curl -s -X POST "https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-demand-forecast" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2)" \
  -d '{"tenant_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: HTTP 200 with an empty/no-op result (no matching tenant found) — confirms the function deploys, authenticates, and runs its query path without writing forecast rows for a nonexistent tenant. Full end-to-end validation (real forecast numbers) happens once nightly cron runs against real tenants (Task 5) or when manually invoked with a real `tenant_id` — that's the user's call, not forced here to avoid writing speculative data into a real tenant's forecast history.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/restaurant-demand-forecast/index.ts
git commit -m "fix(f&b): restore restaurant-demand-forecast edge function

Deleted in 0ba94338 as unwired (nothing called it), but
useDemandForecast.ts and RestaurantAnalytics.tsx's ForecastTab still
read from restaurant_demand_forecasts, which nothing has written to
since. Cron wiring lands in a follow-up task."
```

#### Addendum: what actually happened (deviations from the plan above, user-approved at each step)

The historical restore was not a clean byte-for-byte success — it uncovered two real, pre-existing bugs that had never surfaced because the function was never successfully invoked end-to-end before deletion:

1. **`deno.json` used Deno-native `npm:` specifiers** → `BOOT_ERROR` on Supabase's Edge Runtime. Pinning the `date-fns-tz`/`date-fns` peer via esm.sh's `?deps=` fixed the *bundler*-time error but the function still failed to *boot*. Resolution (user-approved): dropped `date-fns-tz` entirely, replaced with a small native `Intl.DateTimeFormat`-based `toZonedTime` helper — same contract, no external package.
2. **`ForecastRow`'s write payload targeted columns that don't exist** on the real `restaurant_demand_forecasts` table (`forecast_date`, `predicted_revenue_usd`, `seasonality_factor`, `is_holiday`, `is_ramadan`, `is_summer_peak`, `generated_at`, `historical_days_used` — none of these are columns; the table only has `date`, `predicted_revenue`, `day_of_week` (TEXT), `factors`/`prep_recommendations`/`staff_recommendation` (JSONB)). Resolution (user-approved): remapped to the real schema, packing seasonality/holiday/Ramadan/summer-peak detail into `factors`.
3. **Missing `UNIQUE(tenant_id, date)` constraint** — the function's `upsert(..., { onConflict: 'tenant_id,date' })` requires one and the table never had it (a pre-existing migration bug, unrelated to this restore). Table was empty, so adding it was zero-risk. Resolution (user-approved): added migration `20260705_000050_demand_forecasts_unique_constraint.sql` and applied it directly to the live project.

Net effect: `20260705_000050` was consumed by the constraint fix instead of being available for Task 5's cron migration, which is renumbered to `20260705_000051` throughout this plan. Final commit for this task: `4780d6eb` (supersedes the single-file commit shown in Step 5 above — includes `index.ts`, `deno.json`, and the new migration together, since they form one working unit).

Smoke test after all three fixes: a nonexistent `tenant_id` now correctly fails on the `tenant_id` foreign-key constraint (proves the full parse → query → compute → upsert pipeline runs) instead of `BOOT_ERROR` or a schema-cache error.

---

### Task 3: Restore and deploy `restaurant-menu-engineering`

**Files:**
- Create: `supabase/functions/restaurant-menu-engineering/index.ts`

**Interfaces:**
- Consumes: `restaurant_menu_items`, `restaurant_order_items`, `tenants` (unchanged); writes `restaurant_menu_engineering_cache` (unchanged schema).
- Produces: rows consumed by `src/hooks/useMenuEngineering.ts` and rendered in `src/components/restaurant/MenuEngineeringMatrix.tsx` (`category: 'star'|'plowhorse'|'puzzle'|'dog'`, `popularityScore`, `marginScore`, `recommendedAction`, `potentialRevenueImpact` — no frontend changes needed).

- [ ] **Step 1: Restore the file from git history**

```bash
git show 0ba94338^:supabase/functions/restaurant-menu-engineering/index.ts > supabase/functions/restaurant-menu-engineering/index.ts
```

- [ ] **Step 2: Verify byte-for-byte restoration**

```bash
sha256sum supabase/functions/restaurant-menu-engineering/index.ts
```

Expected: `8d14a233d94607d1a3ff730d02a9de496649734990041b4bb7b98f8ae7419f9c  supabase/functions/restaurant-menu-engineering/index.ts`

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy restaurant-menu-engineering --project-ref pytndxjeznhhyycjasep
```

Expected: deploy succeeds.

- [ ] **Step 4: Smoke test — invalid tenant_id returns a clean response, no crash**

```bash
curl -s -X POST "https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-menu-engineering" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2)" \
  -d '{"tenant_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: HTTP 200, no-op result for the nonexistent tenant — confirms deploy + auth + query path without writing speculative cache rows for a real tenant.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/restaurant-menu-engineering/index.ts
git commit -m "fix(f&b): restore restaurant-menu-engineering edge function

Deleted in 0ba94338 as unwired. MenuEngineeringMatrix.tsx and
useMenuEngineering.ts still read restaurant_menu_engineering_cache,
which has had no writer since. Cron wiring lands in a follow-up task."
```

---

### Task 4: Restore and deploy `restaurant-upsell-compute`

**Files:**
- Create: `supabase/functions/restaurant-upsell-compute/index.ts`

**Interfaces:**
- Consumes: `restaurant_order_items`, `tenants` (unchanged); writes `restaurant_upsell_rules` (unchanged schema: `trigger_item_id`, `suggested_item_id`, `confidence`).
- Produces: rows consumed by `src/hooks/useUpsellRules.ts`, used in `src/pages/restaurant/WaiterInterface.tsx:377` (no frontend changes needed).

- [ ] **Step 1: Restore the file from git history**

```bash
git show 0ba94338^:supabase/functions/restaurant-upsell-compute/index.ts > supabase/functions/restaurant-upsell-compute/index.ts
```

- [ ] **Step 2: Verify byte-for-byte restoration**

```bash
sha256sum supabase/functions/restaurant-upsell-compute/index.ts
```

Expected: `e8ebc473611ebe1781e854371995728311c970b5d7b4dd92e648964201df2c48  supabase/functions/restaurant-upsell-compute/index.ts`

- [ ] **Step 3: Deploy**

```bash
npx supabase functions deploy restaurant-upsell-compute --project-ref pytndxjeznhhyycjasep
```

Expected: deploy succeeds.

- [ ] **Step 4: Smoke test — invalid tenant_id returns a clean response, no crash**

```bash
curl -s -X POST "https://pytndxjeznhhyycjasep.supabase.co/functions/v1/restaurant-upsell-compute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2)" \
  -d '{"tenant_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: HTTP 200, no-op result — confirms deploy + auth + query path without writing speculative upsell rules for a real tenant.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/restaurant-upsell-compute/index.ts
git commit -m "fix(f&b): restore restaurant-upsell-compute edge function

Deleted in 0ba94338 as unwired. useUpsellRules.ts (used in
WaiterInterface.tsx) still reads restaurant_upsell_rules, which has had
no writer since. Cron wiring lands in a follow-up task."
```

**Addendum: what actually happened.** The original brief above (Steps 1-5) turned out incomplete/incorrect in three ways, discovered and fixed during execution:

1. **`deno.json` was missing from the brief.** The deletion commit (`0ba94338`) removed both `index.ts` and `deno.json`, but Step 1 above only restores `index.ts` — the same gap already caught and pre-fixed for Task 3's brief before dispatch. Corrected before the implementer ran: both files restored. This function's historical `deno.json` already used the correct `https://esm.sh/...` format (no `npm:` specifiers), so no BOOT_ERROR risk materialized.
2. **Pre-existing read-path schema bug**, same class as Task 2's write-path bug: the function's 90-day lookback query does `.gte('created_at', sinceIso)` against `restaurant_order_items`, but that table (`20260620_000031_restaurant_schema.sql`) has no `created_at` column (only `sent_at`/`ready_at`). Never surfaced before because the function was marked "unwired" and never invoked end-to-end. User chose (over rewriting the function to join through `table_orders.opened_at`) to add the missing column directly: migration `20260705_000052_order_items_created_at.sql` — `ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();`. Table had only 7 rows at the time (verified), so the one-time backfill-to-now for existing rows was judged inconsequential; applied directly to the live project with explicit sign-off, same as Task 2's precedent.
3. **The brief's own Step 4 smoke-test payload used the wrong key.** The function reads `body.tenantId` (`index.ts:182`), not `body.tenant_id` as Step 4 above sends — so the original smoke test silently fell through to the "no tenant filter → process all real restaurant tenants" branch instead of a clean single-tenant no-op, which is why the implementer's first (pre-fix) run touched two real tenants instead of the intended fake one. Corrected smoke test (`{"tenantId":"00000000-0000-0000-0000-000000000000"}`) confirmed a clean no-op after the `created_at` fix.

Final commit for this task: `5d3a6494` (supersedes the single-file commit shown in Step 5 above — includes `index.ts`, `deno.json`, and the new migration together, since they form one working unit, matching Task 2's precedent).

---

### Task 5: Nightly `pg_cron` automation migration

**Files:**
- Create: `supabase/migrations/20260705_000051_fnb_analytics_cron.sql`

**Interfaces:**
- Consumes: the three edge functions deployed in Tasks 2–4 (calls them by name via HTTPS).
- Produces: three scheduled `cron.schedule(...)` jobs; a reusable `invoke_edge_function(function_name text)` helper function; execution history queryable via `cron.job_run_details` (built into `pg_cron`, no custom table needed).

- [ ] **Step 1: Write the migration file**

```sql
-- 20260705_000051_fnb_analytics_cron.sql
-- Nightly automation for the three restored F&B analytics edge functions:
-- restaurant-demand-forecast, restaurant-menu-engineering, restaurant-upsell-compute.
--
-- IMPORTANT — manual step required after running this migration:
-- Set the service-role secret directly in the SQL Editor (never commit the real value):
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');
-- Get the key from Supabase Dashboard -> Project Settings -> API -> service_role.
-- This follows the same pattern already used for the admin PIN in
-- 20260619_000023_admin_pin_config_table.sql, because ALTER DATABASE (the
-- more common tutorial approach for storing secrets as GUCs) is not
-- available in Supabase's hosted SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

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
    raise exception 'service_role_key not set in vault — run: select vault.create_secret(''<key>'', ''service_role_key'');';
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

select cron.schedule(
  'nightly-demand-forecast',
  '0 23 * * *',
  $$select invoke_edge_function('restaurant-demand-forecast')$$
);

select cron.schedule(
  'nightly-menu-engineering',
  '15 23 * * *',
  $$select invoke_edge_function('restaurant-menu-engineering')$$
);

select cron.schedule(
  'nightly-upsell-compute',
  '30 23 * * *',
  $$select invoke_edge_function('restaurant-upsell-compute')$$
);
```

- [ ] **Step 2: Confirm the file is syntactically well-formed (local static check — this does not run it against any database)**

```bash
grep -c "cron.schedule" supabase/migrations/20260705_000051_fnb_analytics_cron.sql
```

Expected: `3`

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260705_000051_fnb_analytics_cron.sql
git commit -m "feat(f&b): add pg_cron migration for nightly analytics automation

Schedules the three restored analytics edge functions nightly via
pg_cron + pg_net, reading the service-role key from Supabase Vault
(set manually post-migration, never committed to git). Not yet applied
to the live database — apply via Supabase Dashboard -> SQL Editor per
this project's migration convention."
```

- [ ] **Step 4: Hand off manual application steps to the user**

Provide this exact checklist (this step has no code to run locally — it documents what the user does in the Supabase Dashboard):

1. Open Supabase Dashboard → SQL Editor for project `pytndxjeznhhyycjasep`.
2. Paste and run the full contents of `supabase/migrations/20260705_000051_fnb_analytics_cron.sql`.
3. In the same SQL Editor, run (substituting the real key from Project Settings → API → service_role):
   ```sql
   select vault.create_secret('<your-service-role-key>', 'service_role_key');
   ```
4. Verify the jobs registered:
   ```sql
   select jobname, schedule, active from cron.job;
   ```
   Expected: 3 rows — `nightly-demand-forecast`, `nightly-menu-engineering`, `nightly-upsell-compute`, all `active = true`.
5. The next morning (or by manually running `select invoke_edge_function('restaurant-demand-forecast');` once), verify a real run recorded:
   ```sql
   select jobid, status, return_message, start_time
   from cron.job_run_details
   order by start_time desc
   limit 5;
   ```
   Expected: `status = 'succeeded'` for each job.

---

### Task 6: Update `CLAUDE.md` documentation

**Files:**
- Modify: `CLAUDE.md` (Edge Functions table, Database Migrations list)

**Interfaces:**
- None — documentation only, no runtime behavior.

- [ ] **Step 1: Add the four restored functions back to the Edge Functions table**

In `CLAUDE.md`, find the "Edge Functions" table and add these rows (matching the existing table's column format `| Function | Trigger | Env Var Required |`):

```markdown
| `delivery-webhook` | Called by Toters/Talabat/Zomato/Careem when a delivery order is placed | none (per-integration secret stored in `restaurant_delivery_integrations.webhook_secret`) |
| `restaurant-demand-forecast` | Nightly `pg_cron` job (`nightly-demand-forecast`, see migration `000051`) | none |
| `restaurant-menu-engineering` | Nightly `pg_cron` job (`nightly-menu-engineering`, see migration `000051`) | none |
| `restaurant-upsell-compute` | Nightly `pg_cron` job (`nightly-upsell-compute`, see migration `000051`) | none |
```

- [ ] **Step 2: Add the new migrations to the numbered Database Migrations list**

Append these three lines after entry 49 in `CLAUDE.md` (entries 50 and 52 were added mid-execution — see Task 2 and Task 4 Addenda above — and were already applied directly to the live project):

```markdown
50. `20260705_000050_demand_forecasts_unique_constraint.sql` — adds the missing UNIQUE(tenant_id, date) constraint restaurant_demand_forecasts needed for its upsert onConflict target (pre-existing migration bug, applied directly — table was empty)
51. `20260705_000051_fnb_analytics_cron.sql` — pg_cron + pg_net automation for the three restored F&B analytics edge functions; requires manually setting the `service_role_key` Vault secret post-migration (see migration file header)
52. `20260705_000052_order_items_created_at.sql` — adds missing created_at column to restaurant_order_items, needed by restaurant-upsell-compute's 90-day lookback query (pre-existing bug, applied directly — table had 7 rows)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document restored F&B edge functions and cron migration in CLAUDE.md"
```

---

## Self-Review Notes

- **Spec coverage:** Design spec's 5 sections (delivery webhook restore, AI pipeline restore, cron automation, verification, rollback) map to Tasks 1–5. Rollback steps (`cron.unschedule`, redeploy previous state, `is_active` toggle) were already available/documented in the spec and don't need their own task — they're operational runbook entries, not build steps.
- **Placeholder scan:** No TBD/TODO. The only bracketed placeholder (`<your-service-role-key>`) is an intentional manual secret-entry point, explicitly called out as such — not a plan gap.
- **Type consistency:** No new TypeScript/frontend types introduced (frontend already expects the exact shapes these functions produce, confirmed against `useDemandForecast.ts`, `useMenuEngineering.ts`, `useUpsellRules.ts`, `DeliveryIntegrations.tsx` during design).
- **Out of scope, confirmed still excluded:** `restaurant_delivery_orders` fulfillment UI, customer/waiter table transfer, waitlist management, preset order bundles — all separate future specs per the gap-analysis roadmap.
