import { supabase } from './supabaseClient';

const HOME_HUB_ROUTES: Record<string, string> = {
  waiter: '/restaurant/waiter',
  kitchen: '/restaurant/kds',
  argile: '/restaurant/argile',
  pos_cashier: '/pos',
};

interface CurrentTenantRow {
  user_role?: string | null;
  home_hub?: string | null;
}

/**
 * Track 2, Phase A (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * resolves the just-authenticated user's role-native landing route, if
 * any. Called directly against get_current_user_tenant() rather than
 * reading SubscriptionContext, since that context reloads asynchronously
 * off the same signInWithPassword() auth event this runs right after —
 * relying on it here would race the context's own reload.
 *
 * Returns null (caller falls back to today's default landing) when the
 * signed-in user has no custom role, or their custom role has no
 * home_hub set — this covers all "office" roles (owner/manager/
 * supervisor/accountant/stockkeeper/viewer) until Phase B ships them
 * dedicated hubs.
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
      return HOME_HUB_ROUTES[row.home_hub] ?? null;
    }
    if (row.user_role === 'cashier') {
      return '/pos';
    }
    return null;
  } catch {
    return null;
  }
}
