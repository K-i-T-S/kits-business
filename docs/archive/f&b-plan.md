# KiTS F&B (Restaurant) Vertical — Development Plan

> **Audience:** Developers and AI agents continuing work on this vertical.  
> **Last updated:** 2026-06-22 | **Stack:** React 18 / Vite / TypeScript strict / Supabase PostgREST / Tailwind (dark navy)

---

## 1. Architecture Overview

### 1.1 Where Things Live

| Layer | Location | Notes |
|---|---|---|
| Pages | `src/pages/restaurant/` | 13 pages, all lazy-loaded |
| Types | `src/types/restaurant.ts` | Single canonical type file — all restaurant interfaces live here |
| DB Migrations | `supabase/migrations/2026062[01]_000[3-4]*` | Migrations 31–41 cover the restaurant vertical |
| Hooks | `src/hooks/useRestaurantOrder.ts` | Order state machine hook used by WaiterInterface |
| ML/AI | `src/utils/restaurantML.ts` | Demand forecasting, slow-order alerting |
| QR Menu | `src/pages/QRMenu.tsx` | Public-facing page at `/menu/:slug` |

### 1.2 Database Tables

All tables have `tenant_id UUID NOT NULL REFERENCES tenants(id)` and `RLS ENABLED`.

**Core Tables (migration 31)**
- `restaurant_tables` — physical tables with floor plan x/y coords and status
- `table_orders` — orders opened per table session (open → sent → served → paid)
- `restaurant_order_items` — individual line items within a table order

**Menu System (migration 34)**
- `restaurant_menu_categories` — category with name, name_ar, icon, meal-time flags
- `restaurant_menu_items` — item with price (USD + LBP), allergens, calories, modifiers, sort_order
- `restaurant_menu_item_modifiers` — modifier group assignments per menu item

**Order Flow (migration 35)**
- `restaurant_pending_orders` — QR-submitted orders awaiting waiter confirmation
- `restaurant_bill_splits` + `restaurant_bill_split_parts` — split-bill logic
- `restaurant_order_flow_config` — per-tenant config (direct vs waiter_confirm, VAT, service charge)
- Extended `table_orders` with: `order_flow`, `payment_mode`, `service_charge_pct`, `vat_pct`, `tip_amount_usd`, `discount_pct`, `paid_at`, `payment_method`, `waiter_id`

**Argile + KDS (migration 36)**
- `restaurant_kds_stations` — KDS display stations (e.g., "Hot Kitchen", "Grill", "Argile")
- `restaurant_item_stations` — many-to-many: which items route to which station
- `restaurant_argile_sessions` — per-table argile (hookah) sessions with pricing, coal tracking
- `restaurant_argile_events` — event log (fa7em_request, coal_delivered, tobacco_refill)
- `restaurant_argile_flavors` — flavor catalog with pricing

**Recipes & Cost (migration 37)**
- `restaurant_ingredient_suppliers` — supplier contacts
- `restaurant_ingredients` — ingredients with unit, stock qty, par level, cost
- `restaurant_ingredient_movements` — in/out movements with reason and operator
- `restaurant_recipes` — named recipes (can link to menu item)
- `restaurant_recipe_ingredients` — recipe ingredient lines with qty and unit
- `restaurant_menu_item_recipes` — link table: menu item → recipe
- `restaurant_waste_log` — logged waste with reason and cost impact

**Intelligence (migration 38)**
- `restaurant_shifts` — shift definitions (morning/evening/night/split/full)
- `restaurant_shift_assignments` — staff assigned to shift with clock-in/out
- `restaurant_slow_alerts` — auto-generated slow-table alerts with resolution tracking
- `restaurant_eod_reports` — end-of-day report snapshots stored as JSONB
- `restaurant_table_feedback` — customer satisfaction ratings (1-5) + comment

**Multi-Branch (migration 39)**
- `restaurant_branches` — branch definitions with address, phone, manager
- `restaurant_branch_metrics` — daily aggregated metrics per branch (revenue, covers, rating)
- `restaurant_delivery_integrations` — Talabat/Toters/Zomato platform configs

**Bridge to Platform (migration 40)**
- `restaurant_menu_items.product_id` — optional FK to `products` table for inventory sync
- `restaurant_order_items.menu_item_id` — FK to `restaurant_menu_items` for cost tracking
- `fn_close_restaurant_bill()` RPC — closes table order, creates sale record, deducts inventory

**Views (migration 41)**
- `restaurant_daily_revenue` — Beirut-TZ daily revenue rollup view
- `restaurant_item_velocity` — per-item daily sold qty (feeds ML demand forecasting)
- `finalize_restaurant_order()` — idempotent sale-creation for historical backfill

### 1.3 Critical RLS Rule

`current_tenant_id()` uses `LIMIT 1` with no `ORDER BY` — **non-deterministic** when a user belongs to multiple tenants (e.g., KiTS admin accounts). **Every SELECT query must include `.eq('tenant_id', tenantId)` explicitly** — do not rely on RLS alone. This is already fixed in all 13 pages. New pages/queries must follow the same pattern.

### 1.4 Routing

All restaurant routes are under `/restaurant/`:

| Path | Page | Notes |
|---|---|---|
| `/restaurant/tables` | `TableManagement` | Floor plan drag-and-drop |
| `/restaurant/menu` | `MenuManagement` | 3 tabs: Menu Builder / Waiter Order / QR Menu |
| `/restaurant/waiter` | `WaiterInterface` | Table grid → order taking with menu browser |
| `/restaurant/reservations` | `Reservations` | Booking calendar |
| `/restaurant/kds` | `KitchenDisplay` | Live ticket board by KDS station |
| `/restaurant/argile` | `ArgileStation` | Hookah session management |
| `/restaurant/analytics` | `RestaurantAnalytics` | Live ops + revenue charts |
| `/restaurant/shifts` | `ShiftManager` | Week view, clock-in/out |
| `/restaurant/tips` | `TipsManagement` | Daily tips calculation and staff split |
| `/restaurant/eod` | `EODReport` | Daily summary + print |
| `/restaurant/recipes` | `RecipeInventory` | Ingredient stock + recipe costing |
| `/restaurant/branches` | `MultiBranchHub` | Multi-location overview |
| `/restaurant/settings` | `RestaurantSettings` | VAT, service charge, order flow config |
| `/menu/:slug` | `QRMenu` | **Public** — QR scan landing page |

---

## 2. What Is Fully Implemented

### 2.1 Table Management (`TableManagement.tsx`)
- Visual floor plan with draggable table positions (x/y in %)
- Sections: indoor, terrace, bar
- Table status indicators: available (green), occupied (amber), reserved (purple), cleaning (gray)
- Add/remove tables, set seats and section
- Per-table live order badge (pending item count)
- Sections stored in localStorage per tenant

### 2.2 Menu Management (`MenuManagement.tsx`)
- **Menu Builder tab**: Category list (drag-to-reorder via sort_order), item grid with search
- Category CRUD: add/delete, icon picker
- Item CRUD modal: name (EN + AR), category, price USD, cost price, allergen badges (8 types), meal time flags (Breakfast/Lunch/Dinner), is_active, is_featured
- **Waiter Order tab**: Demo preview of the waiter order interface
- **QR Menu tab**: QR code generator with 6 palette themes, promotional banner, URL copy
- `tenant_id` required in every INSERT — was a known bug, now fixed

### 2.3 Waiter Interface (`WaiterInterface.tsx`)
- Table grid sorted by section
- Tap table → `TableDetail` bottom-sheet overlay
- Full menu browser: `MenuBrowserSheet` (full-screen overlay, category pills, search, 2-col grid)
- Quick add modal: `QuickAddModal` (qty stepper, special notes)
- Per-table order creation and item addition via `useRestaurantOrder` hook
- 86'd badge on unavailable items
- Order summary, close/pay flow placeholder

### 2.4 Kitchen Display System (`KitchenDisplay.tsx`)
- Live ticket board polling every 10s
- Station filter pills (All / Hot Kitchen / Grill / Argile / etc.)
- Color-coded ticket age: green < 8 min, amber 8-15 min, red > 15 min
- Item status progression: pending → in_progress → ready
- Sound alert on new tickets
- Station configuration modal (add/edit/reorder stations)
- Priority item flagging

### 2.5 Argile Station (`ArgileStation.tsx`)
- Active session cards with per-table coal/refill tracking
- Open argile session linked to table order
- Add coal delivery, tobacco refill events
- Fa7em (waiter call) request with notification badge
- Flavor catalog for quick session pricing
- Session timer display

### 2.6 QR Menu (`src/pages/QRMenu.tsx`)
- Public page at `/menu/:tenantSlug`
- Fetches menu via `get_public_menu(:tenantSlug)` RPC
- Category navigation pills
- Full item cards with photo, price (USD/LBP), allergens, calories
- Add-to-cart flow with modifier selection
- Cart drawer with quantity controls
- Checkout: `waiter_confirm` → creates pending order in DB; `direct` → creates table order directly
- Palette themes: dark-luxury, beirut-night, mediterranean, lebanese-garden, classic-bistro, modern-minimal

### 2.7 Reservations (`Reservations.tsx`)
- Booking list view with status chips (pending/confirmed/seated/completed/no_show/cancelled)
- Status update inline
- Date filter
- Add reservation modal: name, phone, date/time, covers, table assignment, notes

### 2.8 Analytics (`RestaurantAnalytics.tsx`)
- Time range: Today / 7 days / 30 days / 90 days
- Live ops panel: tables occupied, pending items, slow alerts
- Revenue trend line chart (Recharts)
- Top dishes bar chart
- Argile session metrics
- Table feedback recent reviews
- Waiter performance breakdown

### 2.9 Shift Manager (`ShiftManager.tsx`)
- Weekly shift calendar
- Shift types: morning / evening / night / split / full
- Staff assignment with role (waiter/chef/cashier/argile/manager/etc.)
- Clock-in / clock-out with hours calculation
- Tips config (stored in localStorage)
- Shift open/close

### 2.10 Tips Management (`TipsManagement.tsx`)
- Today's service revenue auto-calculated
- Tips algorithms: Service Charge %, Revenue %, Fixed Amount
- Waiter share vs kitchen share split
- Role-based distribution (percentages must total 100%)
- Per-staff breakdown display
- Manual tip records with localStorage persistence

### 2.11 EOD Report (`EODReport.tsx`)
- Auto-generates from today's data: orders, items sold, argile revenue, shift hours
- Revenue breakdown: food / argile / total
- Most popular items list
- Staff hours summary
- Print-ready layout
- Saves to `restaurant_eod_reports` table

### 2.12 Recipe & Cost (`RecipeInventory.tsx`)
- Ingredient stock with par levels and low-stock warning
- Supplier management with contact info
- Stock movements (in/out with reason)
- Recipe builder: link ingredients with quantity and unit
- Link recipe to menu item for auto-cost calculation
- Food cost % display on menu items
- Waste log with cost impact

### 2.13 Multi-Branch Hub (`MultiBranchHub.tsx`)
- Branch cards with live metrics (orders, revenue, rating)
- Add/edit branch with manager assignment
- Aggregated cross-branch stats
- Branch-level deep dive placeholder

### 2.14 Restaurant Settings (`RestaurantSettings.tsx`)
- VAT rate, service charge rate
- Order flow: waiter_confirm vs direct
- Payment mode: waiter_only vs customer_can_pay
- Default course settings
- Operating hours

---

## 3. Known Issues & Technical Debt

| Issue | Status | Location |
|---|---|---|
| `current_tenant_id()` non-deterministic (LIMIT 1, no ORDER BY) | Workaround applied | All restaurant pages: explicit `.eq('tenant_id', tenantId)` on every SELECT |
| `restaurant_menu_categories` RLS SELECT returns 0 without explicit filter | Workaround applied | Same as above |
| `get_public_menu()` RPC — verify it exists in DB | **Unverified** | Migration 34, needed by QRMenu.tsx |
| Service worker caches old JS bundle on dev — masks code fixes | Dev-only annoyance | Unregister SW before testing |
| QR Menu redirect — was going to dashboard because `tenant_slug` field not populated | **Fixed** — now uses `slug` field | MenuManagement.tsx `QRMenuSettings` component |
| `restaurant_recipe_ingredients.tenant_id` column — may not exist if migration 37 ran before column was added | **Check** before RecipeInventory SELECT | Migration 37 |
| Waiter React-controlled input can't be filled by Playwright via JS events | UI-only testing limitation | WaiterInterface.tsx, MenuManagement.tsx |
| Tips and Shifts partially use localStorage — not multi-device or multi-user | By design for now | TipsManagement.tsx, ShiftManager.tsx |

---

## 4. What Needs to Be Built Next

### 4.1 Priority 1 — Core Gaps (Blockers for Go-Live)

#### A. QR Menu End-to-End Test
**What:** Verify the full guest flow: scan QR → browse menu → add items → checkout → order appears in waiter interface.  
**Why:** The QR URL fix was applied but the full flow (pending order → waiter confirmation → table order creation) has not been tested end-to-end.  
**Files:** `src/pages/QRMenu.tsx`, `src/pages/restaurant/WaiterInterface.tsx`  
**DB:** `restaurant_pending_orders`, `fn_close_restaurant_bill()`

#### B. Bill Close / Payment Flow
**What:** Complete the "Close Bill" action in WaiterInterface. Currently the `fn_close_restaurant_bill()` RPC exists in the bridge migration but the UI only has a placeholder.  
**Steps:**
1. Show bill summary: subtotal + service charge % + VAT % + tip → total
2. Payment method selector: Cash / Card / Split
3. Discount input (manager-only via RoleGate)
4. Call `fn_close_restaurant_bill(order_id, payment_method, tip_amount)`
5. Mark table available, show receipt
**Files:** `src/pages/restaurant/WaiterInterface.tsx` → `TableDetail` component  
**DB:** `fn_close_restaurant_bill()` RPC, `table_orders.paid_at`, `sales` table bridge

#### C. Menu Item Photo Upload
**What:** The `photo_url` field exists on `restaurant_menu_items` but there is no upload UI.  
**Steps:**
1. Add image upload input in `ItemFormModal`
2. Upload to Supabase Storage bucket `menu-images/{tenantId}/{itemId}`
3. Store public URL in `photo_url`
4. Display in item cards and QR menu
**Files:** `src/pages/restaurant/MenuManagement.tsx` → `ItemFormModal`

#### D. Order Sending (Send to KDS)
**What:** In WaiterInterface, after adding items the waiter needs a "Send Order" button that marks items as `sent_at = now()` and triggers KDS display.  
**Steps:**
1. Add "Send to Kitchen" button in TableDetail
2. Update `restaurant_order_items.status` from `pending` → `in_progress` for all unsent items
3. Set `sent_at = now()`
4. KDS auto-polls and shows the tickets
**Files:** `src/pages/restaurant/WaiterInterface.tsx`, `src/hooks/useRestaurantOrder.ts`

### 4.2 Priority 2 — Feature Completeness

#### E. Real-Time Order Updates (Supabase Realtime)
**What:** Replace 10-second polling in KDS and Waiter with Supabase channel subscriptions.  
**Pattern:**
```typescript
supabase
  .channel('restaurant-orders')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_order_items', filter: `tenant_id=eq.${tenantId}` }, callback)
  .subscribe();
```
**Files:** `src/pages/restaurant/KitchenDisplay.tsx`, `src/hooks/useRestaurantOrder.ts`

#### F. QR Pending Orders Panel in Waiter
**What:** WaiterInterface needs a "Pending Orders" badge/panel showing guest-submitted orders from QR menu awaiting confirmation.  
**What already exists:** `restaurant_pending_orders` table, `PendingOrder` type in `src/types/restaurant.ts`  
**What's missing:** UI in WaiterInterface to see, confirm, or reject pending orders  
**Files:** `src/pages/restaurant/WaiterInterface.tsx`

#### G. Course Management
**What:** The order has a `current_course` field (appetizers / mains / desserts). Waiter needs to be able to fire courses: "Fire Mains" sends all mains items to KDS simultaneously.  
**Files:** `src/pages/restaurant/WaiterInterface.tsx`, `src/pages/restaurant/KitchenDisplay.tsx`

#### H. Bill Split UI
**What:** `restaurant_bill_splits` table exists. Need UI for splitting by item, by seat, or equally.  
**Files:** `src/pages/restaurant/WaiterInterface.tsx` → new `BillSplitModal` component  
**DB:** `restaurant_bill_splits`, `restaurant_bill_split_parts`

#### I. Modifier Groups in Order
**What:** `restaurant_menu_item_modifiers` and `RestaurantModifierGroup` types exist. The QR menu supports them in the cart but the Waiter Interface's `QuickAddModal` does not prompt for modifiers.  
**Files:** `src/pages/restaurant/WaiterInterface.tsx` → `QuickAddModal`

#### J. Reservation ↔ Table Link
**What:** Reservations exist but arriving guests don't automatically occupy the reserved table. When a reservation is "seated", it should create a `table_orders` record.  
**Files:** `src/pages/restaurant/Reservations.tsx`, `src/pages/restaurant/TableManagement.tsx`

### 4.3 Priority 3 — Intelligence & Polish

#### K. Demand Forecasting Integration
**What:** `src/utils/restaurantML.ts` exists with forecasting logic. Connect it to RestaurantAnalytics page and add a "Forecast" panel showing predicted demand for next 7 days with holiday awareness.  
**Files:** `src/pages/restaurant/RestaurantAnalytics.tsx`, `src/utils/restaurantML.ts`

#### L. Auto-86 from Recipe Stock
**What:** When an ingredient drops below zero stock (via `restaurant_ingredient_movements`), auto-mark the affected menu items as `is_eighty_sixd = true`. Un-mark when restocked.  
**Approach:** DB trigger or frontend check on ingredient save  
**DB:** `restaurant_menu_items.is_eighty_sixd`, `restaurant_ingredients.current_stock_qty`

#### M. WhatsApp Order Confirmation
**What:** After a table order is closed (bill paid), send a WhatsApp receipt to the customer if phone number was provided.  
**Existing:** Edge function `whatsapp-receipt` already exists for POS — adapt for restaurant  
**Files:** `supabase/functions/whatsapp-receipt/`, `src/pages/restaurant/WaiterInterface.tsx`

#### N. Staff Performance Dashboard
**What:** Extend ShiftManager or RestaurantAnalytics to show per-waiter metrics: orders served, avg turnaround, tip earnings, covers.  
**Files:** `src/pages/restaurant/RestaurantAnalytics.tsx` → new `WaiterLeaderboard` component

#### O. Delivery Platform Integration
**What:** `restaurant_delivery_integrations` table exists for Talabat/Toters/Zomato. Build the config UI and a webhook receiver that imports incoming delivery orders as table orders.  
**Files:** `src/pages/restaurant/MultiBranchHub.tsx` or new `DeliveryIntegrations.tsx`  
**DB:** `restaurant_delivery_integrations`

#### P. Multi-Branch Menu Sync
**What:** Currently each branch shares the same menu (tenant-wide). Add per-branch availability toggle on menu items.  
**DB change needed:** `restaurant_menu_items_branch_overrides(tenant_id, branch_id, menu_item_id, is_available, price_override_usd)`

---

## 5. Database Migration Sequence

Run these in order in Supabase Dashboard → SQL Editor. All are `IF NOT EXISTS` safe to re-run.

| # | File | What it adds |
|---|---|---|
| 31 | `20260620_000031_restaurant_schema.sql` | Core tables: tables, table_orders, order_items |
| 34 | `20260621_000034_restaurant_menu_system.sql` | Menu categories, items, modifiers, QR menu RPC |
| 35 | `20260621_000035_restaurant_order_flow.sql` | Pending orders, bill splits, order flow config |
| 36 | `20260621_000036_restaurant_argile.sql` | KDS stations, argile sessions/events/flavors |
| 37 | `20260621_000037_restaurant_recipes.sql` | Ingredient suppliers, stock, recipes, waste log |
| 38 | `20260621_000038_restaurant_intelligence.sql` | Shifts, slow alerts, EOD reports, feedback |
| 39 | `20260621_000039_restaurant_multi_branch.sql` | Branches, branch metrics, delivery integrations |
| 40 | `20260621_000040_restaurant_bridge.sql` | FK bridges to products/sales, fn_close_restaurant_bill() |
| 41 | `20260621_000041_restaurant_views.sql` | Daily revenue view, item velocity view |
| 42 | `20260622_000042_restaurant_ai.sql` | AI queries table, demand forecasts, upsell rules |

> **Migrations 43–50** are planned for Phase 4+ features: cash management, delivery hub, loyalty integrations, events/reservations, hotel PMS bridge, and subscription billing. Files do not exist yet.

---

## 6. Key Code Patterns

### 6.1 Adding a New Restaurant Page

```typescript
// src/pages/restaurant/NewFeature.tsx
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';

export default function NewFeature() {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const loadData = useCallback(async () => {
    if (!tenantId) return;  // REQUIRED — always guard
    const { data, error } = await supabase
      .from('restaurant_some_table')
      .select('*')
      .eq('tenant_id', tenantId)  // REQUIRED — always explicit
      .order('created_at', { ascending: false });
    // ...
  }, [tenantId]);
}
```

### 6.2 INSERT with tenant_id

```typescript
const { error } = await supabase.from('restaurant_some_table').insert({
  tenant_id: tenantId,  // ALWAYS include
  // ... other fields
});
```

### 6.3 Navigate Back (React Router 7)

```typescript
// CORRECT — React Router 7 types NavigateFunction as returning void | Promise<void>
onClick={() => { void navigate(-1); }}

// WRONG — causes no-misused-promises lint error
onClick={() => navigate(-1)}
onClick={async () => navigate(-1)}
```

### 6.4 Adding to Nav

Register in `src/components/Layout.tsx` under the Restaurant Pro section. Use an i18n key like `nav.vertical.newfeature` — add it to `src/i18n/locales/en.json` and `ar.json`.

### 6.5 Feature Gating

The restaurant vertical is only available to Growth and Business plan tenants:

```typescript
// In Layout.tsx nav — wrap the whole restaurant section
<FeatureGate feature="restaurant">
  {/* restaurant nav items */}
</FeatureGate>
```

---

## 7. TypeScript Types — Quick Reference

All types in `src/types/restaurant.ts`:

| Type | Use |
|---|---|
| `RestaurantTable` | Floor plan table |
| `TableOrder` | Active table session |
| `RestaurantOrderItem` | Line item in an order |
| `RestaurantSettings` | Per-tenant config (VAT, service charge, etc.) |
| `RestaurantMenuCategory` | Menu category with meal-time flags |
| `RestaurantMenuItem` | Menu item with price, allergens, modifiers |
| `RestaurantModifierGroup` / `RestaurantModifier` | Modifier groups and options |
| `QRMenuData` | Shape returned by `get_public_menu()` RPC |
| `QRCartItem` | Cart item during QR checkout |
| `PendingOrder` / `PendingOrderItem` | Guest-submitted order awaiting waiter confirm |
| `KDSStation` | KDS display station config |
| `ArgileSession` / `ArgileEvent` / `ArgileFlavor` | Argile (hookah) session data |
| `RestaurantShift` / `ShiftAssignment` | Shift and staff assignment |
| `RestaurantBranch` / `BranchMetrics` | Multi-branch data |
| `RestaurantIngredient` / `RestaurantRecipe` | Recipe/inventory types |
| `TableFeedback` | Guest rating submitted at table |
| `SlowAlert` | Auto-generated alert for slow tables |

---

## 8. Environment & Edge Functions

### Edge Functions (deploy to Supabase)
```bash
npx supabase functions deploy whatsapp-receipt --project-ref pytndxjeznhhyycjasep
npx supabase functions deploy trigger-workflows --project-ref pytndxjeznhhyycjasep
```

Required secrets:
```bash
npx supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_ID=... --project-ref pytndxjeznhhyycjasep
```

### Supabase Project
- Project ref: `pytndxjeznhhyycjasep`
- URL: `https://pytndxjeznhhyycjasep.supabase.co`

---

## 9. Completed Sprint History

| Sprint | Scope |
|---|---|
| Sprint 1 (June 20) | Tables, basic orders, floor plan, reservations, KDS skeleton |
| Sprint 2 (June 21 — morning) | Menu system (categories/items/modifiers), QR menu, waiter menu browser, order flow engine, argile station, recipe/cost system |
| Sprint 2 (June 21 — afternoon) | Restaurant intelligence: shifts, slow alerts, EOD report, analytics, tips, multi-branch hub, bridge to sales |
| Sprint 3 (June 22) | Bug fixes: explicit tenant_id filters on all SELECTs, QR slug field fix, lint cleanup (17 errors), waiter interface menu browser redesign |
