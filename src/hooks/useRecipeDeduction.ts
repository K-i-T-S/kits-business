import { useCallback } from 'react';
import { toast } from 'sonner';

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
 *   await deductForMenuItem(menuItemId, quantity, item.product_name);
 *
 * If no recipe is mapped for the menu item, the RPC returns immediately with no
 * effect — that's intended (recipe costing is optional per menu item), not a
 * failure, so it does not surface anything.
 *
 * A genuine RPC/network failure never blocks the KDS workflow (the caller
 * already marked the item 'ready' before this runs), but it IS surfaced via a
 * toast so stock drift is visible instead of only reaching the browser
 * console — previously this warned to console.warn only, invisible in
 * production (Tier 0.3, docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
 */
export function useRecipeDeduction() {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const deductForMenuItem = useCallback(
    async (menuItemId: string, quantity: number = 1, itemName?: string): Promise<void> => {
      if (!tenantId) return;
      try {
        const { error } = await supabase.rpc('deduct_recipe_ingredients', {
          p_tenant_id: tenantId,
          p_menu_item_id: menuItemId,
          p_quantity: quantity,
        });
        if (error) {
          console.error('[useRecipeDeduction] deduction failed:', error.message);
          toast.warning(
            `Inventory update failed for ${itemName ?? 'this item'} — check stock manually`,
            { duration: 6000 },
          );
        }
      } catch (err) {
        console.error('[useRecipeDeduction] unexpected error:', err);
        toast.warning(
          `Inventory update failed for ${itemName ?? 'this item'} — check stock manually`,
          { duration: 6000 },
        );
      }
    },
    [tenantId],
  );

  return { deductForMenuItem };
}
