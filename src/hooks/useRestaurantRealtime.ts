import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';

/**
 * Subscribe to real-time changes for restaurant tables, orders, and order items.
 * Replace all polling (setInterval) with this hook.
 */
export function useRestaurantRealtime(
  tenantId: string,
  callbacks: {
    onTableChange?: (payload: any) => void;
    onOrderChange?: (payload: any) => void;
    onOrderItemChange?: (payload: any) => void;
  } = {}
): void {
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`restaurant:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => callbacks.onTableChange?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => callbacks.onOrderChange?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_order_items',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => callbacks.onOrderItemChange?.(payload)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, callbacks.onTableChange, callbacks.onOrderChange, callbacks.onOrderItemChange]);
}

/**
 * Hook to detect offline status
 */
export function useOfflineStatus(): { isOffline: boolean; pendingCount: number } {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOffline, pendingCount: 0 }; // pendingCount populated in Task X
}
