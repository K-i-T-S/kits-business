# QR Menu Experience — Upsell Suggestions + Feedback Discoverability

**Date:** 2026-07-10
**Status:** Approved for planning

## Problem

This closes out Tier 3 items #3 (AI smart cart / upsell prediction) and #6 (digital post-payment feedback kiosk) from the F&B competitive gap analysis, scoped down to what's genuinely valuable and low-risk to ship today.

**Upsell is currently broken, not just customer-facing-only.** While investigating how to extend it to the QR customer flow, tracing `useUpsellRules.ts` surfaced a live bug: it fetches raw rows from `restaurant_upsell_rules` (columns `trigger_item_id`, `suggested_item_id` — snake_case) but casts them directly `as UpsellRule[]` (a camelCase interface: `triggerItemId`, `suggestedItemId`) with no field mapping. Every access to `rule.suggestedItemId` reads `undefined`, so `suggestedItem` never resolves and the staff-side "AI Upsell Banner" in `WaiterInterface.tsx` — despite having a complete UI, a real backend, and a working nightly-compute pipeline — has never once rendered in production.

**Feedback has no customer-facing discovery path.** `TableFeedback.tsx` is a complete, working rating/comment form at `/feedback/:tenantSlug/:tableId`, but the only way a customer reaches it today is a staff member manually generating and sharing the link from `TableManagement.tsx`'s "Copy feedback link" action. Nothing in the QR menu itself — which the customer already has open on their phone for the entire visit — points to it.

## Goals

- Fix the broken staff-side upsell banner (real bug, unrelated to whether QR gets the feature).
- Extend upsell suggestions to the QR customer cart, reusing the same rules/data the staff side uses, with no logic duplicated between the two.
- Give QR customers a self-service way to reach the feedback form without staff involvement.

## Non-goals

- **Auto-detecting bill closure to auto-transition the QR page to feedback.** Considered and explicitly rejected for this pass: it would require either a new RLS policy exposing `table_orders` status to anonymous clients, or a polling RPC plus a live-view state machine change — meaningfully more risk and complexity than the rest of today's work, for a mostly-cosmetic payoff. The self-service link (see Design, part D) delivers the actual gap (discoverability) without it.
- Upsell suggestions triggered by items inside a bundle selection — scoped to regular cart items only, matching the conservative cut already agreed. Bundle-triggered upsell can be a fast follow.
- Any change to `TableFeedback.tsx` itself — it already works; this only makes it reachable from the QR menu.

## Design

### A. Fix `useUpsellRules.ts`

Map the raw Supabase response into the camelCase `UpsellRule` shape explicitly instead of blindly casting:

```ts
const rules: UpsellRule[] = (data ?? []).map((r) => ({
  id: r.id as string,
  tenantId: r.tenant_id as string,
  triggerItemId: r.trigger_item_id as string,
  suggestedItemId: r.suggested_item_id as string,
  confidence: r.confidence as number,
  supportCount: r.support_count as number,
  createdAt: r.created_at as string,
}));
```

### B. Extract shared selection logic: `pickUpsellSuggestion`

New file `src/utils/upsellSuggestion.ts`:

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

`useUpsellRules.ts` keeps its existing live-query responsibility (fetch + map, per part A) but delegates the "which one to show" decision to this function, replacing its current inline loop. This removes the pre-existing stale-closure risk in the hook's fallback branch (the old code checked the React state `suggestion` from within its own updater, a needless self-reference) as a side effect of the refactor — not a separately scoped fix, just what naturally falls out of deleting the duplicated logic.

### C. Extend `get_public_menu()` with `upsell_rules`

New migration, `CREATE OR REPLACE FUNCTION get_public_menu(p_tenant_slug TEXT)` (the function already exists, most recently defined in `20260708_000062_preset_order_bundles.sql`) — add one more key to the existing `jsonb_build_object(...)` call, copying every other key verbatim and appending:

```sql
    'upsell_rules', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'trigger_item_id', r.trigger_item_id,
        'suggested_item_id', r.suggested_item_id, 'confidence', r.confidence
      )) FROM restaurant_upsell_rules r
      WHERE r.tenant_id = v_tenant_id AND r.confidence > 0.3), '[]'::jsonb)
```

Same `confidence > 0.3` threshold `useUpsellRules.ts` already applies, kept consistent between the two paths. This is required, not optional — `restaurant_upsell_rules` has `USING (tenant_id = current_tenant_id())` RLS, and an anonymous QR customer has no active tenant, so a direct client-side query (the staff hook's approach) would silently return zero rows for every QR customer. Matches this codebase's established convention: anonymous access always goes through a `SECURITY DEFINER` RPC, never a direct table read (`get_public_menu`, `qr_place_order`).

`QRMenuData` (in `src/types/restaurant.ts`) gets one new field:

```ts
upsell_rules: Array<{ id: string; trigger_item_id: string; suggested_item_id: string; confidence: number }>;
```

Kept snake_case at this raw-payload layer, matching every other field already on `QRMenuData` (`base_price_usd`, not `basePriceUsd`) — mapped into the shared camelCase `UpsellRule` shape at the point of use in `QRMenuPage.tsx`, mirroring the exact mapping added to `useUpsellRules.ts` in part A.

### D. `QRCart.tsx` upsell banner

`QRMenuPage.tsx` computes the suggestion once, alongside its existing cart-derived values:

```ts
const currentCartItemIds = items.map((i) => i.menuItemId);
const mappedUpsellRules: UpsellRule[] = data.upsell_rules.map((r) => ({
  id: r.id, tenantId: data.tenant.id, triggerItemId: r.trigger_item_id,
  suggestedItemId: r.suggested_item_id, confidence: r.confidence,
  supportCount: 0, createdAt: '',
}));
const upsellSuggestion = pickUpsellSuggestion(mappedUpsellRules, currentCartItemIds, data.items);
```

(`supportCount`/`createdAt` are unused by `pickUpsellSuggestion` and never displayed in the QR UI — filled with harmless placeholders rather than widening `UpsellRule` into two variants for two call sites.)

Passed to `QRCart` as two new props:

```ts
interface QRCartProps {
  // ...existing props
  suggestion: UpsellSuggestion | null;
  onAddSuggestion: (item: RestaurantMenuItem) => void;
}
```

`onAddSuggestion` wired in `QRMenuPage.tsx` to `(item) => addItem(item, 1, {}, '', 0)` — the exact same `addItem` from `useCart()` already used by `handleAddToCart`, just called directly with defaults (quantity 1, no modifiers, no notes, no price delta) instead of routing through the item-detail sheet.

`QRCart.tsx` renders the banner near the top of the cart list (above the line items), styled to match the existing QR palette system (`var(--qr-accent)` etc., not the staff-side amber literal colors) and the visual language already established by `QRItemDetail.tsx`'s own "AI Upsell Banner" block (same component family, same platform, staff-side reference at `WaiterInterface.tsx:646-676`) — adapted to QR's CSS custom-property theming instead of hardcoded Tailwind color classes:

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

### E. Feedback discoverability

`QRMenuHome.tsx` already has a footer (`{/* KiTS fingerprint */} <footer className="qr-kits-fingerprint mt-8">`, line ~508) right above its floating-action-button stack (Fa7em, Call Waiter, Cart — line ~514 on). A "Rate Your Visit" link goes in that footer area (not the floating-action stack, which is reserved for urgent in-service requests) as a small always-visible text link:

```tsx
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

`QRMenuHome` gets one new optional prop, `feedbackHref?: string`, computed in `QRMenuPage.tsx` as:

```ts
const feedbackHref = tableParam ? `/feedback/${tenantSlug}/${tableParam}` : `/feedback/${tenantSlug}`;
```

Using `tableParam` (the `?table=N` query-string value already used for the "Table N" badge) rather than the route's `tableId`/`effectiveTableId` — `TableManagement.tsx`'s existing "Copy feedback link" action already builds this exact link shape from the table's `number` (`/feedback/${tenant.slug}/${selectedTable.number}`), and `tableParam` is the QR flow's equivalent human-readable table number. When absent, the link still works (`/feedback/:tenantSlug/:tableId?` — the route param is optional), just without a table pre-filled.

## Data Flow

| Scenario | Flow |
|---|---|
| Staff adds an item during order-taking, tenant has a matching upsell rule | `useUpsellRules` fetches + maps rules → `pickUpsellSuggestion` picks the best match → banner renders (this now actually happens, unlike today) |
| QR customer opens their cart with a matching upsell rule | `get_public_menu` already returned `upsell_rules` at page load → `pickUpsellSuggestion` runs client-side against the live cart → banner renders in `QRCart` → tapping Add calls the same `addItem` the rest of the cart uses |
| QR customer wants to leave feedback | Taps "Rate Your Visit" in the menu footer → navigates to the existing, unchanged `/feedback/:tenantSlug/:tableId` route |
| No upsell rule matches the current cart | `pickUpsellSuggestion` returns `null` → no banner rendered anywhere, both staff and QR |

## Testing

- `pickUpsellSuggestion`: pure function, straightforward unit tests — picks highest-confidence match; skips a rule whose suggested item is already in the cart; skips a rule whose suggested item is 86'd; returns `null` when no rule's trigger matches any current item; returns `null` when `rules` is empty.
- `useUpsellRules.ts`: existing behavior (fetch triggered by tenant/item-id changes) unchanged; only the mapping and selection are refactored — no new test file required beyond confirming the existing staff-side manual QA now actually shows a banner (this repo has no existing test file for this hook to extend).
- `get_public_menu()`: no pgTAP — manual reasoning-based verification matching every migration this session; confirm the new key's shape and confidence filter match the hook's threshold.
- `QRCart.tsx` / `QRMenuHome.tsx`: extend or add test coverage for the new banner (renders only when a suggestion exists, Add button wires to the passed callback) and the new footer link (renders with the expected `href`, degrades gracefully when `tableParam` is absent) — this repo already has `QRCart.test.tsx`; extend it rather than creating a parallel file.
