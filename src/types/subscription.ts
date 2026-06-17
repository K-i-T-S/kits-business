export type SubscriptionPlan = 'starter' | 'growth' | 'business';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
export type UserRole = 'owner' | 'manager' | 'cashier' | 'viewer';

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
  | 'access_enterprise';

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

// Role → allowed actions
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
  return ROLE_ACTIONS[role].includes(action);
}

/** Returns the minimum plan that includes a given feature. */
export function minimumPlanForFeature(feature: Feature): SubscriptionPlan {
  return FEATURE_DISPLAY[feature].requiredPlan;
}
