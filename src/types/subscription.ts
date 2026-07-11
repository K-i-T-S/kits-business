export type SubscriptionPlan = 'starter' | 'growth' | 'business';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

// Legacy 4-role type — kept for SubscriptionContext / RoleGate compatibility
export type UserRole = 'owner' | 'manager' | 'cashier' | 'viewer';

// Full role union including all new standard roles
export type RoleType =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'supervisor'
  | 'cashier'
  | 'accountant'
  | 'stockkeeper'
  | 'viewer';

// All actions checkable via canPerform()/RoleGate/custom-role permission
// overrides. Originally split into a "legacy" set and a "new granular"
// set (with a 'create_sales' vs 'make_sales' naming collision between
// them); consolidated into one list as part of Track 1b-i/ii — 'create_sales'
// removed entirely since it had zero real call sites anywhere in the app.
export type RoleAction =
  | 'view_dashboard'
  | 'make_sales'
  | 'view_customers'
  | 'edit_customers'
  | 'view_products'
  | 'edit_products'
  | 'view_reports'
  | 'view_employees'
  | 'edit_employees'
  | 'access_settings'
  | 'access_enterprise'
  | 'manage_customers'
  | 'manage_inventory'
  | 'manage_products'
  | 'view_costs'
  | 'view_analytics'
  | 'manage_employees'
  | 'manage_settings';

export interface PlanLimits {
  maxProducts: number | null;
  maxCustomers: number | null;
  maxEmployees: number | null;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  starter: { maxProducts: 50, maxCustomers: 100, maxEmployees: 1 },
  growth: { maxProducts: null, maxCustomers: null, maxEmployees: 10 },
  business: { maxProducts: null, maxCustomers: null, maxEmployees: null },
};

export type Feature =
  | 'pos'
  | 'basic_reports'
  | 'advanced_analytics'
  | 'forecasting'
  | 'crm'
  | 'inventory_management'
  | 'enterprise_dashboard'
  | 'monitoring'
  | 'api_webhooks'
  | 'multi_location';

export const PLAN_FEATURES: Record<SubscriptionPlan, Feature[]> = {
  starter: ['pos', 'basic_reports'],
  growth: [
    'pos',
    'basic_reports',
    'advanced_analytics',
    'forecasting',
    'crm',
    'inventory_management',
  ],
  business: [
    'pos',
    'basic_reports',
    'advanced_analytics',
    'forecasting',
    'crm',
    'inventory_management',
    'enterprise_dashboard',
    'monitoring',
    'api_webhooks',
    'multi_location',
  ],
};

export const PLAN_DISPLAY: Record<
  SubscriptionPlan,
  { name: string; price: string; color: string; requiredFor: Feature[] }
> = {
  starter: {
    name: 'Starter',
    price: 'Free',
    color: 'text-slate-400',
    requiredFor: [],
  },
  growth: {
    name: 'Growth',
    price: '$29/mo',
    color: 'text-indigo-400',
    requiredFor: ['advanced_analytics', 'forecasting', 'crm', 'inventory_management'],
  },
  business: {
    name: 'Business',
    price: '$79/mo',
    color: 'text-amber-400',
    requiredFor: ['enterprise_dashboard', 'monitoring', 'api_webhooks', 'multi_location'],
  },
};

export const FEATURE_DISPLAY: Record<Feature, { name: string; requiredPlan: SubscriptionPlan }> = {
  pos: { name: 'Point of Sale', requiredPlan: 'starter' },
  basic_reports: { name: 'Basic Reports', requiredPlan: 'starter' },
  advanced_analytics: { name: 'Advanced Analytics', requiredPlan: 'growth' },
  forecasting: { name: 'Forecasting', requiredPlan: 'growth' },
  crm: { name: 'CRM', requiredPlan: 'growth' },
  inventory_management: { name: 'Inventory Management', requiredPlan: 'growth' },
  enterprise_dashboard: { name: 'Enterprise Dashboard', requiredPlan: 'business' },
  monitoring: { name: 'Monitoring', requiredPlan: 'business' },
  api_webhooks: { name: 'API & Webhooks', requiredPlan: 'business' },
  multi_location: { name: 'Multi-Location', requiredPlan: 'business' },
};

export function roleCanPerform(role: RoleType, action: RoleAction): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

// ── New granular permissions matrix (canonical source of truth) ────────────────
// Maps every RoleType to the fine-grained actions it can perform.
// Used as defaults in CustomRolesManager and for any new permission checks.
// Consolidated 8-role permission table (Track 1b-i/ii,
// docs/superpowers/specs/2026-07-11-platform-roadmap-design.md) — replaces
// the old split between a 4-role legacy ROLE_ACTIONS table (the only one
// actually wired to runtime canPerform() checks) and this 8-role table
// (defined but never consumed by anything). owner/manager/cashier/viewer
// below are exact unions of what those 4 roles already had across both
// tables — zero behavior change for the 3 real call sites that exist
// today (canPerform('manage_customers')/('manage_settings')/('make_sales'),
// grepped across the whole app, not assumed). admin is an explicit alias
// of owner (matches the DB-level current_user_role() aliasing). 'create_sales'
// was renamed to 'make_sales' — the former had zero real call sites
// anywhere in the app; the latter is what's actually used. supervisor/
// accountant/stockkeeper are fresh, deliberately conservative grants since
// no live UI exercises their exact values yet.
export const ROLE_PERMISSIONS: Record<RoleType, RoleAction[]> = {
  owner: [
    'view_dashboard',
    'make_sales',
    'view_customers',
    'edit_customers',
    'view_products',
    'edit_products',
    'view_reports',
    'view_employees',
    'edit_employees',
    'access_settings',
    'access_enterprise',
    'manage_settings',
    'manage_customers',
    'manage_inventory',
    'manage_products',
    'view_costs',
    'view_analytics',
    'manage_employees',
  ],
  admin: [
    'view_dashboard',
    'make_sales',
    'view_customers',
    'edit_customers',
    'view_products',
    'edit_products',
    'view_reports',
    'view_employees',
    'edit_employees',
    'access_settings',
    'access_enterprise',
    'manage_settings',
    'manage_customers',
    'manage_inventory',
    'manage_products',
    'view_costs',
    'view_analytics',
    'manage_employees',
  ],
  manager: [
    'view_dashboard',
    'make_sales',
    'view_customers',
    'edit_customers',
    'view_products',
    'edit_products',
    'view_reports',
    'view_employees',
    'manage_settings',
    'manage_customers',
    'manage_inventory',
    'manage_products',
    'view_costs',
    'view_analytics',
    'manage_employees',
  ],
  supervisor: [
    'view_dashboard',
    'make_sales',
    'view_customers',
    'edit_customers',
    'view_products',
    'manage_customers',
    'manage_inventory',
  ],
  cashier: [
    'view_dashboard',
    'make_sales',
    'view_customers',
    'edit_customers',
    'view_products',
    'view_reports',
    'manage_customers',
  ],
  accountant: [
    'view_dashboard',
    'view_customers',
    'view_products',
    'view_reports',
    'view_costs',
    'view_analytics',
  ],
  stockkeeper: [
    'view_dashboard',
    'view_products',
    'edit_products',
    'manage_inventory',
    'manage_products',
  ],
  viewer: [
    'view_dashboard',
    'view_customers',
    'view_products',
    'view_reports',
  ],
};

// ── Role display labels ────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  supervisor: 'Supervisor',
  cashier: 'Cashier',
  accountant: 'Accountant',
  stockkeeper: 'Stock Manager',
  viewer: 'Viewer',
};

// ── Role human-readable descriptions ──────────────────────────────────────────
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full access + billing',
  admin: 'Full access across the business',
  manager: 'Operations + HR, no settings',
  supervisor: 'Shift lead — sales, customers, inventory',
  cashier: 'POS and customer management',
  accountant: 'Read-only financial reports',
  stockkeeper: 'Inventory and products only',
  viewer: 'View-only access',
};

// ── Available permissions for the custom role builder ─────────────────────────
export const ALL_PERMISSIONS: Array<{
  action: RoleAction;
  label: string;
  description: string;
}> = [
  {
    action: 'make_sales',
    label: 'Process Sales',
    description: 'Use the POS to create sales and refunds',
  },
  {
    action: 'manage_customers',
    label: 'Manage Customers',
    description: 'Add, edit, and view customer records',
  },
  {
    action: 'manage_inventory',
    label: 'Manage Inventory',
    description: 'Adjust stock levels and transfers',
  },
  {
    action: 'manage_products',
    label: 'Manage Products',
    description: 'Add, edit, and delete products',
  },
  {
    action: 'view_reports',
    label: 'View Reports',
    description: 'Access sales and performance reports',
  },
  {
    action: 'view_costs',
    label: 'View Cost Data',
    description: 'See product costs and profit margins',
  },
  {
    action: 'view_analytics',
    label: 'View Analytics',
    description: 'Access advanced analytics and forecasting',
  },
  {
    action: 'manage_employees',
    label: 'Manage Employees',
    description: 'Add, edit employees and set roles',
  },
  {
    action: 'manage_settings',
    label: 'System Settings',
    description: 'Change business settings and preferences',
  },
];

/** Returns the minimum plan that includes a given feature. */
export function minimumPlanForFeature(feature: Feature): SubscriptionPlan {

  return FEATURE_DISPLAY[feature].requiredPlan;
}
