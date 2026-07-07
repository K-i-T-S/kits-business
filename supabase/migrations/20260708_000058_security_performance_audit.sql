-- Migration: Security + Performance Audit Fixes
-- Applied directly to the live kits-dev project on 2026-07-08 with explicit
-- owner authorization (test/dev data, no real tenants), then backfilled here
-- for the repo's record and for reproducibility on any fresh Supabase project
-- created from these migration files.
--
-- Origin: a 6-agent audit workflow verified Supabase's own Security and
-- Performance Advisor findings against the live schema/function bodies,
-- surfacing several confirmed, real issues beyond what the advisors alone
-- could see (the advisors only see grants/metadata, not function internals).

-- ============================================================
-- C1: 6 of 8 flagged SECURITY DEFINER admin/tenant-management functions had
-- a NULL-comparison auth bypass — `IF x != 'admin@email'` and
-- `IF x NOT IN (...)` both evaluate to NULL (not TRUE) when x is NULL (the
-- anonymous-caller case), and Postgres treats a NULL condition in IF as
-- false, so the guard silently never fires for anon/unauthenticated callers.
-- add_user_to_tenant/remove_user_from_tenant additionally checked the
-- caller's role in ANY tenant they belong to, not the specific tenant being
-- modified — a cross-tenant privilege escalation. create_tenant had no auth
-- check at all. Fixed: NULL-safe `IS DISTINCT FROM` comparisons, tenant-
-- scoped role lookups, SET search_path added (overlaps with I2 below),
-- REVOKE EXECUTE FROM anon (and FROM authenticated for invoke_edge_function,
-- which only pg_cron/pg_net as the postgres job owner should ever call).
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_admin_pin(attempt text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'extensions', 'public'
AS $function$
DECLARE
  stored TEXT;
BEGIN
  IF auth.email() IS DISTINCT FROM 'kits.tech.co@gmail.com' THEN
    RETURN FALSE;
  END IF;
  SELECT value INTO stored FROM public.kits_admin_config WHERE key = 'admin_pin_hash';
  IF stored IS NULL OR stored = 'not-configured' THEN
    RAISE EXCEPTION 'Admin PIN not configured';
  END IF;
  RETURN crypt(attempt, stored) = stored;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.verify_admin_pin(text) FROM anon;

CREATE OR REPLACE FUNCTION public.admin_list_tenants()
RETURNS TABLE(id uuid, name text, slug text, subscription_plan text, subscription_status text, created_at timestamptz, owner_email text, user_count bigint, business_type text, preferred_region text, db_provision_status text, standalone_supabase_url text, db_provisioned_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT au.email INTO v_user_email FROM auth.users au WHERE au.id = auth.uid();
  IF v_user_email IS DISTINCT FROM 'kits.tech.co@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT t.id, t.name::TEXT, t.slug::TEXT, t.subscription_plan::TEXT, t.subscription_status::TEXT,
    t.created_at, u.email::TEXT AS owner_email,
    (SELECT COUNT(*) FROM tenant_users tu2 WHERE tu2.tenant_id = t.id)::BIGINT AS user_count,
    t.business_type::TEXT, t.preferred_region::TEXT, t.db_provision_status::TEXT,
    t.standalone_supabase_url::TEXT, t.db_provisioned_at
  FROM tenants t
  LEFT JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.role = 'owner'
  LEFT JOIN auth.users u ON u.id = tu.user_id
  ORDER BY t.created_at DESC;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_list_tenants() FROM anon;

CREATE OR REPLACE FUNCTION public.admin_provision_client(p_tenant_id uuid, p_supabase_url text, p_anon_key text, p_notes text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS DISTINCT FROM 'kits.tech.co@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE tenants SET standalone_supabase_url = p_supabase_url, standalone_anon_key = p_anon_key,
    db_provision_status = 'provisioned', db_provisioned_at = NOW(), db_provision_notes = p_notes
  WHERE id = p_tenant_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_provision_client(uuid, text, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.admin_set_tenant_plan(p_tenant_id uuid, p_plan text, p_status text DEFAULT 'active'::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS DISTINCT FROM 'kits.tech.co@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_plan NOT IN ('starter', 'growth', 'business') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;
  IF p_status NOT IN ('active', 'trialing', 'past_due', 'canceled') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;
  UPDATE tenants SET subscription_plan = p_plan, subscription_status = p_status WHERE id = p_tenant_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_set_tenant_plan(uuid, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.create_tenant(tenant_name text, tenant_slug text, owner_user_id uuid, settings jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    new_tenant_id UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM owner_user_id THEN
        RAISE EXCEPTION 'Not authorized: you may only create a tenant naming yourself as owner';
    END IF;
    INSERT INTO tenants (name, slug, settings) VALUES (tenant_name, tenant_slug, settings)
    RETURNING id INTO new_tenant_id;
    INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (new_tenant_id, owner_user_id, 'owner');
    RETURN new_tenant_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_tenant(text, text, uuid, jsonb) FROM anon;

CREATE OR REPLACE FUNCTION public.add_user_to_tenant(tenant_id_param uuid, user_id_param uuid, user_role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_caller_role TEXT;
BEGIN
    SELECT role INTO v_caller_role FROM tenant_users
    WHERE tenant_id = tenant_id_param AND user_id = auth.uid() AND is_active = true LIMIT 1;
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'manager') THEN
        RAISE EXCEPTION 'Only owners and managers of this tenant can add users to it';
    END IF;
    INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (tenant_id_param, user_id_param, user_role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = user_role, updated_at = NOW(), is_active = true;
    RETURN true;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.add_user_to_tenant(uuid, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.remove_user_from_tenant(tenant_id_param uuid, user_id_param uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_caller_role TEXT;
BEGIN
    SELECT role INTO v_caller_role FROM tenant_users
    WHERE tenant_id = tenant_id_param AND user_id = auth.uid() AND is_active = true LIMIT 1;
    IF v_caller_role IS DISTINCT FROM 'owner' THEN
        RAISE EXCEPTION 'Only the owner of this tenant can remove users from it';
    END IF;
    DELETE FROM tenant_users WHERE tenant_id = tenant_id_param AND user_id = user_id_param;
    RETURN true;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.remove_user_from_tenant(uuid, uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(text) FROM anon, authenticated;

-- ============================================================
-- C2: restaurant_daily_revenue and restaurant_item_velocity were
-- SECURITY DEFINER views (the Postgres default), bypassing base-table RLS —
-- any authenticated user could read every tenant's revenue/item data.
-- Fixed: security_invoker = true, so RLS applies as the querying user.
-- Body unchanged (the one live consumer, RestaurantAnalytics.tsx, already
-- filters by tenant_id client-side and the base tables' RLS already scopes
-- correctly, so this is a pure security fix with no behavior change for
-- correctly-scoped callers).
-- ============================================================

CREATE OR REPLACE VIEW public.restaurant_daily_revenue
WITH (security_invoker = true) AS
 SELECT tenant_id,
    date((sale_date AT TIME ZONE 'Asia/Beirut'::text)) AS sale_day,
    (EXTRACT(dow FROM (sale_date AT TIME ZONE 'Asia/Beirut'::text)))::integer AS day_of_week,
    (EXTRACT(hour FROM (sale_date AT TIME ZONE 'Asia/Beirut'::text)))::integer AS close_hour,
    count(*) AS order_count,
    sum(subtotal) AS subtotal_usd,
    sum(discount) AS discount_usd,
    sum(tax_amount) AS tax_service_usd,
    sum(total_amount) AS total_usd,
    avg(total_amount) AS avg_check_usd,
    sum(
        CASE
            WHEN (payment_method = 'cash'::text) THEN total_amount
            ELSE (0)::numeric
        END) AS cash_usd,
    sum(
        CASE
            WHEN (payment_method = 'card'::text) THEN total_amount
            ELSE (0)::numeric
        END) AS card_usd
   FROM sales s
  WHERE ((source = 'restaurant'::text) AND (payment_status = 'completed'::text))
  GROUP BY tenant_id, (date((sale_date AT TIME ZONE 'Asia/Beirut'::text))), ((EXTRACT(dow FROM (sale_date AT TIME ZONE 'Asia/Beirut'::text)))::integer), ((EXTRACT(hour FROM (sale_date AT TIME ZONE 'Asia/Beirut'::text)))::integer);

CREATE OR REPLACE VIEW public.restaurant_item_velocity
WITH (security_invoker = true) AS
 SELECT roi.tenant_id,
    roi.product_name,
    date((o.paid_at AT TIME ZONE 'Asia/Beirut'::text)) AS sale_day,
    sum(roi.quantity) AS qty_sold,
    sum((roi.unit_price * (roi.quantity)::numeric)) AS revenue_usd,
    avg(roi.unit_price) AS avg_price_usd
   FROM (restaurant_order_items roi
     JOIN table_orders o ON ((o.id = roi.order_id)))
  WHERE (o.status = 'paid'::text)
  GROUP BY roi.tenant_id, roi.product_name, (date((o.paid_at AT TIME ZONE 'Asia/Beirut'::text)));

-- ============================================================
-- C3: purchase_order_items and stock_transfer_items had RLS enabled with
-- zero policies (fail-closed) — every read/write via PostgREST silently
-- failed since these tables were created, breaking Purchase Orders and
-- Stock Transfers entirely (confirmed: 0 rows in either table).
-- ============================================================

CREATE POLICY "tenant_purchase_order_items" ON purchase_order_items
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE tenant_id = current_tenant_id()
    )
  );

CREATE POLICY "tenant_stock_transfer_items" ON stock_transfer_items
  USING (
    transfer_id IN (
      SELECT id FROM stock_transfers WHERE tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    transfer_id IN (
      SELECT id FROM stock_transfers WHERE tenant_id = current_tenant_id()
    )
  );

-- ============================================================
-- C4: expense_categories' "categories_visible" policy was FOR ALL with no
-- WITH CHECK, implicitly granting every tenant INSERT/UPDATE/DELETE on the
-- 34 seeded global (tenant_id IS NULL) system-default categories, bypassing
-- the is_system=false guard the two dedicated write policies enforce.
-- ============================================================

DROP POLICY IF EXISTS "categories_visible" ON expense_categories;
CREATE POLICY "categories_visible" ON expense_categories
  FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

-- ============================================================
-- I2: mutable search_path on the remaining 5 flagged functions (the other 6
-- were already covered by the C1 rewrites above).
-- ============================================================

ALTER FUNCTION public.current_tenant_id() SET search_path = public;
ALTER FUNCTION public.get_tenants_by_user(uuid) SET search_path = public;
ALTER FUNCTION public.user_has_role(text) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.accept_pending_invitation(uuid) SET search_path = public;

-- ============================================================
-- I3: pending_invitations had two near-duplicate SELECT policies — one
-- case-sensitive (a real bug: an invite to 'User@x.com' would never match a
-- login as 'user@x.com'), one case-insensitive (correct). Both also
-- re-evaluated auth.uid() per row instead of once via a wrapped subquery.
-- Dropped the buggy duplicate; kept and fixed the correct one.
-- ============================================================

DROP POLICY IF EXISTS "invitee reads own invite" ON pending_invitations;
DROP POLICY IF EXISTS "users_can_read_own_invitations" ON pending_invitations;
CREATE POLICY "users_can_read_own_invitations" ON pending_invitations
FOR SELECT
USING (lower(email) = lower((SELECT au.email FROM auth.users au WHERE au.id = (SELECT auth.uid()))::text));

-- ============================================================
-- I4: 40 unindexed tenant_id foreign keys. Since RLS filters nearly every
-- query in this schema by tenant_id = current_tenant_id(), this is the
-- single highest-value performance fix in the whole audit once this project
-- carries real traffic. Plain (non-CONCURRENTLY) CREATE INDEX — safe on this
-- low-traffic dev project; use CONCURRENTLY (run individually, outside a
-- transaction) if ever replaying this against a live-traffic project.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_id ON webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_tenant_id ON point_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automated_workflows_tenant_id ON automated_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_tenant_id ON expense_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_tenant_id ON payroll_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_tenant_id ON restaurant_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_tenant_id ON restaurant_order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_id ON reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_grocery_lots_tenant_id ON grocery_lots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bulk_pricing_rules_tenant_id ON bulk_pricing_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_waste_records_tenant_id ON waste_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_till_reconciliation_tenant_id ON till_reconciliation(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_categories_tenant_id ON restaurant_menu_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_tenant_id ON restaurant_menu_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_modifier_groups_tenant_id ON restaurant_modifier_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_modifiers_tenant_id ON restaurant_modifiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_branch_overrides_tenant_id ON restaurant_branch_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_pending_orders_tenant_id ON restaurant_pending_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_bill_splits_tenant_id ON restaurant_bill_splits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_kds_stations_tenant_id ON restaurant_kds_stations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_item_stations_tenant_id ON restaurant_item_stations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_argile_sessions_tenant_id ON restaurant_argile_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_argile_events_tenant_id ON restaurant_argile_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_argile_flavors_tenant_id ON restaurant_argile_flavors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_ingredient_suppliers_tenant_id ON restaurant_ingredient_suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_ingredients_tenant_id ON restaurant_ingredients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_ingredient_movements_tenant_id ON restaurant_ingredient_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_recipes_tenant_id ON restaurant_recipes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_item_recipes_tenant_id ON restaurant_menu_item_recipes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_waste_log_tenant_id ON restaurant_waste_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_shifts_tenant_id ON restaurant_shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_shift_assignments_tenant_id ON restaurant_shift_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_slow_alerts_tenant_id ON restaurant_slow_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_table_feedback_tenant_id ON restaurant_table_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_branches_tenant_id ON restaurant_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_branch_metrics_tenant_id ON restaurant_branch_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_ai_queries_tenant_id ON restaurant_ai_queries(tenant_id);

-- ============================================================
-- M1: two pairs of identical duplicate indexes.
-- ============================================================

DROP INDEX IF EXISTS idx_restaurant_menu_items_product_id;
DROP INDEX IF EXISTS idx_sales_table_order_id;

-- ============================================================
-- M4: rls_auto_enable had an unneeded anon/authenticated EXECUTE grant
-- (safe in practice — it's an event-trigger function, direct calls always
-- error harmlessly — but the grant itself is unnecessary attack surface).
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
