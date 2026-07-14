-- Track: pharmacy/supermarket role-native hub equivalents
-- (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
--
-- Extends hub_widget_preferences.hub_key (migration 000082) with 8 new
-- values for the pharmacy/supermarket vertical hubs being built to match
-- restaurant's existing role-native pattern (Stockkeeper/Operations, plus
-- a pharmacy-only Counter hub for the prescriptions/insurance-claims
-- workflow). 'accountant' is intentionally NOT duplicated per-vertical --
-- AccountantHomeHub.tsx already queries fully generic tables
-- (payroll_entries, expenses), so pharmacy/supermarket accountants reuse
-- the exact same hub_key, already tenant-scoped so no cross-tenant leakage.
ALTER TABLE hub_widget_preferences DROP CONSTRAINT hub_widget_preferences_hub_key_check;

ALTER TABLE hub_widget_preferences ADD CONSTRAINT hub_widget_preferences_hub_key_check CHECK (
  hub_key IN (
    'stockkeeper', 'accountant', 'receptionist',
    'operations_owner', 'operations_manager', 'operations_supervisor',
    'pharmacy_counter', 'pharmacy_stockkeeper',
    'pharmacy_operations_owner', 'pharmacy_operations_manager', 'pharmacy_operations_supervisor',
    'supermarket_stockkeeper',
    'supermarket_operations_owner', 'supermarket_operations_manager', 'supermarket_operations_supervisor'
  )
);
