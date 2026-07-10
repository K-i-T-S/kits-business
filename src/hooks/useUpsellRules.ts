/**
 * useUpsellRules — Fetch AI upsell suggestions based on current order items
 *
 * Given a list of item IDs currently in the order, fetches association rules
 * (trigger_item_id matches current items, suggested_item_id is the upsell)
 * and returns the top suggestion by confidence.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import type { UpsellRule, RestaurantMenuItem } from '@/types/restaurant';
import { pickUpsellSuggestion, type UpsellSuggestion } from '@/utils/upsellSuggestion';

export type { UpsellSuggestion };

export function useUpsellRules(
  tenantId: string | null | undefined,
  currentItemIds: string[],
  allMenuItems: RestaurantMenuItem[],
) {
  const [suggestion, setSuggestion] = useState<UpsellSuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId || currentItemIds.length === 0) {
      setSuggestion(null);
      return;
    }

    const fetchUpsells = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('restaurant_upsell_rules')
          .select('*')
          .eq('tenant_id', tenantId)
          .in('trigger_item_id', currentItemIds)
          .gt('confidence', 0.3)
          .order('confidence', { ascending: false })
          .limit(10);

        if (error) throw error;

        const rawRows = (data ?? []) as unknown as Record<string, unknown>[];
        const rules: UpsellRule[] = rawRows.map((r) => ({
          id: r.id as string,
          tenantId: r.tenant_id as string,
          triggerItemId: r.trigger_item_id as string,
          suggestedItemId: r.suggested_item_id as string,
          confidence: r.confidence as number,
          supportCount: r.support_count as number,
          createdAt: r.created_at as string,
        }));

        setSuggestion(pickUpsellSuggestion(rules, currentItemIds, allMenuItems));
      } catch (err) {
        console.error('[useUpsellRules] error:', err);
        setSuggestion(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchUpsells();
  }, [tenantId, currentItemIds, allMenuItems]);

  return { suggestion, loading };
}
