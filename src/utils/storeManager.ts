import { createClient } from '@supabase/supabase-js';

import { supabase } from './supabaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL');
}

// Service role client for admin operations
export const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
}) : null;

// Store management functions
export async function createStore(name: string, code: string, address?: string, phone?: string, email?: string) {
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
  settings?: any;
}) {
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
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { error } = await supabaseAdmin.rpc('set_store_context', {
    store_id: storeId,
  });

  if (error) throw error;
}

export async function getCurrentStore() {
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }
  const { data, error } = await supabaseAdmin.rpc('get_current_store');

  if (error) throw error;
  return data;
}
