import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const useLocalMode = import.meta.env.VITE_USE_LOCAL_MODE === 'true';

// Service role client for admin operations
export const supabaseAdmin = (!useLocalMode && supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
}) : null;

// Store management functions
export async function createStore(name: string, code: string, address?: string, phone?: string, email?: string) {
  if (useLocalMode) {
    return { id: 'local-store', name, code, address, phone, email };
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { data, error } = await supabaseAdmin.rpc('create_store', {
    store_name: name,
    store_code: code,
    store_address: address,
    store_phone: phone,
    store_email: email,
  });

  if (error) throw error;
  return data;
}

export async function getStoresByTenant(tenantId: string) {
  if (useLocalMode) {
    return [{ id: 'local-store', name: 'Local Store', code: 'LOCAL', is_active: true }];
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function updateStore(storeId: string, updates: {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  manager_id?: string;
  is_active?: boolean;
  settings?: Record<string, unknown>;
}) {
  if (useLocalMode) {
    return { id: storeId, ...updates };
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { data, error } = await supabaseAdmin
    .from('stores')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStore(storeId: string) {
  if (useLocalMode) {
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { error } = await supabaseAdmin
    .from('stores')
    .update({ is_active: false })
    .eq('id', storeId);

  if (error) throw error;
}

export async function assignUserToStore(storeId: string, userId: string, role: 'manager' | 'cashier' | 'viewer') {
  if (useLocalMode) {
    return { store_id: storeId, user_id: userId, role };
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { data, error } = await supabaseAdmin
    .from('store_users')
    .upsert({
      store_id: storeId,
      user_id: userId,
      role: role,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeUserFromStore(storeId: string, userId: string) {
  if (useLocalMode) {
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { error } = await supabaseAdmin
    .from('store_users')
    .delete()
    .eq('store_id', storeId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getStoreUsers(storeId: string) {
  if (useLocalMode) {
    return [];
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { data, error } = await supabaseAdmin
    .from('store_users')
    .select(`
      *,
      user:auth.users(id, email, user_metadata),
      store:stores(id, name, code)
    `)
    .eq('store_id', storeId);

  if (error) throw error;
  return data;
}

export async function getUserStores(userId: string) {
  if (useLocalMode) {
    return [{ store: { id: 'local-store', name: 'Local Store', code: 'LOCAL', is_active: true } }];
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { data, error } = await supabaseAdmin
    .from('store_users')
    .select(`
      *,
      store:stores(id, name, code, address, is_active)
    `)
    .eq('user_id', userId)
    .eq('store.is_active', true);

  if (error) throw error;
  return data;
}

// Store context functions for API
export async function setStoreContext(storeId: string) {
  if (useLocalMode) {
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { error } = await supabaseAdmin.rpc('set_store_context', {
    store_id: storeId,
  });

  if (error) throw error;
}

export async function getCurrentStore() {
  if (useLocalMode) {
    return { id: 'local-store', name: 'Local Store', code: 'LOCAL' };
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { data, error } = await supabaseAdmin.rpc('get_current_store');

  if (error) throw error;
  return data;
}
