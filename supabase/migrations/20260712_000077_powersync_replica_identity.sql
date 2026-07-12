-- Track: offline-first architecture, Phase 1b (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
-- PowerSync's own Supabase integration docs (references/supabase-auth.md in
-- the installed powersync-ja/agent-skills skill) explicitly require
-- REPLICA IDENTITY FULL on every replicated table so DELETE operations
-- include the full row in the WAL -- without it, PowerSync cannot reliably
-- sync deletes to clients (REPLICA IDENTITY DEFAULT only includes primary
-- key columns). Missed in the Phase 0 migration (000076); applying now for
-- all 17 tables in the `powersync` publication. Grants no new access --
-- only changes what's included in the WAL for UPDATE/DELETE.

ALTER TABLE tenants REPLICA IDENTITY FULL;
ALTER TABLE tenant_users REPLICA IDENTITY FULL;
ALTER TABLE user_active_tenant REPLICA IDENTITY FULL;
ALTER TABLE employees REPLICA IDENTITY FULL;
ALTER TABLE products REPLICA IDENTITY FULL;
ALTER TABLE sales REPLICA IDENTITY FULL;
ALTER TABLE sale_items REPLICA IDENTITY FULL;
ALTER TABLE table_orders REPLICA IDENTITY FULL;
ALTER TABLE restaurant_order_items REPLICA IDENTITY FULL;
ALTER TABLE restaurant_tables REPLICA IDENTITY FULL;
ALTER TABLE restaurant_shifts REPLICA IDENTITY FULL;
ALTER TABLE restaurant_shift_assignments REPLICA IDENTITY FULL;
ALTER TABLE restaurant_menu_categories REPLICA IDENTITY FULL;
ALTER TABLE restaurant_menu_items REPLICA IDENTITY FULL;
ALTER TABLE restaurant_modifier_groups REPLICA IDENTITY FULL;
ALTER TABLE restaurant_modifiers REPLICA IDENTITY FULL;
ALTER TABLE restaurant_menu_item_modifiers REPLICA IDENTITY FULL;
