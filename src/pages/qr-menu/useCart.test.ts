import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCart } from './useCart';
import type { QRMenuBundle, QRCartBundleSelection, RestaurantMenuItem } from '@/types/restaurant';

const bundle: QRMenuBundle = {
  id: 'bundle-1',
  name: 'Family Feast',
  name_ar: null,
  description: null,
  price_per_guest_usd: 18,
  sort_order: 0,
};

const selections: QRCartBundleSelection[] = [
  { bundleCourseId: 'c1', menuItemId: 'mi-2', itemName: 'Fattoush' },
  { bundleCourseId: 'c2', menuItemId: 'mi-3', itemName: 'Grilled Chicken' },
];

const menuItem: RestaurantMenuItem = {
  id: 'mi-1', tenant_id: 't1', category_id: null, name: 'Hummus', name_ar: null,
  description: null, description_ar: null, photo_url: null, base_price_usd: 5,
  base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [],
  is_featured: false, is_chef_pick: false, is_eighty_sixd: false,
  active_breakfast: true, active_lunch: true, active_dinner: true,
  sort_order: 0, is_active: true,
};

describe('useCart — bundle items', () => {
  it('addBundleItem appends a new line with a generated cartKey and correct totalPrice', () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addBundleItem(bundle, 4, selections);
    });
    expect(result.current.bundleItems).toHaveLength(1);
    const line = result.current.bundleItems[0]!;
    expect(line.cartKey).toBeTruthy();
    expect(line.bundleId).toBe('bundle-1');
    expect(line.bundleName).toBe('Family Feast');
    expect(line.pricePerGuestUsd).toBe(18);
    expect(line.partySize).toBe(4);
    expect(line.totalPrice).toBe(72); // 18 * 4
    expect(line.courseSelections).toEqual(selections);
  });

  it('adding the same bundle twice produces two separate lines, not a merged one', () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addBundleItem(bundle, 4, selections);
      result.current.addBundleItem(bundle, 4, selections);
    });
    expect(result.current.bundleItems).toHaveLength(2);
    expect(result.current.bundleItems[0]!.cartKey).not.toBe(result.current.bundleItems[1]!.cartKey);
  });

  it('removeBundleItem removes only the matching line', () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addBundleItem(bundle, 2, selections);
      result.current.addBundleItem(bundle, 6, selections);
    });
    const keyToRemove = result.current.bundleItems[0]!.cartKey;
    act(() => {
      result.current.removeBundleItem(keyToRemove);
    });
    expect(result.current.bundleItems).toHaveLength(1);
    expect(result.current.bundleItems[0]!.partySize).toBe(6);
  });

  it('totalItems counts each bundle line as 1 regardless of partySize; totalPrice sums correctly across items and bundles', () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addItem(menuItem, 3, {}, '', 0); // 3 * $5 = $15
      result.current.addBundleItem(bundle, 4, selections); // $72
      result.current.addBundleItem(bundle, 2, selections); // $36
    });
    expect(result.current.totalItems).toBe(3 + 1 + 1); // 3 regular qty + 2 bundle lines counted as 1 each
    expect(result.current.totalPrice).toBe(15 + 72 + 36);
  });

  it('clearCart empties both items and bundleItems', () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addItem(menuItem, 1, {}, '', 0);
      result.current.addBundleItem(bundle, 4, selections);
    });
    act(() => {
      result.current.clearCart();
    });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.bundleItems).toHaveLength(0);
  });
});
