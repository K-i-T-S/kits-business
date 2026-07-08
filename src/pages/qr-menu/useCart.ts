import { useState, useCallback } from 'react';

import type { QRCartItem, QRCartBundleItem, QRCartBundleSelection, QRMenuBundle, RestaurantMenuItem } from '@/types/restaurant';

interface UseCartResult {
  items: QRCartItem[];
  bundleItems: QRCartBundleItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (item: RestaurantMenuItem, quantity: number, selectedModifiers: Record<string, string[]>, notes: string, modifierPriceDelta: number) => void;
  updateQuantity: (menuItemId: string, modifierKey: string, quantity: number) => void;
  removeItem: (menuItemId: string, modifierKey: string) => void;
  clearCart: () => void;
  addBundleItem: (bundle: QRMenuBundle, partySize: number, courseSelections: QRCartBundleSelection[]) => void;
  removeBundleItem: (cartKey: string) => void;
}

function buildModifierKey(menuItemId: string, selectedModifiers: Record<string, string[]>): string {
  const modStr = Object.entries(selectedModifiers)
    .map(([gId, opts]) => `${gId}:${opts.sort().join(',')}`)
    .sort()
    .join('|');
  return `${menuItemId}__${modStr}`;
}

export function useCart(): UseCartResult {
  const [items, setItems] = useState<QRCartItem[]>([]);
  const [bundleItems, setBundleItems] = useState<QRCartBundleItem[]>([]);

  const addItem = useCallback(
    (
      menuItem: RestaurantMenuItem,
      quantity: number,
      selectedModifiers: Record<string, string[]>,
      notes: string,
      modifierPriceDelta: number,
    ) => {
      const unitPrice = menuItem.base_price_usd + modifierPriceDelta;
      const modifierKey = buildModifierKey(menuItem.id, selectedModifiers);

      setItems((prev) => {
        const existingIdx = prev.findIndex(
          (i) => i.menuItemId === menuItem.id && buildModifierKey(i.menuItemId, i.selectedModifiers) === modifierKey,
        );

        if (existingIdx >= 0) {
          return prev.map((item, idx) =>
            idx === existingIdx
              ? {
                ...item,
                quantity: item.quantity + quantity,
                totalPrice: (item.quantity + quantity) * unitPrice,
              }
              : item,
          );
        }

        const newItem: QRCartItem = {
          menuItemId: menuItem.id,
          menuItem,
          quantity,
          selectedModifiers,
          totalPrice: quantity * unitPrice,
          notes,
        };
        return [...prev, newItem];
      });
    },
    [],
  );

  const updateQuantity = useCallback((menuItemId: string, modifierKey: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter(
          (i) => !(i.menuItemId === menuItemId && buildModifierKey(i.menuItemId, i.selectedModifiers) === modifierKey),
        );
      }
      return prev.map((item) => {
        if (item.menuItemId === menuItemId && buildModifierKey(item.menuItemId, item.selectedModifiers) === modifierKey) {
          const unitPrice = item.totalPrice / item.quantity;
          return { ...item, quantity, totalPrice: quantity * unitPrice };
        }
        return item;
      });
    });
  }, []);

  const removeItem = useCallback((menuItemId: string, modifierKey: string) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.menuItemId === menuItemId && buildModifierKey(i.menuItemId, i.selectedModifiers) === modifierKey),
      ),
    );
  }, []);

  // No dedup-and-merge — a customer adding the same bundle twice (even with
  // identical course selections) gets two independently removable lines.
  // Merging would require picking between two different course_selections,
  // which has no sensible resolution.
  const addBundleItem = useCallback(
    (bundle: QRMenuBundle, partySize: number, courseSelections: QRCartBundleSelection[]) => {
      const newBundleItem: QRCartBundleItem = {
        cartKey: crypto.randomUUID(),
        bundleId: bundle.id,
        bundleName: bundle.name,
        pricePerGuestUsd: bundle.price_per_guest_usd,
        partySize,
        courseSelections,
        totalPrice: bundle.price_per_guest_usd * partySize,
      };
      setBundleItems((prev) => [...prev, newBundleItem]);
    },
    [],
  );

  const removeBundleItem = useCallback((cartKey: string) => {
    setBundleItems((prev) => prev.filter((b) => b.cartKey !== cartKey));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setBundleItems([]);
  }, []);

  // totalItems counts each bundle line as 1 regardless of partySize — the cart
  // badge reads as "N things you're ordering," and "Family Feast for 4" is one
  // decision/one line, not four. totalPrice still fully sums the party-scaled amount.
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0) + bundleItems.length;
  const totalPrice =
    items.reduce((sum, i) => sum + i.totalPrice, 0) + bundleItems.reduce((sum, b) => sum + b.totalPrice, 0);

  return {
    items,
    bundleItems,
    totalItems,
    totalPrice,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    addBundleItem,
    removeBundleItem,
  };
}

export function getModifierKey(menuItemId: string, selectedModifiers: Record<string, string[]>): string {
  const modStr = Object.entries(selectedModifiers)
    .map(([gId, opts]) => `${gId}:${opts.sort().join(',')}`)
    .sort()
    .join('|');
  return `${menuItemId}__${modStr}`;
}
