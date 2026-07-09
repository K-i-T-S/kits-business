// Tenant management — uses the authenticated Supabase client only.
// The service role key is NEVER used in the frontend.
// All functions below call SECURITY DEFINER database functions,
// so privilege checks happen server-side via RLS + auth.uid().

import { supabase } from './supabaseClient';

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  user_role: string;
  tenant_active: boolean;
  user_active: boolean;
}

const useLocalMode = import.meta.env.VITE_USE_LOCAL_MODE === 'true';

export async function createTenant(
  name: string,
  slug: string,
  ownerUserId: string,
  settings: Record<string, unknown> = {},
) {
  if (useLocalMode) {
    return { id: 'local-tenant', name, slug, ownerUserId, settings };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.rpc('create_tenant', {
    tenant_name: name,
    tenant_slug: slug,
    owner_user_id: ownerUserId,
    settings,
  });

  if (error) throw error;
  return data as unknown as Record<string, unknown>;
}

export async function selectActiveTenant(tenantId: string) {
  if (useLocalMode) return true;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.rpc('select_active_tenant', {
    p_tenant_id: tenantId,
  });

  if (error) throw error;
  return data as unknown as boolean;
}

export async function addUserToTenant(
  tenantId: string,
  userId: string,
  role: 'owner' | 'manager' | 'cashier' | 'viewer',
) {
  if (useLocalMode) return { success: true };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.rpc('add_user_to_tenant', {
    tenant_id_param: tenantId,
    user_id_param: userId,
    user_role: role,
  });

  if (error) throw error;
  return data as unknown as Record<string, unknown>;
}

export async function removeUserFromTenant(tenantId: string, userId: string) {
  if (useLocalMode) return { success: true };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.rpc('remove_user_from_tenant', {
    tenant_id_param: tenantId,
    user_id_param: userId,
  });

  if (error) throw error;
  return data as unknown as Record<string, unknown>;
}

export async function getCurrentUserTenant() {
  if (useLocalMode) {
    return {
      tenant_id: 'local-tenant',
      tenant_name: 'Local Business',
      tenant_slug: 'local',
      user_role: 'owner',
      settings: {},
      subscription_plan: 'business',
      subscription_status: 'active',
      loyalty_enabled: false,
      loyalty_points_per_dollar: 1,
      loyalty_points_redeem_rate: 0.01,
      exchange_rate: 89500,
      tax_rate: 0.11,
      show_dual_currency: true,
      secondary_currency: 'LBP',
      industry: 'retail',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.rpc('get_current_user_tenant');
  if (error) throw error;
  const tenantList = data as unknown as Record<string, unknown>[];
  return tenantList[0] ?? null;
}

export async function checkUserRole(requiredRole: string) {
  if (useLocalMode) return true;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.rpc('user_has_role', {
    required_role: requiredRole,
  });

  if (error) throw error;
  return data as boolean;
}

export async function getTenantUsers(tenantId: string) {
  if (useLocalMode) return [];

  const { data, error } = await supabase
    .from('tenant_user_details')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_active', true);

  if (error) throw error;
  return (data ?? []) as unknown as Record<string, unknown>[];
}

export async function getTenantsByUser(userId: string) {
  if (useLocalMode) {
    return [{ id: 'local-tenant', name: 'Local Business', slug: 'local' }] as unknown as TenantListItem[];
  }

  const { data, error } = await supabase
    .from('tenant_user_details')
    .select('*')
    .eq('user_id', userId)
    .eq('user_active', true)
    .eq('tenant_active', true);

  if (error) throw error;
  return (data ?? []) as unknown as TenantListItem[];
}
