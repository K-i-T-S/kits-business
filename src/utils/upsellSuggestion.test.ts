import { describe, expect, it } from 'vitest';
import { pickUpsellSuggestion } from './upsellSuggestion';
import type { UpsellRule, RestaurantMenuItem } from '@/types/restaurant';

function makeRule(overrides: Partial<UpsellRule>): UpsellRule {
  return {
    id: 'rule-1', tenantId: 't1', triggerItemId: 'burger', suggestedItemId: 'fries',
    confidence: 0.5, supportCount: 10, createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<RestaurantMenuItem>): RestaurantMenuItem {
  return {
    id: 'fries', tenant_id: 't1', category_id: null, name: 'Fries', name_ar: null,
    description: null, description_ar: null, photo_url: null, base_price_usd: 3,
    base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [],
    is_featured: false, is_chef_pick: false, is_eighty_sixd: false,
    active_breakfast: true, active_lunch: true, active_dinner: true,
    sort_order: 0, is_active: true,
    ...overrides,
  };
}

describe('pickUpsellSuggestion', () => {
  it('picks the highest-confidence rule whose trigger is in the current items', () => {
    const rules = [
      makeRule({ id: 'r1', triggerItemId: 'burger', suggestedItemId: 'fries', confidence: 0.4 }),
      makeRule({ id: 'r2', triggerItemId: 'burger', suggestedItemId: 'drink', confidence: 0.8 }),
    ];
    const items = [makeItem({ id: 'fries' }), makeItem({ id: 'drink', name: 'Drink' })];
    const result = pickUpsellSuggestion(rules, ['burger'], items);
    expect(result?.suggestedItem.id).toBe('drink');
    expect(result?.confidence).toBe(0.8);
  });

  it('skips a rule whose suggested item is already in the current items', () => {
    const rules = [
      makeRule({ id: 'r1', triggerItemId: 'burger', suggestedItemId: 'fries', confidence: 0.9 }),
      makeRule({ id: 'r2', triggerItemId: 'burger', suggestedItemId: 'drink', confidence: 0.5 }),
    ];
    const items = [makeItem({ id: 'fries' }), makeItem({ id: 'drink', name: 'Drink' })];
    // 'fries' is already in the cart (currentItemIds includes it) — must be skipped
    const result = pickUpsellSuggestion(rules, ['burger', 'fries'], items);
    expect(result?.suggestedItem.id).toBe('drink');
  });

  it('skips a rule whose suggested item is 86\'d', () => {
    const rules = [
      makeRule({ id: 'r1', triggerItemId: 'burger', suggestedItemId: 'fries', confidence: 0.9 }),
      makeRule({ id: 'r2', triggerItemId: 'burger', suggestedItemId: 'drink', confidence: 0.5 }),
    ];
    const items = [makeItem({ id: 'fries', is_eighty_sixd: true }), makeItem({ id: 'drink', name: 'Drink' })];
    const result = pickUpsellSuggestion(rules, ['burger'], items);
    expect(result?.suggestedItem.id).toBe('drink');
  });

  it('returns null when no rule\'s trigger matches any current item', () => {
    const rules = [makeRule({ triggerItemId: 'pizza' })];
    const result = pickUpsellSuggestion(rules, ['burger'], [makeItem({})]);
    expect(result).toBeNull();
  });

  it('returns null when rules is empty', () => {
    expect(pickUpsellSuggestion([], ['burger'], [makeItem({})])).toBeNull();
  });
});
