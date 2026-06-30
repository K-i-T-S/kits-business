import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabaseClient';

export interface MenuEngineeringItem {
  id: string;
  menuItemId: string;
  itemName: string;
  category: 'star' | 'plowhorse' | 'puzzle' | 'dog';
  popularityScore: number;
  marginScore: number;
  recommendedAction: string;
  potentialRevenueImpact: number;
}

export interface MenuEngineeringData {
  items: MenuEngineeringItem[];
  loading: boolean;
  error: string | null;
}

export function useMenuEngineering(tenantId: string | undefined, categoryFilter?: string) {
  const [data, setData] = useState<MenuEngineeringData>({
    items: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!tenantId) {
      setData({ items: [], loading: false, error: 'No tenant selected' });
      return;
    }

    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      // Fetch menu engineering cache joined with menu item names
      let query = supabase
        .from('restaurant_menu_engineering_cache')
        .select(
          `
          id,
          menu_item_id,
          popularity_score,
          margin_score,
          category,
          recommended_action,
          potential_revenue_impact,
          restaurant_menu_items(name)
        `,
        )
        .eq('tenant_id', tenantId)
        .limit(100);

      if (categoryFilter && categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data: rows, error: err } = await query;

      if (err) {
        throw new Error(err.message);
      }

      interface MenuEngRow {
        id: string;
        menu_item_id: string | null;
        popularity_score: string | number | null;
        margin_score: string | number | null;
        category: string;
        recommended_action: string | null;
        potential_revenue_impact: string | number | null;
        restaurant_menu_items: { name: string } | null;
      }

      const items: MenuEngineeringItem[] = ((rows ?? []) as unknown as MenuEngRow[]).map((row) => ({
        id: row.id,
        menuItemId: row.menu_item_id ?? '',
        itemName: row.restaurant_menu_items?.name ?? 'Unknown Item',
        category: row.category as 'star' | 'plowhorse' | 'puzzle' | 'dog',
        popularityScore: parseFloat(String(row.popularity_score ?? 0)),
        marginScore: parseFloat(String(row.margin_score ?? 0)),
        recommendedAction: row.recommended_action ?? '',
        potentialRevenueImpact: parseFloat(String(row.potential_revenue_impact ?? 0)),
      }));

      setData({ items, loading: false, error: null });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load menu engineering data';
      setData({ items: [], loading: false, error: errorMsg });
      console.error('[useMenuEngineering]', err);
    }
  }, [tenantId, categoryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return data;
}
