import type { UpsellRule, RestaurantMenuItem } from '@/types/restaurant';

export interface UpsellSuggestion {
  rule: UpsellRule;
  suggestedItem: RestaurantMenuItem;
  confidence: number;
}

/**
 * Given the tenant's upsell rules, the items currently in an order/cart, and
 * the full menu catalog, picks the single best upsell suggestion: highest
 * confidence, not already in the current selection, not 86'd.
 */
export function pickUpsellSuggestion(
  rules: UpsellRule[],
  currentItemIds: string[],
  allMenuItems: RestaurantMenuItem[],
): UpsellSuggestion | null {
  const sorted = [...rules]
    .filter((r) => currentItemIds.includes(r.triggerItemId))
    .sort((a, b) => b.confidence - a.confidence);

  for (const rule of sorted) {
    if (currentItemIds.includes(rule.suggestedItemId)) continue;
    const suggestedItem = allMenuItems.find((m) => m.id === rule.suggestedItemId);
    if (suggestedItem && !suggestedItem.is_eighty_sixd) {
      return { rule, suggestedItem, confidence: rule.confidence };
    }
  }
  return null;
}
