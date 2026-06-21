import { useEffect, useCallback, useState } from 'react';

import { supabase } from '@/utils/supabaseClient';
import type { SlowAlert } from '@/types/restaurant';

export function useSlowServiceAlerts(_thresholdMinutes = 15) {
  const [activeAlerts, setActiveAlerts] = useState<SlowAlert[]>([]);

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('restaurant_slow_alerts')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: false });
    if (data) setActiveAlerts(data as SlowAlert[]);
  }, []);

  const acknowledgeAlert = useCallback(async (id: string) => {
    await supabase
      .from('restaurant_slow_alerts')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', id);
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const resolveAlert = useCallback(async (id: string) => {
    await supabase
      .from('restaurant_slow_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id);
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  useEffect(() => {
    void fetchAlerts();
    const interval = setInterval(() => void fetchAlerts(), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  return {
    activeAlerts,
    acknowledgeAlert,
    resolveAlert,
    totalCount: activeAlerts.length,
  };
}
