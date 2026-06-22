import { useCallback } from 'react';

import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';

/**
 * Auto-deducts recipe ingredients when a KDS item is bumped as 'ready' or 'served'.
 *
 * INTEGRATION POINT — KitchenDisplay.tsx:
 * Call `deductForMenuItem` inside `handleBumpItem` after updating item status to 'ready'.
 * The menu_item_id here is the product's ID in the restaurant_menu_item_recipes table.
 *
 * Example:
 *   const { deductForMenuItem } = useRecipeDeduction();
 *   // In handleBumpItem, after the supabase update succeeds:
 *   await deductForMenuItem(menuItemId, quantity);
 *
 * If no recipe is mapped for the menu item, the RPC returns immediately with no effect.
 * All errors are silently caught — ingredient deduction should never block the KDS workflow.
 */
export function useRecipeDeduction() {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const deductForMenuItem = useCallback(
    async (menuItemId: string, quantity: number = 1): Promise<void> => {
      if (!tenantId) return;
      try {
        const { error } = await supabase.rpc('deduct_recipe_ingredients', {
          p_tenant_id: tenantId,
          p_menu_item_id: menuItemId,
          p_quantity: quantity,
        });
        if (error) {
          // Log but do not throw — ingredient deduction is non-critical
          console.warn('[useRecipeDeduction] deduction warning:', error.message);
        }
      } catch (err) {
        console.warn('[useRecipeDeduction] unexpected error:', err);
      }
    },
    [tenantId],
  );

  return { deductForMenuItem };
}
