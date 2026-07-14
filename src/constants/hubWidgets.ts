/**
 * Static catalog of the customizable widgets on each role-native hub
 * (Stockkeeper/Accountant/Receptionist/Operations) -- backs the "Hub
 * Layout" tab in SystemSettings.tsx and each hub component's own render.
 *
 * Only actual GlanceKpiWidget/ActionQueueWidget instances are catalogued
 * here. Bespoke contextual elements each hub also renders (Accountant's
 * "N expenses need a category" banner, Operations owner-scope's floor-
 * alerts summary, the "Open full X" forward links) are NOT customizable --
 * they're structural/contextual, not part of the widget system, and stay
 * fixed in their existing position.
 *
 * These widgets are fixed, bespoke, pre-built KPIs/queues baked into each
 * hub's own component code (not a generic pluggable widget type), so this
 * is a plain constant list, not a dynamic registry -- widget_id values in
 * hub_widget_preferences (migration 000082) are validated against this
 * catalog client-side, not FK-enforced in the database.
 */

export type HubKey =
  | 'stockkeeper'
  | 'accountant'
  | 'receptionist'
  | 'operations_owner'
  | 'operations_manager'
  | 'operations_supervisor'
  | 'pharmacy_counter'
  | 'pharmacy_stockkeeper'
  | 'pharmacy_operations_owner'
  | 'pharmacy_operations_manager'
  | 'pharmacy_operations_supervisor'
  | 'supermarket_stockkeeper'
  | 'supermarket_operations_owner'
  | 'supermarket_operations_manager'
  | 'supermarket_operations_supervisor';

export interface HubWidgetDef {
  id: string;
  label: string;
}

export const HUB_KEY_LABELS: Record<HubKey, string> = {
  stockkeeper: 'Stockkeeper',
  accountant: 'Accountant',
  receptionist: 'Reception',
  operations_owner: 'Operations — Owner view',
  operations_manager: 'Operations — Manager view',
  operations_supervisor: 'Operations — Supervisor view',
  pharmacy_counter: 'Pharmacy Counter',
  pharmacy_stockkeeper: 'Pharmacy Stockkeeper',
  pharmacy_operations_owner: 'Pharmacy Operations — Owner view',
  pharmacy_operations_manager: 'Pharmacy Operations — Manager view',
  pharmacy_operations_supervisor: 'Pharmacy Operations — Supervisor view',
  supermarket_stockkeeper: 'Supermarket Stockkeeper',
  supermarket_operations_owner: 'Supermarket Operations — Owner view',
  supermarket_operations_manager: 'Supermarket Operations — Manager view',
  supermarket_operations_supervisor: 'Supermarket Operations — Supervisor view',
};

/**
 * Which industry each hub_key belongs to, for filtering the Hub Layout
 * settings tab to only the tenant's own vertical -- 'shared' hubs (just
 * accountant, which reuses one generic component across verticals) show
 * for every industry.
 */
export const HUB_KEY_INDUSTRY: Record<HubKey, 'restaurant' | 'pharmacy' | 'supermarket' | 'shared'> = {
  stockkeeper: 'restaurant',
  accountant: 'shared',
  receptionist: 'restaurant',
  operations_owner: 'restaurant',
  operations_manager: 'restaurant',
  operations_supervisor: 'restaurant',
  pharmacy_counter: 'pharmacy',
  pharmacy_stockkeeper: 'pharmacy',
  pharmacy_operations_owner: 'pharmacy',
  pharmacy_operations_manager: 'pharmacy',
  pharmacy_operations_supervisor: 'pharmacy',
  supermarket_stockkeeper: 'supermarket',
  supermarket_operations_owner: 'supermarket',
  supermarket_operations_manager: 'supermarket',
  supermarket_operations_supervisor: 'supermarket',
};

/**
 * Default order doubles as the fallback order for any widget with no
 * stored hub_widget_preferences row -- keep this in sync with each hub
 * component's actual JSX order so an un-customized tenant renders
 * identically to before this feature existed.
 */
export const HUB_WIDGET_CATALOG: Record<HubKey, HubWidgetDef[]> = {
  stockkeeper: [
    { id: 'stockkeeper.below_par_kpi', label: 'Below par level (KPI)' },
    { id: 'stockkeeper.open_po_value_kpi', label: 'Open PO value (KPI)' },
    { id: 'stockkeeper.low_stock_queue', label: 'Low Stock queue' },
    { id: 'stockkeeper.awaiting_receipt_queue', label: 'Awaiting Receipt queue' },
  ],
  accountant: [
    { id: 'accountant.month_expenses_kpi', label: "This month's expenses (KPI)" },
    { id: 'accountant.next_vat_kpi', label: 'Next VAT filing (KPI)' },
    { id: 'accountant.payroll_queue', label: 'Payroll Pending Payment queue' },
  ],
  receptionist: [
    { id: 'receptionist.waitlist_count_kpi', label: 'On the waitlist (KPI)' },
    { id: 'receptionist.reservations_count_kpi', label: "Today's reservations (KPI)" },
    { id: 'receptionist.waitlist_queue', label: 'Waitlist queue' },
    { id: 'receptionist.reservations_queue', label: 'Reservations Needing Confirmation queue' },
  ],
  operations_owner: [
    { id: 'operations.today_revenue_kpi', label: "Today's revenue (KPI)" },
    { id: 'operations.week_revenue_kpi', label: 'Last 7 days revenue (KPI)' },
  ],
  operations_manager: [
    { id: 'operations.today_revenue_kpi', label: "Today's revenue (KPI)" },
    { id: 'operations.staff_clocked_in_kpi', label: 'Staff clocked in (KPI)' },
    { id: 'operations.floor_alerts_queue', label: 'Floor Alerts queue' },
  ],
  operations_supervisor: [
    { id: 'operations.open_floor_alerts_kpi', label: 'Open floor alerts (KPI)' },
    { id: 'operations.staff_clocked_in_kpi', label: 'Staff clocked in (KPI)' },
    { id: 'operations.floor_alerts_queue', label: 'Floor Alerts queue' },
  ],
  pharmacy_counter: [
    { id: 'pharmacy_counter.pending_prescriptions_kpi', label: 'Pending prescriptions (KPI)' },
    { id: 'pharmacy_counter.insurance_claims_kpi', label: 'Insurance claims pending (KPI)' },
    { id: 'pharmacy_counter.insurance_claims_queue', label: 'Insurance Claims Pending queue' },
  ],
  pharmacy_stockkeeper: [
    { id: 'pharmacy_stockkeeper.expiring_lots_kpi', label: 'Lots expiring ≤30 days (KPI)' },
    { id: 'pharmacy_stockkeeper.expiring_value_kpi', label: 'Expiring value, 30d (KPI)' },
  ],
  pharmacy_operations_owner: [
    { id: 'pharmacy_operations.today_revenue_kpi', label: "Today's revenue (KPI)" },
    { id: 'pharmacy_operations.week_revenue_kpi', label: 'Last 7 days revenue (KPI)' },
  ],
  pharmacy_operations_manager: [
    { id: 'pharmacy_operations.today_revenue_kpi', label: "Today's revenue (KPI)" },
    { id: 'pharmacy_operations.insurance_claims_kpi', label: 'Insurance claims pending (KPI)' },
    { id: 'pharmacy_operations.insurance_claims_queue', label: 'Insurance Claims Pending queue' },
  ],
  pharmacy_operations_supervisor: [
    { id: 'pharmacy_operations.pending_prescriptions_kpi', label: 'Pending prescriptions (KPI)' },
    { id: 'pharmacy_operations.insurance_claims_kpi', label: 'Insurance claims pending (KPI)' },
  ],
  supermarket_stockkeeper: [
    { id: 'supermarket_stockkeeper.below_par_kpi', label: 'Below par level (KPI)' },
    { id: 'supermarket_stockkeeper.expiring_lots_kpi', label: 'Lots expiring ≤30 days (KPI)' },
    { id: 'supermarket_stockkeeper.awaiting_receipt_queue', label: 'Awaiting Receipt queue' },
  ],
  supermarket_operations_owner: [
    { id: 'supermarket_operations.today_revenue_kpi', label: "Today's revenue (KPI)" },
    { id: 'supermarket_operations.week_revenue_kpi', label: 'Last 7 days revenue (KPI)' },
  ],
  supermarket_operations_manager: [
    { id: 'supermarket_operations.today_revenue_kpi', label: "Today's revenue (KPI)" },
    { id: 'supermarket_operations.below_par_kpi', label: 'Below par level (KPI)' },
    { id: 'supermarket_operations.awaiting_receipt_queue', label: 'Awaiting Receipt queue' },
  ],
  supermarket_operations_supervisor: [
    { id: 'supermarket_operations.below_par_kpi', label: 'Below par level (KPI)' },
    { id: 'supermarket_operations.expiring_lots_kpi', label: 'Lots expiring ≤30 days (KPI)' },
  ],
};
