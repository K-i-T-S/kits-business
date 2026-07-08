-- Migration: Supabase Deep-Clean (round 2 audit)
-- Applied directly to the live kits-dev project on 2026-07-08 with explicit
-- owner authorization, then backfilled here for the repo's record and for
-- reproducibility on any fresh Supabase project created from these
-- migration files.
--
-- Origin: a follow-up 5-agent audit workflow, run after the first
-- security/performance audit (migration 20260708_000058), specifically
-- checking for: (1) other function-overload-ambiguity landmines like the
-- one fixed in migration 20260708_000059, (2) the remaining unreviewed
-- Performance Advisor findings, (3) two previously-deferred keep/drop
-- decisions, (4) migration-replay correctness for future client
-- provisioning, (5) an exhaustive RLS-enablement sweep across every table
-- (not just advisor-flagged ones).

-- ============================================================
-- C1: restaurant_menu_categories, restaurant_menu_items, and
-- restaurant_pending_orders each had an EXTRA, unscoped "public_*" RLS
-- policy (qual/with_check = true, or is_active = true with no tenant
-- filter) granted to the `public` role — i.e. including fully anonymous
-- callers — alongside their correct tenant-scoped policy. Verified before
-- fixing: the app's only anonymous-facing access paths are get_public_menu()
-- and qr_place_order(), both SECURITY DEFINER functions that already bypass
-- RLS correctly for their own internal reads/writes and don't need these
-- grants at all; grep confirmed zero call sites anywhere in src/ doing a
-- direct .from('restaurant_menu_items'/'restaurant_menu_categories') read
-- or a direct .from('restaurant_pending_orders').insert() as an anonymous
-- QR customer. Impact of the gap: any unauthenticated PostgREST caller
-- could enumerate every tenant's full menu directly (bypassing
-- get_public_menu's tenant-slug scoping), and could INSERT arbitrary rows
-- into ANY tenant's pending-orders queue by supplying a guessed tenant_id
-- (bypassing qr_place_order's careful server-side tenant resolution
-- entirely). No replacement policy needed — dropping these three is a
-- complete fix confirmed via get_public_menu('kits') still returning
-- correct data immediately after.
-- ============================================================

DROP POLICY IF EXISTS "public_read_menu_categories" ON restaurant_menu_categories;
DROP POLICY IF EXISTS "public_read_menu_items" ON restaurant_menu_items;
DROP POLICY IF EXISTS "public_insert_pending_orders" ON restaurant_pending_orders;

-- ============================================================
-- I1: 17 unindexed foreign keys confirmed (via grep of src/ for .eq()/.in()
-- filters and PostgREST embed joins) to be actually filtered/joined on in
-- real app queries. The remaining ~58 unindexed FKs found by the advisor
-- (mostly audit-trail columns like created_by/performed_by/handled_by) are
-- deliberately excluded — no query in this codebase filters or joins on
-- them, so indexing them would be pure overhead with no benefit.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_points_customer_id ON public.customer_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_customer_id ON public.point_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_pending_orders_table_id ON public.restaurant_pending_orders(table_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order_id ON public.restaurant_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_branch_overrides_branch_id ON public.restaurant_menu_items_branch_overrides(branch_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_branch_overrides_menu_item_id ON public.restaurant_menu_items_branch_overrides(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_cash_movements_session_id ON public.restaurant_cash_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_recipe_ingredients_ingredient_id ON public.restaurant_recipe_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_recipe_ingredients_recipe_id ON public.restaurant_recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_upsell_rules_trigger_item_id ON public.restaurant_upsell_rules(trigger_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_purchase_order_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id ON public.purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer_id ON public.stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_product_id ON public.stock_transfer_items(product_id);

-- ============================================================
-- M1: idx_customers_email and idx_products_sku are strict subsets of the
-- existing non-partial UNIQUE constraints customers_tenant_id_email_key
-- and products_tenant_id_sku_key (same leading columns, no benefit from
-- the extra partial WHERE clause).
-- ============================================================

DROP INDEX IF EXISTS public.idx_customers_email;
DROP INDEX IF EXISTS public.idx_products_sku;

-- ============================================================
-- M2: restaurant_daily_revenue — confirmed zero references anywhere in
-- src/ or supabase/functions/ (only the two migrations that define/patch
-- it reference it). Already security_invoker=true (not a leak), simply
-- dead code. Dropped to shrink audit surface.
-- ============================================================

DROP VIEW IF EXISTS public.restaurant_daily_revenue;
