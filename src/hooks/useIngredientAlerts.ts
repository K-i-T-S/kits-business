import { useState, useEffect, useCallback } from 'react';

import { useApp } from '@/context/AppContext';
import type { RestaurantIngredient } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

interface IngredientAlerts {
  criticalItems: RestaurantIngredient[];
  lowItems: RestaurantIngredient[];
  totalAlertCount: number;
  loading: boolean;
  refresh: () => void;
}

/**
 * Returns ingredient stock alert counts for the restaurant nav badge.
 * criticalItems: at or below reorder_level — order immediately
 * lowItems: below par_level but above reorder_level — monitor
 * Refreshes automatically every 5 minutes.
 */
export function useIngredientAlerts(): IngredientAlerts {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [criticalItems, setCriticalItems] = useState<RestaurantIngredient[]>([]);
  const [lowItems, setLowItems] = useState<RestaurantIngredient[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_ingredients')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      const ingredients = (data ?? []) as RestaurantIngredient[];

      const critical = ingredients.filter(
        (i) => i.current_stock <= i.reorder_level,
      );
      const low = ingredients.filter(
        (i) => i.current_stock > i.reorder_level && i.current_stock <= i.par_level,
      );

      setCriticalItems(critical);
      setLowItems(low);
    } catch (err) {
      console.error('[useIngredientAlerts] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void fetchAlerts();
    // Refresh every 5 minutes
    const interval = setInterval(() => { void fetchAlerts(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  return {
    criticalItems,
    lowItems,
    totalAlertCount: criticalItems.length + lowItems.length,
    loading,
    refresh: () => { void fetchAlerts(); },
  };
}
