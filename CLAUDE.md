# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**KiTS Business Terminal** — a multi-tenant POS + business management SPA built with React 18, Vite, TypeScript, Supabase, and Tailwind CSS. Designed for Lebanese/MENA SMB clients. Deployed on Vercel.

## Commands

```bash
npm run dev           # Dev server on http://localhost:3000
npm run typecheck     # Strict TS check (no emit) — run before every edit
npm run lint          # ESLint, zero warnings enforced
npm run lint:fix      # Auto-fix ESLint errors
npm run build         # Production build → build/
npm run verify        # typecheck + lint + build (full pre-commit check)

npm run test                  # Vitest unit tests
npm run test:watch            # Vitest watch mode
npm run test:coverage         # Coverage report
npm run test:e2e              # Playwright E2E
npm run test:e2e:headed       # E2E with visible browser
npm run test:accessibility    # Accessibility spec only
npm run test:critical         # Critical paths spec only
npm run storybook             # Component dev server on :6006
```

Single file test: `npx vitest run src/utils/cart.test.ts`  
Single Playwright spec: `npx playwright test tests/e2e/auth.spec.ts`

## Local Development

`.env.local` sets `VITE_USE_LOCAL_MODE=true` → data routes through `src/utils/localStorageClient.ts` (browser localStorage mock). No Supabase credentials needed.

For Supabase: copy `.env.example` → `.env`, fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Architecture

### Data Layer

All application data uses **direct PostgREST calls** via `supabase.from('table')` — there is no intermediary Edge Function for CRUD. The `supabase` client is exported from `src/utils/supabaseClient.ts` and switches automatically between the real client and localStorage mock.

The `api` object in `supabaseClient.ts` exists but is unused — do not add new calls to it.

**When adding any data operation**: use `supabase.from('table_name').select/insert/update/delete()` directly. RLS handles all tenant isolation server-side — no `tenant_id` filter is needed in queries.

### State Management

- **AppContext** (`src/context/AppContext.tsx`): products, sales, customers, employees, currentTenant, currentEmployee, loading + all CRUD functions. `loadData()` fires on auth change and tenant selection, queries all tables in parallel via `Promise.all`.
- **SubscriptionContext** (`src/context/SubscriptionContext.tsx`): plan (starter/growth/business), role (owner/manager/cashier/viewer), `hasFeature()`, `canPerform()`, `isWithinLimit()`.
- **Server/async state**: TanStack Query via `src/providers/QueryProvider.tsx`.
- **Auth**: Supabase `onAuthStateChange` in `App.tsx`.
- **Language/RTL**: `src/context/LanguageContext.tsx` + i18next.

### Multi-Tenancy / RLS

Every domain table has `tenant_id` referencing `tenants.id`. RLS is enforced by two SECURITY DEFINER functions:

- `current_tenant_id()` — returns the active tenant UUID for the session
- `current_user_role()` — returns 'owner' | 'manager' | 'cashier' | 'viewer' for the current user

All RLS policies use these functions. Frontend never filters by `tenant_id` — the database enforces it automatically.

Tenant membership: `tenant_users(tenant_id, user_id, role)`. The `get_current_user_tenant` RPC returns the user's tenant memberships including plan and role.

### Subscription / RBAC

- `src/types/subscription.ts` — canonical definitions for `SubscriptionPlan`, `Feature`, `RoleAction`, `PLAN_FEATURES`, `PLAN_LIMITS`, `ROLE_ACTIONS`
- `src/components/FeatureGate.tsx` — wraps any tier-gated section; shows lock UI + upgrade CTA when plan is insufficient
- `src/components/RoleGate.tsx` — wraps any role-gated action; renders nothing (or fallback) for insufficient roles
- `src/hooks/useFeature.ts` — `useFeature(feature)` → `{ available: boolean, requiredPlan }`

Tier matrix:
| Plan | Price | Limits | Features |
|---|---|---|---|
| starter | Free | 50 products, 100 customers, 1 employee | POS, basic reports |
| growth | $29/mo | 10 employees, unlimited products/customers | + analytics, CRM, forecasting, inventory |
| business | $79/mo | Unlimited | + enterprise, monitoring, API, multi-location |

Stripe integration is stubbed (`stripe_customer_id`, `stripe_subscription_id` on tenants) but not yet active.

### Onboarding

`src/components/OnboardingWizard.tsx` — 4-step full-screen wizard (Business Profile → First Product → Invite Team → Done). Triggered from `src/pages/TenantSelection.tsx` when `tenant.onboarding_completed = false`.

### Provider Stack (App.tsx, outermost first)

`ErrorBoundary` → `ThemeProvider` → `Router` → `AppProvider` → `SubscriptionProvider` → `QueryProvider` → `LanguageProvider` → `TranslationProvider` → `AccessibilityProvider`

### Routing

All pages (`src/pages/`) are lazy-loaded. Auth guard is in `App.tsx` via Supabase session check. Unauthenticated users redirect to `/login`. The `ProtectedRoute` component at `src/components/ProtectedRoute.tsx` is also available for route-level guards.

### Path Alias

`@/` → `src/`. Use for all cross-directory imports.

### Build Output

Output goes to `build/` (not `dist/`). Vite chunk splitting in `vite.config.ts`: vendor, radix, charts, i18n, export, dnd, router are separate chunks.

## Key Files

| File | Purpose |
|---|---|
| `src/context/AppContext.tsx` | All domain state + CRUD — the single source of truth for data |
| `src/utils/supabaseClient.ts` | Supabase client (mode switching between real and mock) |
| `src/types/subscription.ts` | Plan/tier/role canonical definitions |
| `src/context/SubscriptionContext.tsx` | Live subscription + role state |
| `src/components/FeatureGate.tsx` | Tier gate: wrap any feature requiring growth/business plan |
| `src/components/RoleGate.tsx` | Role gate: wrap any action requiring specific role |
| `src/components/OnboardingWizard.tsx` | First-time setup wizard |
| `src/pages/TenantSelection.tsx` | Post-login tenant flow + onboarding trigger |
| `src/constants/branding.ts` | Brand config: name, support WhatsApp, email, Instagram |
| `src/utils/formatting.ts` | Currency/date formatting — use for all display values |
| `src/utils/exportService.ts` | Excel/PDF export (ExcelJS + jsPDF) |
| `supabase/migrations/` | DB migrations — run in order in Supabase SQL Editor |

## Database Migrations

Run in this order in Supabase Dashboard → SQL Editor:

1. `20250617_000000_initial_schema.sql` — tenants, tenant_users, RLS functions, RPC helpers
2. `20250617_000001_views_and_functions.sql` — views and helper functions
3. `20250617_000002_auth_triggers.sql` — auto-applies pending invitations on first login
4. `20250617_000003_safe_domain_setup.sql` — all domain tables, RLS policies (safe to re-run)
5. `20260617_000004_onboarding.sql` — onboarding columns on tenants
6. `20260618_000005_subscription_tiers.sql` — subscription columns on tenants
7. `20260618_000006_activity_log.sql` — activity_log table with RLS (tenant-scoped audit trail)
8. `20260618_000007_stock_management.sql` — suppliers, purchase_orders, purchase_order_items, stock_transfers, stock_transfer_items
9. `20260618_000008_multi_location.sql` — locations, location_stock tables
10. `20260618_000009_fix_onboarding_completed.sql` — retroactive set onboarding_completed = true for pre-existing tenants
11. `20260618_000010_admin_functions.sql` — admin_list_tenants() and admin_set_tenant_plan() RPCs
12. `20260618_000011_invite_accept_rpc.sql` — accept_pending_invitation() RPC + pending_invitations status column
13. `20260618_000012_api_webhooks.sql` — api_keys, webhooks, webhook_deliveries tables
14. `20260618_000013_db_provisioning.sql` — db_provision_status and related fields on tenants; admin_provision_client() RPC
15. `20260618_000014_fix_admin_and_invite_rls.sql` — DROP+RECREATE admin_list_tenants (provisioning columns); pending_invitations SELECT RLS for invited users pre-tenant-context
16. `20260618_000015_fix_admin_list_ambiguous_id.sql` — Fix PL/pgSQL 42702 — alias auth.users → au to resolve ambiguous `id` OUT param
17. `20260618_000016_fix_admin_list_varchar_cast.sql` — Fix PostgreSQL 42804 — explicit ::TEXT casts on all string columns
18. `20260618_000017_fix_trigger_search_path.sql` — Fix signup 500: auth trigger `handle_new_user_invite` needs SET search_path = 'public'; Supabase auth context has restricted search_path that excludes public schema
19. `20260618_000018_tenants_profile_columns.sql` — Add country, currency, phone columns to tenants (required by OnboardingWizard step 1)
20. `20260618_000019_fix_onboarding_loop.sql` — Set onboarding_completed = true for all pre-existing tenants
21. `20260618_000020_get_tenant_with_plan.sql` — Extend get_current_user_tenant() with subscription_plan + subscription_status
22. `20260618_000021_roles_and_custom_roles.sql` — 8-role set (admin/supervisor/accountant/stockkeeper added); custom_roles table; kits admin auto-added to all tenants
23. `20260618_000022_admin_pin_verification.sql` — Initial pgcrypto verify_admin_pin (uses ALTER DATABASE — superseded by 000023)
24. `20260619_000023_admin_pin_config_table.sql` — Fix admin PIN: kits_admin_config table (ALTER DATABASE not available in Supabase SQL Editor); UPDATE the table to set your PIN hash
25. `20260619_000024_brand_identity.sql` — brand_logo_url, brand_primary, brand_secondary, brand_tagline on tenants; extends get_current_user_tenant()
26. `20260619_000025_loyalty.sql` — customer_points table; points_balance on customers; Bronze/Silver/Gold tier logic; earn/redeem triggers *(description corrected — no earn/redeem trigger or RPC actually exists live; `src/pages/POS.tsx` calls a non-existent `upsert_customer_points` RPC, so loyalty points silently never accrue on any sale, for any tenant. Found during the 2026-07-12 QA sweep, logged as BUG-035 in `docs/qa-bug-tracker.md`.)*
27. `20260619_000026_crm.sql` — customer segments, communication history, CRM analytics helper views
28. `20260619_000027_campaigns.sql` — campaigns table (marketing campaigns CRUD); automated_workflows table (trigger-based automations)
29. `20260619_000028_finance.sql` — expense_categories (34 Lebanese system defaults seeded); expenses (USD/LBP dual-currency, VAT, receipt upload); expense_budgets; payroll_entries (NSSF 22.5%, EOS 8.5% accrual, transport allowance)
30. *(gap — 000029 was skipped by automation; next sequential file is 000030)*
31. `20260620_000030_industry_column.sql` — backfills industry from business_type; extends get_current_user_tenant() to expose industry field
32. `20260620_000031_restaurant_schema.sql` — restaurant_tables, table_orders, kitchen_display_items, restaurant_reservations tables with RLS
33. `20260620_000032_pharmacy_schema.sql` — pharmacy vertical: medications, prescriptions, dispensing, narcotics register, insurance
34. `20260620_000033_supermarket_schema.sql` — supermarket vertical: expiry tracking (`grocery_lots.expiry_date` — UI now live at `/supermarket/shelf-life`, see `docs/qa-bug-tracker.md` BUG-072), bulk pricing (`bulk_pricing_rules`, configured but not yet applied at POS checkout — BUG-081) *(description corrected — previously claimed "loyalty multipliers," no such column/table exists anywhere in this migration or the codebase. Found during the 2026-07-12 QA sweep.)*
35. `20260621_000034_restaurant_menu_system.sql` — restaurant_menu_categories, restaurant_menu_items, modifier groups/modifiers, menu_item_modifier_groups
36. `20260621_000035_restaurant_order_flow.sql` — order flow: restaurant_shifts, restaurant_shift_assignments, restaurant_kds_stations, restaurant_settings
37. `20260621_000036_restaurant_argile.sql` — argile (shisha) sessions: restaurant_argile_sessions, argile_items
38. `20260621_000037_restaurant_recipes.sql` — recipe costing: restaurant_ingredients, restaurant_recipes, restaurant_recipe_ingredients, restaurant_menu_item_recipes, ingredient_suppliers, waste_log, ingredient_movements, restaurant_purchase_orders/items
39. `20260621_000038_restaurant_intelligence.sql` — analytics views: restaurant_item_velocity, table_feedback, slow_alerts; restaurant_eod_reports
40. `20260621_000039_restaurant_multi_branch.sql` — multi-branch: restaurant_branches, restaurant_branch_metrics
41. `20260621_000040_restaurant_bridge.sql` — bridges the restaurant module to the main platform: optional FKs from `restaurant_menu_items`/`restaurant_order_items` to `products`/menu items, `sale_items.product_id` nullable + `product_name`, `sales.source`/`sales.table_order_id`, `fn_close_restaurant_bill()` RPC *(description corrected — previously wrongly stated "links restaurant_tables → locations"; `restaurant_tables` has no location/branch FK anywhere in the schema — table-to-location linking was never built. Found during the 2026-07-12 QA sweep.)*
42. `20260621_000041_restaurant_views.sql` — consolidated views for analytics and reporting
43. `20260622_000042_restaurant_ai.sql` — restaurant_ai_queries (chat history for AI assistant)
44. `20260623_000043_cash_management.sql` — cash management foundation (superseded by 000047)
45. `20260623_000044_branch_menu_overrides.sql` — restaurant_menu_items_branch_overrides (per-branch availability)
46. `20260623_000045_fn_close_bill_patch.sql` — patches `fn_close_restaurant_bill(uuid, text)` to derive and persist `payment_currency` from the payment method (`cash_lbp` → `lbp`, else `usd`) and add explicit `cash_usd`/`cash_lbp` CASE arms *(description corrected — previously mis-stated as "handle argile + modifiers", found during the 000059 investigation below)*
47. `20260623_000046_restaurant_events.sql` — restaurant_events table (events/banquets management)
48. `20260623_000047_cash_management.sql` — adds `restaurant_cash_movements` (granular cash-movement tracking); supplements, does not replace, `000043`'s `restaurant_cash_sessions` *(description corrected — previously wrongly stated it creates restaurant_cash_drawers/restaurant_cash_transactions and replaces 000043, found during the 000060 deep-clean audit)*
49. `20260622_000048_fix_close_restaurant_bill.sql` — adds a second, 6-parameter overload of `fn_close_restaurant_bill` (tip/discount/cash-received/exchange-rate params, all defaulted) intended to *replace* the 2-parameter version but which `CREATE OR REPLACE FUNCTION` cannot do across differing signatures, so it silently added a second overload instead. **Previously mis-documented as "skipped"** — it was actually committed to a mistakenly nested path (`supabase/migrations/supabase/migrations/`) so it never ran via the normal sequence, yet its SQL was at some point run manually against the live kits-dev project, leaving the two-overload ambiguity live. Relocated to its correct path and its lasting effect corrected by 000059 below.
50. `20260624_000049_restaurant_purchase_orders.sql` — restaurant_purchase_orders RLS + supplier link fixes
51. `20260705_000050_demand_forecasts_unique_constraint.sql` — adds the missing UNIQUE(tenant_id, date) constraint restaurant_demand_forecasts needed for its upsert onConflict target (pre-existing migration bug, applied directly — table was empty)
52. `20260705_000051_fnb_analytics_cron.sql` — pg_cron + pg_net automation for the three restored F&B analytics edge functions; requires manually setting the `service_role_key` Vault secret post-migration (see migration file header)
53. `20260705_000052_order_items_created_at.sql` — adds missing created_at column to restaurant_order_items, needed by restaurant-upsell-compute's 90-day lookback query (pre-existing bug, applied directly — table had 7 rows)
54. `20260705_000053_atomic_cache_refresh_rpcs.sql` — `refresh_upsell_rules()` and `refresh_menu_engineering_cache()` RPCs, making each tenant's cache delete+insert one atomic transaction (fixes stale-rows-on-empty-result and partial-write-on-failure findings from whole-branch review; applied directly)
55. `20260706_000054_table_waiter_transfer.sql` — adds table_orders.merged_into_order_id + fn_transfer_table_order() RPC for table/waiter transfer (Tier 1.1 + 1.2); introduces 'merged' as a valid table_orders.status value (no CHECK constraint exists on that column)
56. `20260706_000055_delivery_order_intake.sql` — simplifies inject_delivery_order (no longer creates a table_orders shell at webhook-receipt time), adds accept_delivery_order RPC, extends sales.source to allow 'delivery' and payment_method to allow 'platform'. complete_delivery_order records the sale directly from restaurant_delivery_orders.subtotal_usd/total_usd (does not call finalize_restaurant_order, which is left untouched). reject_delivery_order cancels from any pre-pickup status ('new'/'accepted'/'preparing'/'ready'), closing the linked table_orders shell if one exists (Tier 1.4)
57. `20260706_000056_waitlist_management.sql` — adds restaurant_waitlist table (walk-in queue) + fn_seat_waitlist_party() RPC (Tier 1.3); seating atomically creates the table_orders shell with the real assigned table_id, marks the table occupied, and closes out the waitlist entry
58. `20260707_000057_order_item_integrity.sql` — adds qr_place_order() RPC, the sole anonymous write path for QR customer orders; resolves tenant_id server-side from the table (never trusts a client-supplied tenant id), revalidates item prices/modifier names server-side from the menu catalog rather than trusting client-supplied values, and branches on the target table_order's order_flow ('waiter_confirm' -> restaurant_pending_orders staging table, 'direct' -> real restaurant_order_items rows with menu_item_id always set). **Also adds `table_orders_one_open_per_table`, a new schema-wide unique-index invariant (no table may have more than one 'open' table_orders row) that the app never enforced before — run the pre-flight duplicate check documented in the migration file header before applying, or the `CREATE UNIQUE INDEX` will fail and abort the whole script, including the `qr_place_order` function defined after it.**
59. `20260708_000058_security_performance_audit.sql` — fixes found by a 6-agent Supabase security/performance/plan-alignment audit (applied directly to kits-dev, backfilled here): NULL-comparison auth bypass on 6 admin/tenant-management SECURITY DEFINER functions (anon could brute-force the admin PIN, dump all tenants, change any tenant's plan, or escalate cross-tenant via add_user_to_tenant/remove_user_from_tenant's unscoped role check) + create_tenant had zero auth check; 2 SECURITY DEFINER views (`restaurant_daily_revenue`, `restaurant_item_velocity`) bypassed RLS and leaked cross-tenant data, converted to `security_invoker`; 2 tables (`purchase_order_items`, `stock_transfer_items`) had RLS enabled with zero policies, silently breaking Purchase Orders and Stock Transfers since creation; `expense_categories`' `categories_visible` policy implicitly granted tenants write access to the 34 seeded global system categories; mutable `search_path` fixed on 11 functions total; `pending_invitations` had a buggy case-sensitive duplicate policy (dropped) alongside the correct case-insensitive one (kept, initplan-optimized); 40 missing `tenant_id` FK indexes added; 2 duplicate indexes dropped; `rls_auto_enable`'s unneeded public grant revoked.
60. `20260708_000059_fix_close_bill_overload_ambiguity.sql` — drops the second `fn_close_restaurant_bill(uuid, text, numeric, numeric, numeric, numeric)` overload added by the now-relocated `000048` (see entry 49 above), which made every real call site's `(p_order_id, p_payment_method)` invocation ambiguous (PGRST203: "Could not choose the best candidate function"). Consolidates on the 2-parameter version from `000045`, the one both call sites (`useRestaurantOrder.ts`, `CloseBillModal.tsx`) actually use.
61. `20260708_000060_supabase_deep_clean.sql` — fixes found by a follow-up 5-agent audit (applied directly to kits-dev, backfilled here): `restaurant_menu_categories`/`restaurant_menu_items`/`restaurant_pending_orders` each had an extra, unscoped `public_*` RLS policy granting fully-anonymous access alongside their correct tenant-scoped policy — verified unused by the app (both real anonymous paths, `get_public_menu()`/`qr_place_order()`, are `SECURITY DEFINER` and don't need them), dropped; closed a real cross-tenant menu-enumeration and fake-order-injection vector. 17 more FK indexes added (confirmed via grep to be columns actually filtered/joined on in real queries, unlike the ~58 excluded audit-trail-only FKs). 2 more duplicate indexes dropped (subsets of existing UNIQUE constraints). Dead `restaurant_daily_revenue` view dropped (zero references anywhere in the codebase). A full function-overload sweep and RLS-enablement sweep (all 87 tables) both came back clean — no further landmines of either class found.
62. `20260708_000061_fix_tenant_slug_duplicate_column.sql` — fixes a platform-wide broken QR menu: migration `000034` added a second, separate `tenant_slug` column duplicating the original, actively-used `slug` column (from the very first migration), and `get_public_menu()` was written against the wrong one — every tenant except one (manually patched at some point) had `tenant_slug = NULL`, so their QR menu links returned `not_found`. Fixed `get_public_menu()` to read `slug`; dropped the now-confirmed-dead `tenant_slug` column entirely; corrected the real "KiTS" tenant's `slug` (previously the literal string `kitshub.vercel.app`, a domain mistyped into the slug field) to `kits`, renaming a conflicting pre-existing test tenant's slug to `kits-test` to free it up.
63. `20260708_000062_preset_order_bundles.sql` — Tier 2.1 "preset order bundles" (prix-fixe combos): `restaurant_bundles`/`restaurant_bundle_courses`/`restaurant_bundle_course_items` tables + RLS, `restaurant_order_items.bundle_id` column, new `add_bundle_to_order` staff RPC, `get_public_menu()` extended with `bundles`/`bundle_courses`/`bundle_course_items` keys, `qr_place_order()` replaced to accept bundle-adds alongside regular items in one atomic `p_items` array (staff ordering via `BundleOrderModal` in `WaiterInterface.tsx`; QR self-service ordering via `QRBundleDetail.tsx`). Each bundle-add writes one `$0`-priced `restaurant_order_items` row per chosen course component (real `menu_item_id`, `quantity = party_size`, so KDS/recipe-deduction need zero changes) plus one `menu_item_id = NULL` charge row carrying the actual per-guest price, all sharing a `bundle_id` tag for dual sales/inventory-consumption analytics. Built via subagent-driven-development (9 tasks); caught and fixed one NULL-comparison auth-bypass in `add_bundle_to_order` during task review (see `000063` — the same bug class was found to also exist in two other, unrelated, already-live functions).
64. `20260709_000063_fix_transfer_seat_null_comparison.sql` — the same NULL-comparison auth-bypass class fixed in `add_bundle_to_order` (`000062`) also existed, unfixed, in two already-live functions: `fn_transfer_table_order` (one occurrence) and `fn_seat_waitlist_party` (two occurrences — waitlist-entry tenant check and target-table tenant check). `IF v_tenant_id <> current_tenant_id()` fails open (falls through, not raises) when `current_tenant_id()` is NULL, i.e. any caller with no active `tenant_users` row — meaning an anon/no-tenant caller could transfer or merge any tenant's table order, or seat any tenant's waitlist party at any tenant's table. Fixed via `IS DISTINCT FROM`, same pattern and same verified-unreachable-NULL reasoning as `000062`.
65. `20260709_000064_active_tenant_selection.sql` — fixes a real "unable to create a new demo account" failure: `current_tenant_id()`/`current_user_role()` resolved a user's tenant via an unordered `LIMIT 1` over `tenant_users`, which is undefined for any user belonging to 2+ tenants — including `kits.tech.co@gmail.com`, auto-added to every tenant by `000021`'s trigger. Adds a `user_active_tenant` table (one row per user, upserted on tenant creation/selection/invite-acceptance) so "which tenant is this user on" is explicit and deterministic; rewrites both helper functions to join through it; adds `select_active_tenant()` RPC for the picker; backfills existing users in the same migration to avoid a deploy-time outage. Full design: `docs/superpowers/specs/2026-07-09-active-tenant-selection-design.md`.
66. `20260710_000065_split_table_order.sql` — adds `fn_split_table_order(p_source_order_id, p_target_table_id, p_item_ids)` RPC (Tier 2.3, the split half of "table merge/split" — merge was already covered by `fn_transfer_table_order`). Moves a staff-selected subset of a table's order items to a new order at a currently-available target table. Guards: a preset-order-bundle's component rows (shared `bundle_id`) can never be split across the two orders; selecting every item on the source order is rejected in favor of the existing Transfer flow; target table must have no open order.
67. `20260710_000066_auto_low_stock_purchase_orders.sql` — closes the last Tier 2 roadmap item. `RecipeInventory.tsx` already had a manual "Auto-Create PO" button, but it dumped every shortage into one PO with no supplier and required a staff member to be on that exact screen. Adds `fn_generate_low_stock_pos_for_tenant(p_tenant_id)` (supplier-grouped generation, excludes ingredients already on an open draft/ordered PO), a public `generate_low_stock_purchase_orders()` RPC the frontend button now calls instead of building rows client-side, and a `nightly-low-stock-po-generation` pg_cron job (05:00 UTC, calls the SQL function directly — no edge function needed since there's no external API call, unlike the three existing analytics jobs).
68. `20260710_000067_qr_menu_upsell_rules.sql` — extends `get_public_menu()` with an `upsell_rules` array (tenant-scoped, `confidence > 0.3`) so the QR customer cart can show the same "frequently ordered together" suggestions as the (separately fixed) staff-side banner, without a new RPC — required because `restaurant_upsell_rules`' RLS has no anonymous-readable path.

## Edge Functions

| Function | Trigger | Env Var Required |
|---|---|---|
| `welcome-email` | Called from TenantSelection after tenant creation | `RESEND_API_KEY` |
| `send-invitation` | Called from InviteTeamMemberModal | `RESEND_API_KEY` |
| `whatsapp-receipt` | Called from POS after sale (Business plan) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| `trigger-workflows` | Called from WorkflowAutomation "Run Now" | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| `groq-proxy` | AI features in RestaurantAnalytics, RestaurantHub, AIAssistant | `GROQ_API_KEY` |
| `restaurant-ai-assistant` | Called from `useAIAssistant.ts` (3 call sites); backs `restaurant_ai_queries` chat history (migration `000042`) | `GROQ_API_KEY` (likely, unconfirmed) |
| `delivery-webhook` | Called by Toters/Talabat/Zomato/Careem when a delivery order is placed | none (per-integration secret stored in `restaurant_delivery_integrations.webhook_secret`) |
| `restaurant-demand-forecast` | Nightly `pg_cron` job (`nightly-demand-forecast`, see migration `000051`) | none |
| `restaurant-menu-engineering` | Nightly `pg_cron` job (`nightly-menu-engineering`, see migration `000051`) | none |
| `restaurant-upsell-compute` | Nightly `pg_cron` job (`nightly-upsell-compute`, see migration `000051`) | none |

Note: the nightly `pg_cron` jobs invoke these three analytics functions via `pg_net`'s fire-and-forget `net.http_post`, so `cron.job_run_details` will show a job as "succeeded" even if the underlying edge function itself errors or times out — there is no automatic alerting on a silently-failing nightly run; verify by checking that `restaurant_demand_forecasts`, `restaurant_menu_engineering_cache`, and `restaurant_upsell_rules` have fresh rows after the first few nights.

Deploy all: `npx supabase functions deploy <function-name> --project-ref pytndxjeznhhyycjasep`

Set secrets: `npx supabase secrets set GROQ_API_KEY=... WHATSAPP_TOKEN=... WHATSAPP_PHONE_ID=... --project-ref pytndxjeznhhyycjasep`

## TypeScript

Strict mode + `noUncheckedIndexedAccess`. No `any` — use `unknown` and narrow. Lint enforces zero warnings. Always run `npm run typecheck` after edits.

## i18n / RTL

Translations in `src/i18n/locales/`. Arabic RTL styles in `src/styles/rtl.css`. All UI text uses `useTranslation()` from `react-i18next`. RTL support is partially complete — test at `dir="rtl"` before shipping UI changes.

## Testing

- Unit tests (`src/**/*.test.ts`): Vitest + jsdom + Testing Library. Auth mock utilities in `src/test-utils/mocks.ts`.
- E2E tests (`tests/e2e/*.spec.ts`): Playwright. See `docs/auth-mocking.md` for auth setup patterns.
- Storybook stories colocated with components (`src/components/**/*.stories.tsx`).
- Visual regression: `playwright.visual.config.ts`.

## Deployment

- **Frontend**: Vercel auto-deploys on push to `main`. No manual deploy step needed.
- **Database**: Run migrations manually in Supabase Dashboard → SQL Editor.
- **CI**: GitHub Actions `.github/workflows/ci.yml` — typecheck + build on every push/PR.
- **Keep-alive**: `.github/workflows/keep-alive.yml` — pings Supabase every 3 days to prevent free-tier auto-pause.
- **Required GitHub Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for keep-alive workflow)
- **Required Vercel Env Vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Required Supabase Function Secrets**: `RESEND_API_KEY` (Dashboard → Functions → Secrets)

## Dark Theme Standard

All UI uses dark navy. Never introduce light backgrounds. Standard classes:
- Backgrounds: `bg-slate-900`, `bg-slate-950`, `bg-white/5`, `bg-white/10`
- Text: `text-white`, `text-white/80`, `text-white/60`, `text-white/40`
- Borders: `border-white/10`, `border-white/20`
- Selects: `bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2`
- Primary button: `bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl`

## MENA / Lebanese Context

- Default currency: USD (also LBP)
- Default country: Lebanon
- Phone format: `+961 X XXX XXX`
- Support: WhatsApp `+961 81 290 662`, email `kits.tech.co@gmail.com`
