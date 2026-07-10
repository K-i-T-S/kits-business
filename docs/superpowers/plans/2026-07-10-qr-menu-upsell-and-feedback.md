# QR Menu Experience — Upsell Suggestions + Feedback Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the staff-side upsell banner (currently broken — never renders in production due to a field-name mismatch), extend the same upsell logic to the QR customer cart, and add a self-service "Rate Your Visit" link to the QR menu so customers can reach the existing feedback form without staff involvement.

**Architecture:** A new pure function (`pickUpsellSuggestion`) becomes the single source of truth for "which upsell suggestion to show," used by both the fixed staff-side hook (`useUpsellRules.ts`) and a new QR-side computation in `QRMenuPage.tsx`. The QR path needs its own tenant-scoped data source since anonymous customers can't read `restaurant_upsell_rules` directly (RLS) — `get_public_menu()` is extended to include the rules. Feedback discoverability is a single new link in the QR menu footer pointing at the existing, unchanged `/feedback/:tenantSlug/:tableId` route.

**Tech Stack:** React/TypeScript frontend, PostgreSQL/Supabase (SQL migration, RLS).

## Global Constraints

- TypeScript strict, no `any` — use `unknown` and narrow.
- `SET search_path = 'public'` on the migrated function.
- No pgTAP in this repo for SQL — manual reasoning-based verification, matching every migration this session.
- `pickUpsellSuggestion` is a pure function with no side effects — no Supabase calls, no React state, testable in complete isolation.
- Full design reference: `docs/superpowers/specs/2026-07-10-qr-menu-upsell-and-feedback-design.md`. All code below is copied verbatim from that approved spec — do not re-derive it.

---

### Task 1: Fix `useUpsellRules.ts` + extract shared `pickUpsellSuggestion`

**Files:**
- Create: `src/utils/upsellSuggestion.ts`
- Create: `src/utils/upsellSuggestion.test.ts`
- Modify: `src/hooks/useUpsellRules.ts`

**Interfaces:**
- Produces: `pickUpsellSuggestion(rules: UpsellRule[], currentItemIds: string[], allMenuItems: RestaurantMenuItem[]): UpsellSuggestion | null` — consumed by Task 3's QR-side computation. Also produces the fixed `useUpsellRules` hook behavior (no interface change to the hook itself — same `(tenantId, currentItemIds, allMenuItems) => { suggestion, loading }` signature `WaiterInterface.tsx` already calls).
- Consumes: nothing from other tasks — self-contained.

- [ ] **Step 1: Write the failing test for `pickUpsellSuggestion`**

Create `src/utils/upsellSuggestion.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/upsellSuggestion.test.ts`
Expected: FAIL — module `./upsellSuggestion` doesn't exist yet.

- [ ] **Step 3: Implement `pickUpsellSuggestion`**

Create `src/utils/upsellSuggestion.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/upsellSuggestion.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Fix and refactor `useUpsellRules.ts`**

Read `src/hooks/useUpsellRules.ts` in full first. Replace its contents with:

```ts
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawRows = (data ?? []) as any[];
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
```

Note the dependency array no longer includes `suggestion` (the old code's self-referential bug — an effect depending on the state it sets) — this is a correct fix, not a scope violation: `currentItemIds`/`allMenuItems` are the only real triggers for re-fetching.

The `// eslint-disable-next-line @typescript-eslint/no-explicit-any` on `rawRows` is necessary because `supabase.from(...).select('*')` returns an untyped row shape — mapping it into the typed `UpsellRule[]` immediately afterward is exactly what the `any` is scoped to, matching this codebase's established pattern of narrowly-scoped disables at exactly the point an untyped Supabase response gets cast (e.g. `RecipeInventory.tsx`'s existing `no-unsafe-assignment` disables at its own `supabase.rpc(...)` call sites).

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Full suite regression check**

Run: `npx vitest run`
Expected: no regressions from before this task (baseline: 304 passed, 4 skipped) plus the 5 new `upsellSuggestion.test.ts` tests passing.

- [ ] **Step 8: Commit**

```bash
git add src/utils/upsellSuggestion.ts src/utils/upsellSuggestion.test.ts src/hooks/useUpsellRules.ts
git commit -m "fix: staff-side AI upsell banner never rendered due to a field-name bug

useUpsellRules.ts fetched raw snake_case Supabase rows (suggested_item_id)
but cast them directly to the camelCase UpsellRule interface
(suggestedItemId) with no mapping — every lookup resolved to undefined,
so WaiterInterface.tsx's upsell banner has never once rendered in
production despite having a complete UI and a working backend. Extracts
the selection logic into a standalone, unit-tested pickUpsellSuggestion
so both this hook and the upcoming QR customer cart share one
implementation instead of two."
```

---

### Task 2: Extend `get_public_menu()` with `upsell_rules`

**Files:**
- Create: `supabase/migrations/20260710_000067_qr_menu_upsell_rules.sql`
- Modify: `src/types/restaurant.ts` (add `upsell_rules` to `QRMenuData`)
- Modify: `CLAUDE.md` (append new migration list entry)

**Interfaces:**
- Produces: `get_public_menu(p_tenant_slug TEXT)`'s JSONB response gains one new key, `upsell_rules: Array<{ id, trigger_item_id, suggested_item_id, confidence }>` — consumed by Task 3's `QRMenuPage.tsx` mapping.

- [ ] **Step 1: Find the current `get_public_menu()` definition**

Read `supabase/migrations/20260708_000062_preset_order_bundles.sql` (the most recent `CREATE OR REPLACE FUNCTION get_public_menu` — confirm no later migration has redefined it again since; if one has, use that one as the base instead) to get the exact current full function body to copy forward unchanged except for the one addition below.

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/20260710_000067_qr_menu_upsell_rules.sql`. Reproduce the ENTIRE current `get_public_menu` function body found in Step 1 verbatim, with exactly one addition: a new `'upsell_rules'` key added to the `jsonb_build_object(...)` call (add it as the last key, after `'bundle_course_items'`, matching that key's existing comma placement):

```sql
-- ============================================================
-- Migration: QR Menu Upsell Rules
--
-- Extends get_public_menu() with the tenant's upsell association rules,
-- so the QR customer cart can show the same "frequently ordered together"
-- suggestions the (now-fixed) staff-side banner shows, without needing a
-- separate RPC round-trip per cart change. Required because
-- restaurant_upsell_rules has RLS scoped to current_tenant_id(), which an
-- anonymous QR customer never has — a direct client query would silently
-- return zero rows.
--
-- Full design: docs/superpowers/specs/2026-07-10-qr-menu-upsell-and-feedback-design.md
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_menu(p_tenant_slug TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_tenant_slug;
  IF v_tenant_id IS NULL THEN RETURN '{"error":"not_found"}'::JSONB; END IF;
  SELECT jsonb_build_object(
    'tenant', (SELECT jsonb_build_object('id', id, 'name', name, 'brand_logo_url', brand_logo_url, 'brand_primary', brand_primary, 'qr_menu_palette', COALESCE(qr_menu_palette,'dark-luxury'), 'qr_menu_promotional_banner', qr_menu_promotional_banner) FROM tenants WHERE id = v_tenant_id),
    'categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'name_ar', c.name_ar, 'icon', c.icon, 'sort_order', c.sort_order, 'active_allday', c.active_allday) ORDER BY c.sort_order) FROM restaurant_menu_categories c WHERE c.tenant_id = v_tenant_id), '[]'::jsonb),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'category_id', i.category_id, 'name', i.name, 'name_ar', i.name_ar, 'description', i.description, 'description_ar', i.description_ar, 'photo_url', i.photo_url, 'base_price_usd', i.base_price_usd, 'base_price_lbp', i.base_price_lbp, 'calories', i.calories, 'allergens', i.allergens, 'is_featured', i.is_featured, 'is_chef_pick', i.is_chef_pick, 'is_eighty_sixd', i.is_eighty_sixd, 'sort_order', i.sort_order) ORDER BY i.sort_order) FROM restaurant_menu_items i WHERE i.tenant_id = v_tenant_id AND i.is_active = true), '[]'::jsonb),
    'modifier_groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', mg.id, 'name', mg.name, 'name_ar', mg.name_ar, 'min_selections', mg.min_selections, 'max_selections', mg.max_selections, 'is_required', mg.is_required)) FROM restaurant_modifier_groups mg WHERE mg.tenant_id = v_tenant_id), '[]'::jsonb),
    'modifiers', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'group_id', m.group_id, 'name', m.name, 'name_ar', m.name_ar, 'price_delta', m.price_delta, 'sort_order', m.sort_order) ORDER BY m.sort_order) FROM restaurant_modifiers m WHERE m.tenant_id = v_tenant_id), '[]'::jsonb),
    'item_modifier_links', COALESCE((SELECT jsonb_agg(jsonb_build_object('menu_item_id', mim.menu_item_id, 'modifier_group_id', mim.modifier_group_id)) FROM restaurant_menu_item_modifiers mim JOIN restaurant_menu_items i ON i.id = mim.menu_item_id WHERE i.tenant_id = v_tenant_id), '[]'::jsonb),
    'bundles', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'name_ar', b.name_ar, 'description', b.description,
        'price_per_guest_usd', b.price_per_guest_usd, 'sort_order', b.sort_order
      ) ORDER BY b.sort_order) FROM restaurant_bundles b WHERE b.tenant_id = v_tenant_id AND b.is_active = true), '[]'::jsonb),
    'bundle_courses', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', bc.id, 'bundle_id', bc.bundle_id, 'course', bc.course, 'label', bc.label, 'sort_order', bc.sort_order
      ) ORDER BY bc.sort_order) FROM restaurant_bundle_courses bc
      JOIN restaurant_bundles b ON b.id = bc.bundle_id
      WHERE b.tenant_id = v_tenant_id AND b.is_active = true), '[]'::jsonb),
    'bundle_course_items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'bundle_course_id', bci.bundle_course_id, 'menu_item_id', bci.menu_item_id
      )) FROM restaurant_bundle_course_items bci
      JOIN restaurant_bundle_courses bc ON bc.id = bci.bundle_course_id
      JOIN restaurant_bundles b ON b.id = bc.bundle_id
      WHERE b.tenant_id = v_tenant_id AND b.is_active = true), '[]'::jsonb),
    'upsell_rules', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'trigger_item_id', r.trigger_item_id,
        'suggested_item_id', r.suggested_item_id, 'confidence', r.confidence
      )) FROM restaurant_upsell_rules r
      WHERE r.tenant_id = v_tenant_id AND r.confidence > 0.3), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
```

(If Step 1 found the real current body has ANY difference from what's reproduced above — e.g. an additional key added by a migration after `000062` that this plan wasn't aware of — preserve that difference; only ADD the `upsell_rules` key, do not silently drop anything else the live function currently returns.)

- [ ] **Step 2: Manual verification pass**

Confirm: the new key's `confidence > 0.3` threshold matches `useUpsellRules.ts`'s `.gt('confidence', 0.3)` exactly (same operator, same value) — Task 1's hook and this RPC must apply an identical filter so staff and QR customers see consistent suggestions from the same underlying rule set. Confirm `SET search_path = public` is unchanged from the original. Confirm the function is still `SECURITY DEFINER` (unchanged).

- [ ] **Step 3: Update `QRMenuData` type**

In `src/types/restaurant.ts`, find the `QRMenuData` interface (currently ~line 359) and add one field:

```ts
export interface QRMenuData {
  tenant: QRMenuTenant;
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  modifier_groups: RestaurantModifierGroup[];
  modifiers: RestaurantModifier[];
  item_modifier_links: Array<{ menu_item_id: string; modifier_group_id: string }>;
  bundles: QRMenuBundle[];
  bundle_courses: QRMenuBundleCourse[];
  bundle_course_items: RestaurantBundleCourseItem[];
  upsell_rules: Array<{ id: string; trigger_item_id: string; suggested_item_id: string; confidence: number }>;
}
```

- [ ] **Step 4: Update `CLAUDE.md`'s migration list**

Add a new entry immediately after the current final entry:

```
`20260710_000067_qr_menu_upsell_rules.sql` — extends `get_public_menu()` with an `upsell_rules` array (tenant-scoped, `confidence > 0.3`) so the QR customer cart can show the same "frequently ordered together" suggestions as the (separately fixed) staff-side banner, without a new RPC — required because `restaurant_upsell_rules`' RLS has no anonymous-readable path.
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors (the `QRMenuData` type change is additive; nothing currently destructures `upsell_rules` yet, so no existing code should break).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260710_000067_qr_menu_upsell_rules.sql src/types/restaurant.ts CLAUDE.md
git commit -m "feat(restaurant): expose upsell rules through the public QR menu RPC

Anonymous QR customers can't read restaurant_upsell_rules directly (RLS
is tenant-scoped via current_tenant_id(), which anon never has) — adds
the rules to get_public_menu()'s existing payload instead, matching
this codebase's established anon-access pattern."
```

---

### Task 3: QR cart upsell banner

**Files:**
- Modify: `src/pages/qr-menu/QRCart.tsx`
- Modify: `src/pages/qr-menu/QRCart.test.tsx`
- Modify: `src/pages/qr-menu/QRMenuPage.tsx`

**Interfaces:**
- Consumes: `pickUpsellSuggestion` from Task 1, `QRMenuData.upsell_rules` from Task 2.
- Produces: `QRCartProps` gains `suggestion: UpsellSuggestion | null` and `onAddSuggestion: (item: RestaurantMenuItem) => void` (no consumers outside this task).

- [ ] **Step 1: Read current files**

Read `src/pages/qr-menu/QRCart.tsx`, `src/pages/qr-menu/QRCart.test.tsx`, and `src/pages/qr-menu/QRMenuPage.tsx` in full to confirm current exact content before editing.

- [ ] **Step 2: Update `QRCartProps` and render the banner**

In `QRCart.tsx`, add to the `QRCartProps` interface:

```ts
interface QRCartProps {
  items: QRCartItem[];
  bundleItems: QRCartBundleItem[];
  tableId: string;
  tableDisplayLabel?: string;
  totalPrice: number;
  suggestion: UpsellSuggestion | null;
  onUpdateQuantity: (menuItemId: string, modifierKey: string, quantity: number) => void;
  onRemoveItem: (menuItemId: string, modifierKey: string) => void;
  onRemoveBundleItem: (cartKey: string) => void;
  onAddSuggestion: (item: RestaurantMenuItem) => void;
  onClose: () => void;
  onSuccess: (orderNumber: string, mode: 'direct' | 'pending') => void;
}
```

Add the import: `import type { UpsellSuggestion } from '@/utils/upsellSuggestion';` and add `RestaurantMenuItem` to the existing `import type { QRCartBundleItem, QRCartItem } from '@/types/restaurant';` line.

Destructure `suggestion` and `onAddSuggestion` in the component's function signature alongside the other props. Render the banner near the top of the cart's item list (above the line items, inside whatever container element already wraps them — read the file to find the exact right spot):

```tsx
{suggestion && (
  <div
    className="mb-4 rounded-2xl p-3"
    style={{ background: 'rgba(var(--qr-accent-rgb), 0.12)', border: '1px solid var(--qr-accent)' }}
  >
    <div className="flex items-start gap-2">
      <span className="text-base">💡</span>
      <div className="flex-1">
        <p className="text-xs font-semibold" style={{ color: 'var(--qr-accent)' }}>
          Frequently ordered together: {suggestion.suggestedItem.name}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--qr-text-muted)' }}>
          ${suggestion.suggestedItem.base_price_usd.toFixed(2)}
        </p>
      </div>
      <button
        onClick={() => onAddSuggestion(suggestion.suggestedItem)}
        className="flex-none rounded-lg px-2.5 py-1.5 text-[10px] font-bold"
        style={{ background: 'var(--qr-accent)', color: 'var(--qr-bg)' }}
      >
        Add
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Wire `QRMenuPage.tsx`**

Read the file to find: the `data`/`items` (cart items from `useCart()`)/`addItem` bindings, and the `<QRCart ... />` render site (currently ~line 314-327).

Add, near where other cart-derived values are computed (e.g. `totalItems`/`totalPrice`):

```ts
const currentCartItemIds = items.map((i) => i.menuItemId);
const mappedUpsellRules: UpsellRule[] = data.upsell_rules.map((r) => ({
  id: r.id,
  tenantId: data.tenant.id,
  triggerItemId: r.trigger_item_id,
  suggestedItemId: r.suggested_item_id,
  confidence: r.confidence,
  supportCount: 0,
  createdAt: '',
}));
const upsellSuggestion = pickUpsellSuggestion(mappedUpsellRules, currentCartItemIds, data.items);
```

Add imports: `import { pickUpsellSuggestion } from '@/utils/upsellSuggestion';` and add `UpsellRule` to whatever existing `@/types/restaurant` type import already exists in this file.

Note: this computation only needs to run when `view === 'cart'` is actually rendered (the `<QRCart>` render site is already gated by that condition) — computing it unconditionally on every render is fine here since it's a cheap array scan (tenant ingredient/menu counts are small), matching this file's existing style of computing derived values inline rather than memoizing everything.

Pass the two new props at the `<QRCart ... />` render site:

```tsx
<QRCart
  key="cart"
  items={items}
  bundleItems={bundleItems}
  tableId={effectiveTableId}
  tableDisplayLabel={tableParam ?? undefined}
  totalPrice={totalPrice}
  suggestion={upsellSuggestion}
  onUpdateQuantity={(menuItemId, modKey, qty) => updateQuantity(menuItemId, modKey, qty)}
  onRemoveItem={(menuItemId, modKey) => removeItem(menuItemId, modKey)}
  onRemoveBundleItem={(cartKey) => removeBundleItem(cartKey)}
  onAddSuggestion={(item) => addItem(item, 1, {}, '', 0)}
  onClose={() => setView('menu')}
  onSuccess={handleOrderSuccess}
/>
```

- [ ] **Step 4: Update `QRCart.test.tsx`**

Read the whole file first — there are 8 existing `<QRCart ... />` render call sites. Add `suggestion={null}` and `onAddSuggestion={vi.fn()}` to every one of them (existing tests don't exercise the upsell banner, so `null`/a no-op keeps their behavior unchanged).

Add new test cases (mirroring this file's existing style — inline props per test, no shared `baseProps` object, per what Step 1's read revealed):

```tsx
const suggestionFixture = {
  rule: { id: 'rule-1', tenantId: 't1', triggerItemId: 'mi-1', suggestedItemId: 'mi-2', confidence: 0.7, supportCount: 5, createdAt: '2026-01-01T00:00:00Z' },
  suggestedItem: { id: 'mi-2', name: 'Fries', name_ar: null, base_price_usd: 3, tenant_id: 't1', category_id: null, description: null, description_ar: null, photo_url: null, base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [], is_featured: false, is_chef_pick: false, is_eighty_sixd: false, active_breakfast: true, active_lunch: true, active_dinner: true, sort_order: 0, is_active: true },
  confidence: 0.7,
};

it('renders the upsell banner when a suggestion is present', () => {
  render(
    <QRCart
      items={[cartItem]}
      bundleItems={[]}
      tableId="tbl-1"
      totalPrice={10}
      suggestion={suggestionFixture}
      onUpdateQuantity={vi.fn()}
      onRemoveItem={vi.fn()}
      onRemoveBundleItem={vi.fn()}
      onAddSuggestion={vi.fn()}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );
  expect(screen.getByText(/Frequently ordered together: Fries/i)).toBeInTheDocument();
});

it('does not render the upsell banner when suggestion is null', () => {
  render(
    <QRCart
      items={[cartItem]}
      bundleItems={[]}
      tableId="tbl-1"
      totalPrice={10}
      suggestion={null}
      onUpdateQuantity={vi.fn()}
      onRemoveItem={vi.fn()}
      onRemoveBundleItem={vi.fn()}
      onAddSuggestion={vi.fn()}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );
  expect(screen.queryByText(/Frequently ordered together/i)).not.toBeInTheDocument();
});

it('calls onAddSuggestion with the suggested item when Add is tapped', () => {
  const onAddSuggestion = vi.fn();
  render(
    <QRCart
      items={[cartItem]}
      bundleItems={[]}
      tableId="tbl-1"
      totalPrice={10}
      suggestion={suggestionFixture}
      onUpdateQuantity={vi.fn()}
      onRemoveItem={vi.fn()}
      onRemoveBundleItem={vi.fn()}
      onAddSuggestion={onAddSuggestion}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
  expect(onAddSuggestion).toHaveBeenCalledWith(suggestionFixture.suggestedItem);
});
```

Confirmed no other control in `QRCart.tsx` is labeled "Add" (existing controls use `aria-label` values like "Close cart", "Decrease", "Increase", "Remove {name}") — the anchored `/^add$/i` matcher above is unambiguous as written, no scoping needed.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/pages/qr-menu/QRCart.test.tsx`
Expected: all existing tests still pass (props added, behavior unchanged) plus the 3 new tests pass (11/11 total, assuming the original file had 8).

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Full suite regression check**

Run: `npx vitest run`
Expected: no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/pages/qr-menu/QRCart.tsx src/pages/qr-menu/QRCart.test.tsx src/pages/qr-menu/QRMenuPage.tsx
git commit -m "feat(qr-menu): show upsell suggestions in the customer cart

Reuses pickUpsellSuggestion (shared with the now-fixed staff-side
banner) against the upsell_rules already included in get_public_menu()'s
payload — no extra RPC round-trip per cart change. Adding a suggested
item calls the same addItem the rest of the cart already uses."
```

---

### Task 4: Feedback discoverability link

**Files:**
- Modify: `src/pages/qr-menu/QRMenuHome.tsx`
- Modify: `src/pages/qr-menu/QRMenuPage.tsx`

**Interfaces:**
- Produces: `QRMenuHomeProps` gains one new optional prop, `feedbackHref?: string`.
- Consumes: nothing from Tasks 1-3 — independent of the upsell work.

- [ ] **Step 1: Read current files**

Read `src/pages/qr-menu/QRMenuHome.tsx` and `src/pages/qr-menu/QRMenuPage.tsx` in full to confirm the exact current footer markup (currently ~line 507-511 in `QRMenuHome.tsx`) and the `<QRMenuHome ... />` render site in `QRMenuPage.tsx` (currently ~line 240-254).

- [ ] **Step 2: Add `feedbackHref` prop and render the link**

In `QRMenuHome.tsx`, add to its props interface: `feedbackHref?: string;` (add near the other optional props like `tableDisplayLabel?`). Destructure it in the function signature.

Replace the existing footer:

```tsx
{/* KiTS fingerprint */}
<footer className="qr-kits-fingerprint mt-8">
  <span>Digital menu by</span>
  <span style={{ fontWeight: 700, letterSpacing: '0.1em' }}>KiTS</span>
</footer>
```

with:

```tsx
{/* KiTS fingerprint */}
<footer className="qr-kits-fingerprint mt-8 flex flex-col items-center gap-2">
  {feedbackHref && (
    <a href={feedbackHref} className="text-xs underline" style={{ color: 'var(--qr-text-muted)' }}>
      Rate Your Visit ⭐
    </a>
  )}
  <div>
    <span>Digital menu by</span>
    <span style={{ fontWeight: 700, letterSpacing: '0.1em' }}>KiTS</span>
  </div>
</footer>
```

- [ ] **Step 3: Compute and pass `feedbackHref` in `QRMenuPage.tsx`**

Add, near where `tableParam`/`tenantSlug` are already available:

```ts
const feedbackHref = tableParam ? `/feedback/${tenantSlug}/${tableParam}` : `/feedback/${tenantSlug}`;
```

Pass it at the `<QRMenuHome ... />` render site:

```tsx
<QRMenuHome
  menuData={data}
  lang={lang}
  tableId={effectiveTableId}
  tableDisplayLabel={tableParam ?? undefined}
  totalCartItems={totalItems}
  onSelectItem={handleSelectItem}
  onSelectBundle={handleSelectBundle}
  onOpenCart={() => setView('cart')}
  onCallWaiter={handleCallWaiter}
  onFa7em={handleFa7em}
  promotionalBanner={data.tenant.qr_menu_promotional_banner ?? 'While you wait — try our freshly made desserts 🍮'}
  showBanner={showBanner}
  onBannerTap={handleBannerTap}
  feedbackHref={feedbackHref}
/>
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Full suite regression check**

Run: `npx vitest run`
Expected: no regressions. If `QRMenuHome.tsx` has no existing test file, no new test is required (this is a small, optional-prop UI addition with no branching logic beyond "render the link if the href is truthy" — disproportionate to add a new test file for). If a test file already exists and renders `QRMenuHome`, confirm it still passes with the new optional prop omitted (should be unaffected, since it's optional and conditionally rendered).

- [ ] **Step 6: Commit**

```bash
git add src/pages/qr-menu/QRMenuHome.tsx src/pages/qr-menu/QRMenuPage.tsx
git commit -m "feat(qr-menu): add self-service feedback link to the QR menu footer

Customers can now reach the existing /feedback/:tenantSlug/:tableId
form directly from the menu they already have open, instead of relying
on staff to manually share the link."
```
