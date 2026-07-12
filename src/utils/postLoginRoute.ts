import { supabase } from './supabaseClient';

const HOME_HUB_ROUTES: Record<string, string> = {
  waiter: '/restaurant/waiter',
  kitchen: '/restaurant/kds',
  argile: '/restaurant/argile',
  pos_cashier: '/pos',
  operations: '/restaurant/operations',
  reception: '/restaurant/reception',
  accountant: '/restaurant/accountant',
  stockkeeper: '/restaurant/stockkeeper',
};

// Every home_hub value except pos_cashier points at a restaurant-only page
// (queries restaurant_-prefixed tables). pos_cashier -> /pos is genuinely
// industry-agnostic. Found via a platform-wide audit: this function
// previously honored ANY tenant's home_hub unconditionally, with no
// industry check at all -- CustomRolesManager.tsx's picker also had no
// industry gating, so a non-restaurant owner could genuinely assign
// "Waiter"/"Kitchen"/etc. to a custom role, and that employee would land
// on a broken page (querying tables that don't apply to their tenant)
// every future login.
const RESTAURANT_ONLY_HOME_HUBS = new Set(['waiter', 'kitchen', 'argile', 'operations', 'reception', 'accountant', 'stockkeeper']);

// Base-role defaults applied only for restaurant-industry tenants when no
// custom-role home_hub is set — owner/manager/supervisor/accountant/
// stockkeeper are usually direct tenant_users.role assignments, not custom
// roles, so they'd otherwise never get a home_hub at all. Restaurant-gated
// deliberately: every one of these hub pages queries restaurant_-prefixed
// tables (except AccountantHomeHub, which is industry-agnostic, but its
// route still lives under /restaurant/ for now — see Phase B roadmap note
// on this being restaurant-first, not solved for other verticals yet).
const RESTAURANT_BASE_ROLE_DEFAULTS: Record<string, string> = {
  owner: '/restaurant/operations',
  admin: '/restaurant/operations',
  manager: '/restaurant/operations',
  supervisor: '/restaurant/operations',
  accountant: '/restaurant/accountant',
  stockkeeper: '/restaurant/stockkeeper',
};

interface CurrentTenantRow {
  user_role?: string | null;
  home_hub?: string | null;
  industry?: string | null;
}

/**
 * Track 2 (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * resolves the just-authenticated user's role-native landing route, if
 * any. Called directly against get_current_user_tenant() rather than
 * reading SubscriptionContext, since that context reloads asynchronously
 * off the same signInWithPassword() auth event this runs right after —
 * relying on it here would race the context's own reload.
 *
 * Returns null (caller falls back to today's default landing) when
 * nothing applies — e.g. a viewer role, or a non-restaurant tenant whose
 * role has no explicit custom-role home_hub set.
 */
export async function resolveRoleHomeRoute(): Promise<string | null> {
  try {
    // Avoid destructuring supabase.rpc()'s loosely-typed result directly —
    // matches the pattern already used in SubscriptionContext.tsx for this
    // same RPC (destructuring assignment trips no-unsafe-assignment on an
    // `any`-typed result; property access on the assigned variable doesn't).
    const rpcResult = await supabase.rpc('get_current_user_tenant');
    if (rpcResult.error || !rpcResult.data) return null;

    const rawData = rpcResult.data as CurrentTenantRow[] | CurrentTenantRow;
    const row = Array.isArray(rawData) ? rawData[0] : rawData;
    if (!row) return null;

    if (row.home_hub && row.home_hub in HOME_HUB_ROUTES) {
      const isRestaurantOnly = RESTAURANT_ONLY_HOME_HUBS.has(row.home_hub);
      if (!isRestaurantOnly || row.industry === 'restaurant') {
        return HOME_HUB_ROUTES[row.home_hub] ?? null;
      }
      // Restaurant-only home_hub on a non-restaurant tenant (a stale value
      // from before this fix, or industry was changed after assignment) —
      // fall through instead of landing them on a broken page.
    }
    if (row.user_role === 'cashier') {
      return '/pos';
    }
    if (row.industry === 'restaurant' && row.user_role && row.user_role in RESTAURANT_BASE_ROLE_DEFAULTS) {
      return RESTAURANT_BASE_ROLE_DEFAULTS[row.user_role] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
