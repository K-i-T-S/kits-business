import { useState, useCallback } from 'react';

import type { QRCartItem, RestaurantMenuItem } from '@/types/restaurant';

interface UseCartResult {
  items: QRCartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (item: RestaurantMenuItem, quantity: number, selectedModifiers: Record<string, string[]>, notes: string, modifierPriceDelta: number) => void;
  updateQuantity: (menuItemId: string, modifierKey: string, quantity: number) => void;
  removeItem: (menuItemId: string, modifierKey: string) => void;
  clearCart: () => void;
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

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.totalPrice, 0);

  return { items, totalItems, totalPrice, addItem, updateQuantity, removeItem, clearCart };
}

export function getModifierKey(menuItemId: string, selectedModifiers: Record<string, string[]>): string {
  const modStr = Object.entries(selectedModifiers)
    .map(([gId, opts]) => `${gId}:${opts.sort().join(',')}`)
    .sort()
    .join('|');
  return `${menuItemId}__${modStr}`;
}
