import { useEffect, useState, useCallback } from 'react';

import { supabase } from '@/utils/supabaseClient';

/**
 * Forecast data from restaurant_demand_forecasts table
 */
export interface DemandForecast {
  id: string;
  tenant_id: string;
  date: string; // YYYY-MM-DD
  day_of_week?: string;
  predicted_covers: number;
  predicted_revenue: number;
  confidence: number; // 0-1
  factors?: Record<string, unknown>;
  prep_recommendations?: Record<string, unknown>;
  staff_recommendation?: Record<string, unknown>;
  created_at: string;
}

/**
 * Hook to fetch 7-day demand forecasts for a tenant
 * Queries restaurant_demand_forecasts starting from tomorrow, ordered by date
 */
export function useDemandForecast(tenantId?: string) {
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get tomorrow's date to start the forecast
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toISOString().split('T')[0]!;

      // Fetch next 7 days of forecasts
      const { data, error: err } = await supabase
        .from('restaurant_demand_forecasts')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('date', tomorrowISO)
        .order('date', { ascending: true })
        .limit(7);

      if (err) {
        throw new Error(err.message);
      }

      setForecasts((data as DemandForecast[]) ?? []);
    } catch (err) {
      console.error('[useDemandForecast] load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load forecasts');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { forecasts, loading, error, refresh };
}
