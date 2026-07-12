-- Track 2, Phase B (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
-- widens custom_roles.home_hub from the 4 Phase A values (waiter/kitchen/
-- argile/pos_cashier) to include the 4 net-new hubs shipped this pass:
--
--   operations  — Owner/Manager/Supervisor's shared adaptive hub
--                 (OperationsHomeHub.tsx; these three are one job at
--                 different altitude, not three separate pages)
--   reception   — ReceptionistHomeHub.tsx (waitlist + reservations)
--   accountant  — AccountantHomeHub.tsx (payroll/expenses/VAT)
--   stockkeeper — StockkeeperHomeHub.tsx (low-stock/PO receiving; distinct
--                 from the existing 'kitchen' value Sous Chef already uses)
--
-- get_current_user_tenant() already returns both home_hub and industry
-- (added in Phase A / present since before Phase A respectively) — no
-- further RPC change needed this migration.
--
-- No CustomRolesManager.tsx picker will offer a base_role/home_hub
-- combination the RoleRoute allowedRoles on the corresponding App.tsx
-- route can't reach — same redirect-bounce prevention as Phase A's
-- VALID_HOME_HUBS_BY_BASE_ROLE, updated to match the new routes' gates:
--   /restaurant/operations  — owner, admin, manager, supervisor
--   /restaurant/reception   — owner, admin, manager, supervisor, cashier
--   /restaurant/accountant  — owner, admin, manager, accountant
--   /restaurant/stockkeeper — owner, admin, manager, stockkeeper

ALTER TABLE public.custom_roles DROP CONSTRAINT custom_roles_home_hub_check;

ALTER TABLE public.custom_roles
  ADD CONSTRAINT custom_roles_home_hub_check
  CHECK (home_hub IS NULL OR home_hub IN (
    'waiter', 'kitchen', 'argile', 'pos_cashier',
    'operations', 'reception', 'accountant', 'stockkeeper'
  ));
