-- Track: Offline-first architecture, Phase 0 (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
-- Infrastructure-only migration: creates the dedicated replication role and
-- a deliberately-scoped publication PowerSync (the chosen offline-sync
-- engine, see the founder-approved architecture research) reads via
-- Postgres logical replication (wal_level=logical already enabled by
-- Supabase for its own Realtime feature -- verified live, no change needed).
--
-- powersync_role needs REPLICATION + BYPASSRLS per PowerSync's own current
-- setup docs (docs.powersync.com/integrations/supabase/guide, verified
-- directly, not reconstructed from memory): PowerSync's tenant-scoping
-- happens in its own "Sync Rules" layer downstream, not Postgres RLS, so
-- the replication role legitimately needs to read past RLS to do its job.
-- The role's password is a generated random secret, communicated to the
-- founder out-of-band (not stored in this file or any migration).
--
-- The publication is deliberately NOT `FOR ALL TABLES` (PowerSync's own
-- quickstart default) -- this schema has kits_admin_config (stores the
-- admin PIN hash), api_keys, webhooks, payroll_entries/expenses, and
-- platform_admins, none of which should ever be replicated to a local
-- SQLite store on a restaurant's terminal device. Scoped instead to
-- exactly what the "core POS" v1 slice (founder-locked scope: orders,
-- sales, table state, basic inventory decrements, employee clock-in/PIN
-- login) needs:
--   sales, sale_items                          -- core POS writes
--   table_orders, restaurant_order_items        -- order/table state
--   products                                    -- menu items + stock
--   employees                                   -- PIN roster
--   restaurant_shifts, restaurant_shift_assignments  -- clock-in matching
--   restaurant_tables                           -- physical table entities
--   restaurant_menu_items, restaurant_menu_categories,
--   restaurant_menu_item_modifiers, restaurant_modifier_groups,
--   restaurant_modifiers                        -- menu structure for order-taking
--   tenant_users, user_active_tenant            -- tenant/role resolution for sync rules
--   tenants                                     -- tax_rate/exchange_rate for POS math
--
-- Deliberately deferred, not silently dropped -- add later via
-- `ALTER PUBLICATION powersync ADD TABLE ...` once Phase 1 client/sync-rule
-- work clarifies what's actually needed: KDS station routing, cash-drawer/
-- till reconciliation, bill-splitting, floor-alert/service-request signals,
-- reservations/waitlist, delivery, argile, bundles, and all finance/CRM/
-- loyalty/analytics tables (out of core-POS v1 scope entirely).

CREATE ROLE powersync_role WITH REPLICATION BYPASSRLS LOGIN PASSWORD 'REPLACED_BY_MIGRATION_RUNNER';

GRANT SELECT ON
  sales, sale_items,
  table_orders, restaurant_order_items,
  products,
  employees,
  restaurant_shifts, restaurant_shift_assignments,
  restaurant_tables,
  restaurant_menu_items, restaurant_menu_categories,
  restaurant_menu_item_modifiers, restaurant_modifier_groups, restaurant_modifiers,
  tenant_users, user_active_tenant,
  tenants
TO powersync_role;

CREATE PUBLICATION powersync FOR TABLE
  sales, sale_items,
  table_orders, restaurant_order_items,
  products,
  employees,
  restaurant_shifts, restaurant_shift_assignments,
  restaurant_tables,
  restaurant_menu_items, restaurant_menu_categories,
  restaurant_menu_item_modifiers, restaurant_modifier_groups, restaurant_modifiers,
  tenant_users, user_active_tenant,
  tenants;
