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

// Legacy action set (view_dashboard, make_sales, …) — kept so existing
// RoleGate / canPerform calls compile without change.
// New granular actions (create_sales, manage_products, …) are also part
// of this union so CustomRolesManager and ROLE_PERMISSIONS can share the type.
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
  // New granular actions — used by ROLE_PERMISSIONS and CustomRolesManager
  | 'create_sales'
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

// ── Legacy role→action map (used by SubscriptionContext.canPerform) ────────────
const ROLE_ACTIONS: Record<UserRole, RoleAction[]> = {
  viewer: ['view_dashboard', 'view_customers', 'view_products', 'view_reports'],
  cashier: [
    'view_dashboard',
    'make_sales',
    'view_customers',
    'edit_customers',
    'view_products',
    'view_reports',
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
  ],
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
  ],
};

export function roleCanPerform(role: UserRole, action: RoleAction): boolean {
  // eslint-disable-next-line security/detect-object-injection
  return ROLE_ACTIONS[role].includes(action);
}

// ── New granular permissions matrix (canonical source of truth) ────────────────
// Maps every RoleType to the fine-grained actions it can perform.
// Used as defaults in CustomRolesManager and for any new permission checks.
export const ROLE_PERMISSIONS: Record<RoleType, RoleAction[]> = {
  owner: [
    'create_sales',
    'manage_customers',
    'manage_inventory',
    'manage_products',
    'view_reports',
    'view_costs',
    'view_analytics',
    'manage_employees',
    'manage_settings',
  ],
  admin: [
    'create_sales',
    'manage_customers',
    'manage_inventory',
    'manage_products',
    'view_reports',
    'view_costs',
    'view_analytics',
    'manage_employees',
    'manage_settings',
  ],
  manager: [
    'create_sales',
    'manage_customers',
    'manage_inventory',
    'manage_products',
    'view_reports',
    'view_costs',
    'view_analytics',
    'manage_employees',
  ],
  supervisor: [
    'create_sales',
    'manage_customers',
    'manage_inventory',
  ],
  cashier: [
    'create_sales',
    'manage_customers',
  ],
  accountant: [
    'view_reports',
    'view_costs',
    'view_analytics',
  ],
  stockkeeper: [
    'manage_inventory',
    'manage_products',
  ],
  viewer: [
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
    action: 'create_sales',
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
  // eslint-disable-next-line security/detect-object-injection
  return FEATURE_DISPLAY[feature].requiredPlan;
}
