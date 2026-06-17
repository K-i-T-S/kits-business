import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const useLocalMode = import.meta.env.VITE_USE_LOCAL_MODE === 'true';

// Service role client for admin operations (optional for tenant management)
export const supabaseAdmin = (!useLocalMode && supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
}) : null;

// Tenant management functions
export async function createTenant(name: string, slug: string, ownerUserId: string, settings = {}) {
  if (useLocalMode) {
    return { id: 'local-tenant', name, slug, ownerUserId, settings };
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Please set VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }
  const { data, error } = await supabaseAdmin.rpc('create_tenant', {
    tenant_name: name,
    tenant_slug: slug,
    owner_user_id: ownerUserId,
    settings,
  });

  if (error) throw error;
  return data;
}

export async function addUserToTenant(tenantId: string, userId: string, role: 'owner' | 'manager' | 'cashier' | 'viewer') {
  if (useLocalMode) {
    return { success: true };
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Please set VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }
  const { data, error } = await supabaseAdmin.rpc('add_user_to_tenant', {
    tenant_id_param: tenantId,
    user_id_param: userId,
    user_role: role,
  });

  if (error) throw error;
  return data;
}

export async function removeUserFromTenant(tenantId: string, userId: string) {
  if (useLocalMode) {
    return { success: true };
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Please set VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }
  const { data, error } = await supabaseAdmin.rpc('remove_user_from_tenant', {
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
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Please set VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }
  const { data, error } = await supabaseAdmin.rpc('get_current_user_tenant');

  if (error) throw error;
  return data?.[0] || null;
}

export async function checkUserRole(requiredRole: string) {
  if (useLocalMode) {
    return true; // Grant all permissions in local mode
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Please set VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }
  const { data, error } = await supabaseAdmin.rpc('user_has_role', {
    required_role: requiredRole,
  });

  if (error) throw error;
  return data;
}

export async function getTenantUsers(tenantId: string) {
  if (useLocalMode) {
    return [];
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Please set VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }
  const { data, error } = await supabaseAdmin
    .from('tenant_user_details')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_active', true);

  if (error) throw error;
  return data;
}

export async function getTenantsByUser(userId: string) {
  if (useLocalMode) {
    return [{ id: 'local-tenant', name: 'Local Business', slug: 'local' }];
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Please set VITE_SUPABASE_SERVICE_ROLE_KEY.');
  }
  const { data, error } = await supabaseAdmin
    .from('tenant_user_details')
    .select('*')
    .eq('user_id', userId)
    .eq('user_active', true)
    .eq('tenant_active', true);

  if (error) throw error;
  return data;
}
