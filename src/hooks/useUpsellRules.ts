/**
 * _useUpsellRules — Fetch AI upsell suggestions based on current order items
 *
 * Given a list of item IDs currently in the order, fetches association rules
 * (trigger_item_id matches current items, suggested_item_id is the upsell)
 * and returns the top suggestion by confidence.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import type { UpsellRule, RestaurantMenuItem } from '@/types/restaurant';

export interface UpsellSuggestion {
  rule: UpsellRule;
  suggestedItem: RestaurantMenuItem | null;
  confidence: number;
}

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
        // Query upsell rules where trigger_item_id is one of the current order items
        const { data, error } = await supabase
          .from('restaurant_upsell_rules')
          .select('*')
          .eq('tenant_id', tenantId)
          .in('trigger_item_id', currentItemIds)
          .gt('confidence', 0.3)
          .order('confidence', { ascending: false })
          .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
          setSuggestion(null);
          return;
        }

        // Find the first rule where the suggested_item is available and not in current order
        for (const rule of data as UpsellRule[]) {
          if (currentItemIds.includes(rule.suggestedItemId)) {
            // Skip if already in order
            continue;
          }

          const suggestedItem = allMenuItems.find((m) => m.id === rule.suggestedItemId);
          if (suggestedItem && !suggestedItem.is_eighty_sixd) {
            setSuggestion({
              rule: rule as UpsellRule,
              suggestedItem,
              confidence: rule.confidence,
            });
            break;
          }
        }

        if (data.length > 0 && !suggestion) {
          // Fallback: if no non-86'd items, just show top rule info
          setSuggestion({
            rule: data[0] as UpsellRule,
            suggestedItem: allMenuItems.find((m) => m.id === (data[0] as UpsellRule).suggestedItemId) || null,
            confidence: (data[0] as UpsellRule).confidence,
          });
        }
      } catch (err) {
        console.error('[_useUpsellRules] error:', err);
        setSuggestion(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchUpsells();
  }, [tenantId, currentItemIds, allMenuItems, suggestion]);

  return { suggestion, loading };
}
