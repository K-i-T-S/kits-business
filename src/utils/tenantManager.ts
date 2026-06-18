// Tenant management — uses the authenticated Supabase client only.
// The service role key is NEVER used in the frontend.
// All functions below call SECURITY DEFINER database functions,
// so privilege checks happen server-side via RLS + auth.uid().

import { supabase } from './supabaseClient';

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

  const { data, error } = await supabase.rpc('create_tenant', {
    tenant_name: name,
    tenant_slug: slug,
    owner_user_id: ownerUserId,
    settings,
  });

  if (error) throw error;
  return data;
}

export async function addUserToTenant(
  tenantId: string,
  userId: string,
  role: 'owner' | 'manager' | 'cashier' | 'viewer',
) {
  if (useLocalMode) return { success: true };

  const { data, error } = await supabase.rpc('add_user_to_tenant', {
    tenant_id_param: tenantId,
    user_id_param: userId,
    user_role: role,
  });

  if (error) throw error;
  return data;
}

export async function removeUserFromTenant(tenantId: string, userId: string) {
  if (useLocalMode) return { success: true };

  const { data, error } = await supabase.rpc('remove_user_from_tenant', {
    tenant_id_param: tenantId,
    user_id_param: userId,
  });

  if (error) throw error;
  return data;
}

export async function getCurrentUserTenant() {
  if (useLocalMode) {
    return { id: 'local-tenant', name: 'Local Business', slug: 'local' };
  }

  const { data, error } = await supabase.rpc('get_current_user_tenant');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function checkUserRole(requiredRole: string) {
  if (useLocalMode) return true;

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
  return data ?? [];
}

export async function getTenantsByUser(userId: string) {
  if (useLocalMode) {
    return [{ id: 'local-tenant', name: 'Local Business', slug: 'local' }];
  }

  const { data, error } = await supabase
    .from('tenant_user_details')
    .select('*')
    .eq('user_id', userId)
    .eq('user_active', true)
    .eq('tenant_active', true);

  if (error) throw error;
  return data ?? [];
}
