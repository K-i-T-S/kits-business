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

// Audit logging functions
export async function logAudit(
  action: string,
  entityType: string,
  entityId?: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
  metadata?: Record<string, unknown>,
) {
  if (useLocalMode) {
    console.warn('Audit logging is not available in local mode');
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const { data, error } = await supabaseAdmin.rpc('log_audit', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_old_values: oldValues,
    p_new_values: newValues,
    p_metadata: metadata || {},
  });

  if (error) throw error;
  return data;
}

export async function logActivity(
  action: string,
  description: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  if (useLocalMode) {
    console.warn('Activity logging is not available in local mode');
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const { data, error } = await supabaseAdmin.rpc('log_activity', {
    p_action: action,
    p_description: description,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata || {},
  });

  if (error) throw error;
  return data;
}

export async function logUserLogin(userId: string) {
  if (useLocalMode) {
    console.warn('User login logging is not available in local mode');
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const { error } = await supabaseAdmin.rpc('log_user_login', {
    user_id: userId,
  });

  if (error) throw error;
}

export async function logUserLogout(userId: string) {
  if (useLocalMode) {
    console.warn('User logout logging is not available in local mode');
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const { error } = await supabaseAdmin.rpc('log_user_logout', {
    user_id: userId,
  });

  if (error) throw error;
}

export async function logTenantSwitch(tenantId: string, oldTenantId?: string) {
  if (useLocalMode) {
    console.warn('Tenant switch logging is not available in local mode');
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const { error } = await supabaseAdmin.rpc('log_tenant_switch', {
    tenant_id: tenantId,
    old_tenant_id: oldTenantId,
  });

  if (error) throw error;
}

export async function logStoreSwitch(storeId: string, oldStoreId?: string) {
  if (useLocalMode) {
    console.warn('Store switch logging is not available in local mode');
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const { error } = await supabaseAdmin.rpc('log_store_switch', {
    store_id: storeId,
    old_store_id: oldStoreId,
  });

  if (error) throw error;
}

export async function logSecurityEvent(
  eventType: string,
  description: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  metadata?: Record<string, unknown>,
) {
  if (useLocalMode) {
    console.warn('Security event logging is not available in local mode');
    return;
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const { data, error } = await supabaseAdmin.rpc('log_security_event', {
    event_type: eventType,
    description: description,
    severity: severity,
    metadata: metadata || {},
  });

  if (error) throw error;
  return data;
}

// Activity feed functions
export async function getActivityFeed(
  tenantId: string,
  limit: number = 50,
  offset: number = 0,
) {
  if (useLocalMode) {
    console.warn('Activity feed is not available in local mode');
    return [];
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('activity_log')
    .select(`
      *,
      user:auth.users(id, email, user_metadata)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
}

export async function getAuditLogs(
  tenantId: string,
  filters?: {
    action?: string;
    entityType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  },
  limit: number = 100,
  offset: number = 0,
) {
  if (useLocalMode) {
    console.warn('Audit logs are not available in local mode');
    return [];
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  let query = supabaseAdmin
    .from('audit_logs')
    .select(`
      *,
      user:auth.users(id, email, user_metadata)
    `)
    .eq('tenant_id', tenantId);

  if (filters?.action) {
    query = query.eq('action', filters.action);
  }

  if (filters?.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }

  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
}

// Security monitoring
export async function getSecurityEvents(
  tenantId: string,
  severity?: 'low' | 'medium' | 'high' | 'critical',
  hours: number = 24,
) {
  if (useLocalMode) {
    console.warn('Security events are not available in local mode');
    return [];
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .like('action', 'security.%')
    .gte('created_at', startDate.toISOString());

  if (severity) {
    query = query.contains('metadata', { severity });
  }

  const { data, error } = await query
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// User activity summary
export async function getUserActivitySummary(
  tenantId: string,
  userId: string,
  days: number = 30,
) {
  if (useLocalMode) {
    console.warn('User activity summary is not available in local mode');
    return {
      totalActivities: 0,
      summary: {},
      recentActivities: [],
    };
  }
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured');
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from('activity_log')
    .select('action, created_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Group activities by action type
  const summary = data?.reduce<Record<string, number>>((acc, activity: { action: string }) => {
    acc[activity.action] = (acc[activity.action] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalActivities: data?.length || 0,
    summary: summary || {},
    recentActivities: data?.slice(0, 10) || [],
  };
}
