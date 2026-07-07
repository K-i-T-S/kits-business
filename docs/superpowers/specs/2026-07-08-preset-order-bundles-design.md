# Design Spec: Preset Order Bundles / Prix-Fixe Combos (Tier 2.1)

**Status:** Draft — pending human review (see Process note below)
**Date:** 2026-07-08
**Roadmap source:** `docs/fnb-competitive-gap-analysis.md`, Tier 2 item 1 — "confirmed absent in our platform AND unconfirmed in both competitors' public materials... genuine white space."
**Origin:** Full architecture already brainstormed with the project owner in a prior session (pricing model, course-choice model, admin location, ordering UX shape all settled). This spec formalizes those decisions into exact schema/RPC/component design following this repo's established conventions, and works out the remaining technical details that were left open.

## Executive Summary

Adds "combo / set menu" bundles: a flat-priced multi-course meal (e.g. "Family Feast — $18/guest: choose 1 appetizer, choose 1 main, dessert included") where each course is a slot with a curated list of eligible items, not a single fixed dish. Staff pick one shared set of choices for the whole party and enter a guest count; every chosen item is line-itemed at `quantity = party_size` (not per-guest individual customization).

The core design problem already solved (do not re-litigate): a bundle-add must satisfy two independent requirements — bundle-level revenue reporting (one number per bundle) and per-dish inventory deduction (accurate ingredient consumption per component, since this repo's recipe deduction is quantity-based and fires per `restaurant_order_items` row when the kitchen marks an item ready). The solution: each chosen component becomes a normal, real, `menu_item_id`-populated `restaurant_order_items` row priced at **$0**, so it flows through KDS/recipe-deduction exactly like any other dish with zero bundle-specific logic in that path; one additional `menu_item_id = NULL` row per bundle-add carries the actual charge (`unit_price = price_per_guest`, `quantity = party_size`). A new `bundle_id` column tags every row from one bundle-add so both queries — `SUM(unit_price * quantity) WHERE bundle_id = X AND menu_item_id IS NULL` for revenue, `SELECT * WHERE bundle_id = X AND menu_item_id IS NOT NULL` for consumption — are trivial. Accepted, deliberate trade-off: per-dish revenue attribution in existing menu-engineering reports shows $0 for bundled dishes (quantity counts stay accurate) — not a bug, a scope boundary confirmed with the project owner.

Three new tables (`restaurant_bundles`, `restaurant_bundle_courses`, `restaurant_bundle_course_items`), one new column on `restaurant_order_items` (`bundle_id`), one new RPC (`add_bundle_to_order`), a new "Bundles" tab inside the existing `src/pages/restaurant/MenuManagement.tsx` page for admin CRUD, and a new "Bundles" entry point inside `WaiterInterface.tsx`'s existing `MenuBrowserSheet` opening a new `BundleOrderModal` for course-by-course ordering.

## Scope

**In scope:**
- `restaurant_bundles` / `restaurant_bundle_courses` / `restaurant_bundle_course_items` tables + RLS, mirroring `restaurant_menu_items` / `restaurant_modifier_groups` / `restaurant_menu_item_modifiers`'s exact conventions.
- `restaurant_order_items.bundle_id` column.
- `add_bundle_to_order(p_table_order_id, p_bundle_id, p_party_size, p_course_selections)` RPC — the one atomic multi-row insert, `SECURITY DEFINER`, tenant-checked immediately per this branch's established IDOR-prevention pattern.
- Bundle CRUD (create/edit/delete a bundle, its course slots, and each slot's eligible items) added as a new tab in `src/pages/restaurant/MenuManagement.tsx`, matching its existing tab/CRUD conventions exactly.
- Staff-facing bundle ordering: a "Bundles" pill inside `WaiterInterface.tsx`'s `MenuBrowserSheet`, opening a new `BundleOrderModal` (course-by-course single-select picker + party-size input + confirm), calling the RPC.
- `get_public_menu` extended to include bundles (browse-only — see explicit scope decision below).
- Vitest test plan for `BundleOrderModal` and the new Bundles CRUD tab.

**Explicitly out of scope (stated boundary, not a defect):**
- **Per-guest individual course customization.** One shared set of choices per bundle-add, quantity = party size — this is the confirmed, settled design (matches real prix-fixe service), not a v1 limitation to "fix" later.
- **Per-dish revenue attribution for bundled components in existing analytics** (`restaurant_menu_engineering_cache`, item velocity views, etc.) — deliberately $0 for bundle components; quantity-based metrics (86 counts, popularity) remain accurate. Confirmed trade-off, not touched here.
- **QR self-service bundle ORDERING.** Recommended to defer to staff-only for this first pass — flagged explicitly below as a scope decision needing the human reviewer's confirmation (it was not explicitly settled in the prior brainstorm, unlike everything else in this spec).
- **Editing/re-configuring an in-flight bundle-add.** Once `add_bundle_to_order` inserts its rows, they become ordinary `restaurant_order_items` rows, individually removable via the existing per-item "remove" control (when `status = 'pending'`) exactly like any other item. There is no bundle-aware "undo the whole bundle atomically" or "swap one course after the fact" action — staff wanting to change a course selection remove the mis-selected component row(s) and re-run the bundle flow, or handle it as free-form order editing. Noted as a known interaction, not solved here (see Error Handling).
- **Bundle-level discounts, modifiers, or up-charges on individual bundle components** (e.g. "add cheese to your main, +$2"). Components are strictly `unit_price = 0`; the flat `price_per_guest` is the only chargeable amount. Not requested, not designed.
- **Branch-level bundle price/availability overrides** (the `restaurant_menu_items_branch_overrides` pattern). Not requested; menu items already have this, bundles do not get it in v1.
- Any change to `deduct_recipe_ingredients`, `KitchenDisplay.tsx`'s ready-transition handlers, or KDS station routing — the whole point of the $0-component design is that **zero** changes are needed there; bundle components are indistinguishable from ordinary order items to that entire code path.
- Any change to `fn_close_restaurant_bill` — verified it already handles this correctly with no modification (see Backend section, "No changes needed" note).

**Scope decision requiring human confirmation — QR bundle ordering:**
This spec recommends bundles be **browsable but not orderable** via the QR self-service menu in this first pass. Rationale: course-choice UI (N single-select pickers + a party-size input + validation) is meaningfully harder to do well on a small mobile screen under `QRCart.tsx`'s existing constraints than in a staff-operated screen, and every other complex, multi-step operation added to this vertical so far (table transfer, bill split, waitlist seating) has shipped staff-only first. `get_public_menu` is extended to *list* bundles (name, price, course structure, eligible items) so the QR menu can display "Family Feast — $18/guest" as a browsable menu entry with an "ask your waiter" affordance, but `QRCart.tsx` and `qr_place_order` are **not** touched — no anonymous customer can call `add_bundle_to_order` in this pass (it has no public grant path, unlike `qr_place_order`, and is designed exclusively for the authenticated-staff `current_tenant_id()` check). **This is a recommendation, not a settled decision** — flagged for the human reviewer to confirm or override before implementation.

## Data Model

Three new tables, mirroring `restaurant_menu_items` / `restaurant_modifier_groups` / `restaurant_modifiers` / `restaurant_menu_item_modifiers`'s exact style (migration `20260621_000034_restaurant_menu_system.sql`), plus one new column on `restaurant_order_items`.

```sql
-- A bundle is a flat-priced multi-course combo (e.g. "Family Feast").
CREATE TABLE IF NOT EXISTS restaurant_bundles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  name_ar              TEXT,
  description          TEXT,
  price_per_guest_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active            BOOLEAN DEFAULT true,
  active_breakfast     BOOLEAN DEFAULT true,
  active_lunch         BOOLEAN DEFAULT true,
  active_dinner        BOOLEAN DEFAULT true,
  sort_order           INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- A course "slot" within a bundle (e.g. Appetizer, Main, Dessert).
-- `course` matches the CourseType domain already used by restaurant_order_items.course /
-- table_orders.current_course ('appetizers'|'mains'|'desserts') — no CHECK constraint,
-- matching this schema's existing convention (see CLAUDE.md migration 000054 note on
-- table_orders.status: no CHECK constraint exists on that column either).
CREATE TABLE IF NOT EXISTS restaurant_bundle_courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id   UUID NOT NULL REFERENCES restaurant_bundles(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course      TEXT NOT NULL DEFAULT 'mains',
  label       TEXT NOT NULL,   -- e.g. "Choose your appetizer"
  sort_order  INTEGER DEFAULT 0
);

-- Junction: which menu items are eligible choices for a given course slot.
-- Mirrors restaurant_menu_item_modifiers's exact style (composite PK, no surrogate id).
CREATE TABLE IF NOT EXISTS restaurant_bundle_course_items (
  bundle_course_id  UUID NOT NULL REFERENCES restaurant_bundle_courses(id) ON DELETE CASCADE,
  menu_item_id      UUID NOT NULL REFERENCES restaurant_menu_items(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_course_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS restaurant_bundles_tenant_id_idx
  ON restaurant_bundles(tenant_id);
CREATE INDEX IF NOT EXISTS restaurant_bundle_courses_bundle_id_idx
  ON restaurant_bundle_courses(bundle_id);

-- restaurant_order_items: tag every row from one bundle-add.
ALTER TABLE restaurant_order_items
  ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES restaurant_bundles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS restaurant_order_items_bundle_id_idx
  ON restaurant_order_items(bundle_id) WHERE bundle_id IS NOT NULL;

-- RLS — standard tenant-scoped pattern, matching every table in restaurant_menu_system.
ALTER TABLE restaurant_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_bundle_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_bundle_course_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_bundles" ON restaurant_bundles
  FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_bundle_courses" ON restaurant_bundle_courses
  FOR ALL USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_bundle_course_items" ON restaurant_bundle_course_items
  FOR ALL USING (
    bundle_course_id IN (SELECT id FROM restaurant_bundle_courses WHERE tenant_id = current_tenant_id())
  );

-- Public read for QR menu browsing (see Scope: browsing only, no QR ordering in this pass) —
-- mirrors restaurant_menu_items's public_read_menu_items exactly (is_active-gated).
CREATE POLICY "public_read_bundles" ON restaurant_bundles
  FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_bundle_courses" ON restaurant_bundle_courses
  FOR SELECT USING (true);
CREATE POLICY "public_read_bundle_course_items" ON restaurant_bundle_course_items
  FOR SELECT USING (true);
```

**Decoupling note (important for Error Handling below):** once `add_bundle_to_order` inserts its `restaurant_order_items` rows, those rows reference `restaurant_bundles` only via `bundle_id` (`ON DELETE SET NULL`) — they hold no live reference to `restaurant_bundle_courses` or `restaurant_bundle_course_items`. Editing or deleting a bundle's course slots/eligible items after orders have been placed **never** mutates historical order data. This matches the existing `restaurant_order_items.menu_item_id` pattern (`ON DELETE SET NULL`, added in migration `20260621_000040_restaurant_bridge.sql`).

## Backend

### `add_bundle_to_order(p_table_order_id uuid, p_bundle_id uuid, p_party_size int, p_course_selections jsonb) RETURNS jsonb`

New RPC, `SECURITY DEFINER`, `SET search_path = public`, tenant-checked immediately after resolving `tenant_id` and before any other logic — this repo's established IDOR-prevention pattern (`fn_seat_waitlist_party`, `fn_transfer_table_order`). Called only by authenticated staff (no anonymous grant path, consistent with the QR-ordering scope decision above).

`p_course_selections` shape (JSONB array), one element per course slot:
```json
[{ "bundle_course_id": "uuid", "menu_item_id": "uuid" }, ...]
```

```sql
CREATE OR REPLACE FUNCTION add_bundle_to_order(
  p_table_order_id     uuid,
  p_bundle_id          uuid,
  p_party_size         int,
  p_course_selections  jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id           uuid;
  v_order_status        text;
  v_bundle_name         text;
  v_price_per_guest     numeric;
  v_bundle_active       boolean;
  v_required_course_ids uuid[];
  v_matched_course_ids  uuid[] := '{}';
  v_selection           jsonb;
  v_course_id           uuid;
  v_menu_item_id        uuid;
  v_course_slot         text;
  v_item_name           text;
  v_item_active         boolean;
  v_charge_item_id      uuid;
BEGIN
  -- Lock the order row; also serializes concurrent bundle-adds to the same order.
  SELECT tenant_id, status INTO v_tenant_id, v_order_status
    FROM table_orders WHERE id = p_table_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found: %', p_table_order_id;
  END IF;

  IF v_tenant_id <> current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_order_status <> 'open' THEN
    RAISE EXCEPTION 'order_not_open: status = %', v_order_status;
  END IF;

  IF p_party_size IS NULL OR p_party_size <= 0 THEN
    RAISE EXCEPTION 'invalid_party_size: %', p_party_size;
  END IF;

  SELECT name, price_per_guest_usd, is_active
    INTO v_bundle_name, v_price_per_guest, v_bundle_active
    FROM restaurant_bundles
    WHERE id = p_bundle_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bundle_not_found: %', p_bundle_id;
  END IF;

  IF NOT v_bundle_active THEN
    RAISE EXCEPTION 'bundle_inactive: %', p_bundle_id;
  END IF;

  SELECT array_agg(id) INTO v_required_course_ids
    FROM restaurant_bundle_courses WHERE bundle_id = p_bundle_id;

  IF v_required_course_ids IS NULL OR array_length(v_required_course_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'bundle_has_no_courses: %', p_bundle_id;
  END IF;

  IF p_course_selections IS NULL
     OR jsonb_array_length(p_course_selections) <> array_length(v_required_course_ids, 1) THEN
    RAISE EXCEPTION 'incomplete_course_selection: expected % course(s), got %',
      array_length(v_required_course_ids, 1), COALESCE(jsonb_array_length(p_course_selections), 0);
  END IF;

  FOR v_selection IN SELECT * FROM jsonb_array_elements(p_course_selections)
  LOOP
    v_course_id    := NULLIF(v_selection->>'bundle_course_id', '')::uuid;
    v_menu_item_id := NULLIF(v_selection->>'menu_item_id', '')::uuid;

    IF v_course_id IS NULL OR v_menu_item_id IS NULL THEN
      RAISE EXCEPTION 'malformed_course_selection';
    END IF;

    IF NOT (v_course_id = ANY(v_required_course_ids)) THEN
      RAISE EXCEPTION 'course_not_in_bundle: %', v_course_id;
    END IF;

    IF v_course_id = ANY(v_matched_course_ids) THEN
      RAISE EXCEPTION 'duplicate_course_selection: %', v_course_id;
    END IF;

    -- Eligibility: the chosen item must actually be configured for this slot.
    IF NOT EXISTS (
      SELECT 1 FROM restaurant_bundle_course_items
      WHERE bundle_course_id = v_course_id AND menu_item_id = v_menu_item_id
    ) THEN
      RAISE EXCEPTION 'item_not_eligible_for_course: item % not eligible for course %', v_menu_item_id, v_course_id;
    END IF;

    -- Re-resolve the item live (never trust client-supplied name/price) — also
    -- catches the item having been deactivated since the bundle was configured.
    SELECT name, is_active INTO v_item_name, v_item_active
      FROM restaurant_menu_items
      WHERE id = v_menu_item_id AND tenant_id = v_tenant_id;

    IF NOT FOUND OR NOT v_item_active THEN
      RAISE EXCEPTION 'item_no_longer_available: %', v_menu_item_id;
    END IF;

    SELECT course INTO v_course_slot FROM restaurant_bundle_courses WHERE id = v_course_id;

    INSERT INTO restaurant_order_items (
      tenant_id, order_id, menu_item_id, product_name, quantity, unit_price,
      course, status, bundle_id, sent_at
    ) VALUES (
      v_tenant_id, p_table_order_id, v_menu_item_id, v_item_name, p_party_size, 0,
      v_course_slot, 'pending', p_bundle_id, NULL
    );

    v_matched_course_ids := array_append(v_matched_course_ids, v_course_id);
  END LOOP;

  -- Belt-and-suspenders: confirm every required slot was actually matched
  -- (the length check above already guarantees this given the per-iteration
  -- duplicate/membership checks, but this makes the invariant explicit).
  IF array_length(v_matched_course_ids, 1) <> array_length(v_required_course_ids, 1) THEN
    RAISE EXCEPTION 'incomplete_course_selection';
  END IF;

  -- The one charge line. menu_item_id NULL — not a real dish, mirrors
  -- ArgileStation.tsx's addArgileChargeToOrder billing-only pattern exactly:
  -- status='served' + sent_at=now() so it never appears on a KDS ticket
  -- (KitchenDisplay.tsx's query is `.in('status', ['pending','in_progress','ready'])`).
  INSERT INTO restaurant_order_items (
    tenant_id, order_id, menu_item_id, product_name, quantity, unit_price,
    course, status, bundle_id, sent_at
  ) VALUES (
    v_tenant_id, p_table_order_id, NULL, 'Bundle: ' || v_bundle_name, p_party_size, v_price_per_guest,
    'mains', 'served', p_bundle_id, now()
  ) RETURNING id INTO v_charge_item_id;

  RETURN jsonb_build_object(
    'order_id', p_table_order_id,
    'bundle_id', p_bundle_id,
    'charge_item_id', v_charge_item_id,
    'party_size', p_party_size
  );
END;
$$;
```

No `GRANT`/`REVOKE` statements — matches this repo's convention for staff-only RPCs (`fn_seat_waitlist_party`, `fn_transfer_table_order` have none; Postgres's default `PUBLIC EXECUTE` grant plus the in-function `current_tenant_id()` check is this schema's established security model for authenticated-only RPCs).

**Component rows are inserted `status='pending'`, `sent_at=NULL`** — deliberately matching the ordinary single-item add flow (`WaiterInterface.tsx`'s `addItem`), *not* auto-fired to the kitchen. Staff use the existing "Send to Kitchen" bulk action to fire the bundle's components along with any other pending items in the same batch, exactly as they would for items added one at a time. This was a design choice, not an oversight: it keeps bundle-added items governed by the same "review before firing" workflow as everything else, rather than adding a bundle-specific auto-send path.

### `deduct_recipe_ingredients` / `KitchenDisplay.tsx` — no changes

Confirmed zero changes needed. `deductForMenuItem(menu_item_id, quantity)` fires per-row when an item transitions to `ready`; bundle component rows have a real `menu_item_id` and a real `quantity` (`= party_size`), so deduction is correct with no bundle-awareness in that code path — this is the entire point of the $0-component design.

### `fn_close_restaurant_bill` — no changes

Verified against the existing function (`supabase/migrations/20260621_000040_restaurant_bridge.sql`): it computes `v_subtotal` from `SUM(unit_price * quantity)` across all `restaurant_order_items` for the order and builds `sale_items` via `LEFT JOIN restaurant_menu_items ON roi.menu_item_id = mi.id`. Bundle components ($0 × party_size = $0) and the charge line (`menu_item_id NULL` → `product_id NULL` via the `LEFT JOIN`, `product_name = 'Bundle: ...'`) both flow through this unmodified — correct subtotal, correct `sale_items` rows, no special-casing required.

### `get_public_menu(p_tenant_slug)` — extended (browse-only)

Add three keys to the existing `jsonb_build_object` result, matching the existing `items`/`modifier_groups`/`modifiers`/`item_modifier_links` shape and gating:

```sql
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
  WHERE b.tenant_id = v_tenant_id AND b.is_active = true), '[]'::jsonb)
```

`QRMenu.tsx`/`QRCart.tsx` are **not** modified in this pass beyond whatever minimal display is desired for the browse-only bundle listing (left as an implementation-time UI detail — could be as simple as a "Combos" section showing name/price/description with an "ask your waiter" note, no cart integration). No ordering capability is added.

## Frontend

### Admin CRUD — new "Bundles" tab in `src/pages/restaurant/MenuManagement.tsx`

**Correction from the task framing:** the routed page is `src/pages/restaurant/MenuManagement.tsx` (imported via `App.tsx`'s `/restaurant/menu` route) and currently has exactly three tabs — `'builder' | 'waiter' | 'qr'` (Menu Builder / Waiter Order / QR Menu) — **no existing Modifier Groups management UI**. A second, unrelated file, `src/components/restaurant/MenuManagement.tsx` (943 lines), does contain modifier-group CRUD but is dead code — grep confirms it is not imported by any route or component anywhere in `src/`. This spec adds the new Bundles tab to the live, routed page (`src/pages/restaurant/MenuManagement.tsx`) and does not resurrect or touch the orphaned file. Flagged here as a pre-existing discrepancy discovered during research, not something this feature needs to fix.

Changes to `src/pages/restaurant/MenuManagement.tsx`:
- `type Tab = 'builder' | 'waiter' | 'bundles' | 'qr';` — new tab inserted between Waiter Order and QR Menu.
- New tab button: `{ key: 'bundles', label: 'Bundles', icon: <Layers className="h-4 w-4" /> }` (new `lucide-react` import).
- `loadData()` extended to also fetch `restaurant_bundles` (with nested `restaurant_bundle_courses` and `restaurant_bundle_course_items` via two follow-up queries, mirroring the categories/items `Promise.all` pattern already in `loadData`).
- New component `BundlesManager({ bundles, courses, courseItems, menuItems, onRefresh })`:
  - Grid of bundle cards (mirrors `MenuItemCard`'s visual language: photo-less card, name/name_ar, price badge, active toggle, edit/delete on hover) showing name, price per guest, course count, active toggle.
  - "Add Bundle" button (top-right, same gradient button style as "Add Item") opens `BundleFormModal`.
- New component `BundleFormModal({ bundle, courses, courseItems, menuItems, onClose, onSave })`, structurally matching `ItemFormModal`:
  - Fields: Name (EN/AR — two-column, matching `ItemFormModal`'s name row), Description (textarea), Price per Guest USD (number input), Served During (reusing the exact `MEAL_TIMES` all-day/breakfast/lunch/dinner toggle-pill pattern), Active toggle (matching the `is_active`/`is_featured` flag-toggle row style).
  - "Course Slots" section: a repeatable list. Each row: a `course` select (`appetizers`/`mains`/`desserts`, reusing `COURSE_LABELS` from `@/types/restaurant`), a `label` text input (placeholder `"Choose your appetizer"`), a delete-slot button (`Trash2`, matching the category-delete affordance), and — inline below the row — an "Eligible Items" chip picker: active menu items rendered as toggleable pill buttons (visually identical to the Allergens toggle-pill pattern), filtered to `is_active` items, with a small search input if the tenant's menu is large. Toggling a pill adds/removes that item from the slot's `restaurant_bundle_course_items` local draft state.
  - "Add Course Slot" button (`Plus` icon, same style as "Add Category").
  - **Client-side validation before save** (blocks save with `toast.error`, matching `ItemFormModal`'s `"Name and price are required"` pattern): name required, price > 0, at least one course slot, and **every** course slot has at least one eligible item selected. This directly implements the "bundle shouldn't be orderable until every slot has ≥1 eligible item" requirement — enforced at configuration time rather than left as a runtime surprise.
  - **Save flow** (direct sequential Supabase calls, no RPC — this is tenant-scoped config data with no concurrent-mutation risk profile, matching this repo's established distinction between "atomic operations touching live order/table state" (get an RPC) and "CRUD config forms" (sequential calls), e.g. `WaiterOrderPanel`'s `sendToKDS` inserting `table_orders` then `restaurant_order_items` sequentially with no wrapping transaction):
    1. Upsert the `restaurant_bundles` row (insert or update, matching `ItemFormModal.handleSave`'s branch).
    2. If editing an existing bundle: `DELETE FROM restaurant_bundle_courses WHERE bundle_id = <id>` (cascades to `restaurant_bundle_course_items` via `ON DELETE CASCADE` — safe per the Data Model's decoupling note: this never touches historical order rows).
    3. Re-insert the current draft's course slots (`restaurant_bundle_courses`, capturing returned `id`s).
    4. Re-insert `restaurant_bundle_course_items` rows for each (slot id, eligible item id) pair.
    - This delete-and-reinsert-all-config-on-every-save approach is simpler than diffing and safe specifically because course/course-item rows are never referenced by historical orders (only `bundle_id` is, and it survives via `ON DELETE SET NULL` even if the bundle itself is later deleted).
  - "Delete Bundle" on the card uses the same `confirm()` + delete pattern as `handleDeleteCategory`/`handleDeleteItem`.

### Staff ordering — "Bundles" entry point in `WaiterInterface.tsx`'s `MenuBrowserSheet`

- `MenuBrowserSheet` gains a `bundles: RestaurantBundle[]` prop (fetched once when the table detail sheet opens, alongside the existing `menuCategories`/`menuItems` fetch, using the same `tenant_id`-scoped query pattern) and an `onSelectBundle: (bundle: RestaurantBundle) => void` prop.
- A new pill is added to the existing category-pill row (alongside "All" and the category pills), e.g. `🎁 Bundles`, styled identically to the existing pills (`bg-indigo-600 text-white` when active). Selecting it swaps the item grid for a bundle-card grid (same 2/3-column grid layout as the item grid, cards showing bundle name, price per guest, and a one-line course summary e.g. "Appetizer · Main · Dessert").
- Tapping a bundle card calls `onSelectBundle(bundle)`, which in `WaiterInterface.tsx` sets a new `selectedBundle` state and closes `MenuBrowserSheet` — mirroring exactly how selecting a menu item sets `selectedMenuItem` and closes the sheet today.
- New component `BundleOrderModal({ bundle, courses, courseItems, menuItems, defaultPartySize, tableOrderId, onClose, onConfirm })`, structurally a bottom-sheet like `QuickAddModal` (`fixed inset-0 ... items-end ... rounded-t-3xl border-t border-white/10 bg-slate-900`):
  - Header: bundle name, price per guest, close button.
  - Party Size stepper (identical +/− stepper visual to `QuickAddModal`'s Quantity stepper), defaulting to `table.seats`, floor of 1 — matches the party-size-drives-quantity design (not a per-course quantity).
  - One section per course slot (in `sort_order`), each rendered as a labeled group (the slot's `label`, e.g. "Choose your appetizer") containing its eligible items as single-select pill buttons — visually and behaviorally identical to `QuickAddModal`'s `max_selections === 1` modifier-group radio pattern (tap selects, tap again does nothing — radios don't un-select to empty, since every slot is required).
  - Running total shown as `price_per_guest × party_size`.
  - Confirm button, disabled until every course slot has exactly one selection and party size ≥ 1 (mirrors `QuickAddModal`'s `requiredGroupsMet`-gated confirm button). On confirm: builds `p_course_selections` from local state, calls `supabase.rpc('add_bundle_to_order', { p_table_order_id: tableOrderId, p_bundle_id: bundle.id, p_party_size: partySize, p_course_selections: selections })`. On success: `toast.success('Bundle added — sent to running order')`, closes both `BundleOrderModal` and (already closed) `MenuBrowserSheet`. On error: `toast.error(err.message)`, modal stays open so staff can retry/adjust.
  - No manual refresh call needed after a successful RPC call — `useRestaurantOrder`'s existing realtime subscription (`supabase.channel('order-items-${orderId}')` on `restaurant_order_items`, `src/hooks/useRestaurantOrder.ts`) already picks up the RPC's inserts automatically, exactly as it does for `qr_place_order`'s inserts today.
- The "Bundles" entry point itself is **not** wrapped in `RoleGate` — matching the existing unguarded "Add from Menu" button (only the separate "Transfer Table / Waiter" action is role-gated in this screen); ordinary ordering is available to any authenticated staff member viewing the table detail sheet.

### Types

`src/types/restaurant.ts` additions:
```ts
export interface RestaurantBundle {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  price_per_guest_usd: number;
  is_active: boolean;
  active_breakfast: boolean;
  active_lunch: boolean;
  active_dinner: boolean;
  sort_order: number;
}

export interface RestaurantBundleCourse {
  id: string;
  bundle_id: string;
  tenant_id: string;
  course: CourseType;
  label: string;
  sort_order: number;
}

export interface RestaurantBundleCourseItem {
  bundle_course_id: string;
  menu_item_id: string;
}
```
`RestaurantOrderItem` gains `bundle_id: string | null;`.

## Error Handling & Edge Cases

| Case | Handling |
|---|---|
| A course slot's eligible item is deactivated (or deleted) after the bundle was configured | No cascade to the bundle itself — the bundle stays `is_active` as configured. The RPC re-resolves each chosen item live and rejects (`item_no_longer_available`) if it's inactive at order time, so a stale choice can never be ordered. `BundleFormModal`'s eligible-item picker and `BundleOrderModal`'s course pickers both filter to `is_active = true` live, so a deactivated item silently disappears as an *option* going forward — staff configuring or ordering the bundle simply never see it again. If a slot's *last* eligible active item is deactivated, `BundleOrderModal` renders that slot with zero selectable options and disables the Confirm button (client-side gate), and the RPC's `item_not_eligible_for_course`/`item_no_longer_available` checks are the server-side backstop if a stale client payload is submitted anyway. No automatic bundle-deactivation cascade — matches this repo's general absence of orphan-cleanup automation elsewhere (e.g. deleting a menu item doesn't cascade-deactivate modifier groups that reference it either). |
| `party_size` is 0, negative, null, or non-integer | Rejected both client-side (stepper floors at 1, disabled Confirm if somehow 0) and server-side (`invalid_party_size` exception) — defense in depth, not trusting the client. |
| A course slot has zero eligible items configured | `BundleFormModal` blocks *saving* the bundle at all in this state (client-side validation, see Frontend). If such a state exists anyway (e.g. all items in a slot later deactivated post-save, as above), `BundleOrderModal` disables Confirm and the RPC's `bundle_has_no_courses`/selection-count check is the backstop. |
| Bundle deleted while a `BundleOrderModal` is open for it | RPC re-validates `bundle_not_found` at call time (looked up fresh, not trusted from a stale client prop) — clean error, no partial insert. |
| Table order closed/paid between opening `BundleOrderModal` and confirming | RPC's `FOR UPDATE` lock + `order_not_open` check catches this — no bundle rows get appended to a closed bill. |
| Two staff add different bundles to the same open order concurrently | Serialized by the `FOR UPDATE` lock on the `table_orders` row inside the RPC — second caller simply waits for the first transaction to commit, then proceeds normally (no data corruption; this is a low-contention path, same reasoning as `fn_transfer_table_order`). |
| Staff removes one bundle component row after the bundle-add (e.g. removes just the dessert component) but leaves the charge line and other components | **Allowed, not specially guarded** — this is the accepted trade-off noted in Scope ("Editing/re-configuring an in-flight bundle-add" is out of scope). The remaining rows are still valid `restaurant_order_items` (correct `bundle_id` tag for analytics), just no longer representing a "complete" bundle on the ticket. Staff intending to change a selection are expected to remove and re-run the bundle flow, or handle it as ordinary manual order editing — same as how any multi-item order can be manually edited today. |
| Forged/tampered `p_course_selections` (e.g. a `menu_item_id` not actually eligible for the claimed `bundle_course_id`, or referencing another tenant's bundle) | Every selection is re-validated against `restaurant_bundle_course_items` and `tenant_id` server-side inside the RPC — nothing in the client payload is trusted beyond IDs to look up. |
| Bundle price is `$0` or bundle is saved with price left blank | Client-side validation requires price > 0 (same bar as `ItemFormModal`'s price validation) — a $0 bundle would produce $0 revenue with real inventory consumption, almost certainly a data-entry mistake, not a valid configuration. |

## Testing

Vitest, following this repo's established mocking conventions (`Waitlist.test.tsx`'s `vi.mock('@/utils/supabaseClient', ...)` shape with a shared `mockRpc`/`mockInsert` pattern, and `QRCart.test.tsx`'s RPC-payload-assertion style).

**`BundleOrderModal.test.tsx`:**
- Renders one section per course slot with the slot's `label`, and renders only that slot's eligible items (not the full menu) as selectable pills.
- Confirm button is disabled until every slot has a selection; enabling after the last required slot is filled.
- Party size stepper floors at 1 and cannot go below it; running total recomputes as `price_per_guest × party_size`.
- Confirm calls `supabase.rpc('add_bundle_to_order', { p_table_order_id, p_bundle_id, p_party_size, p_course_selections })` with the exact selection shape (`[{ bundle_course_id, menu_item_id }, ...]`), one entry per slot, in the order the slots were rendered.
- Success path: shows a success toast and calls `onClose`/`onConfirm` — no manual refetch call asserted (relies on the existing realtime subscription, so the test only needs to assert the RPC call and UI closing, not a follow-up query).
- Error path (RPC returns `{ error }`): shows an error toast, modal stays open (does **not** call `onClose`), matching `QRCart.test.tsx`'s "shows a visible error message instead of failing silently" pattern.
- A course slot with zero eligible items (e.g. simulating the deactivated-last-item edge case) renders with no selectable pills for that slot and keeps Confirm disabled.

**`MenuManagement.test.tsx` (new file, or a new `describe` block if a test file for this page doesn't already exist — check first) — Bundles tab:**
- Renders the Bundles tab and lists fetched bundles with name/price.
- "Add Bundle" opens `BundleFormModal` with an empty form; "Edit" opens it pre-filled from the selected bundle's data.
- Attempting to save with no course slots, or a course slot with zero eligible items, shows a `toast.error` and does **not** call `supabase.from('restaurant_bundles').insert/update`.
- A valid save calls the upsert on `restaurant_bundles`, then the delete-and-reinsert sequence on `restaurant_bundle_courses`/`restaurant_bundle_course_items` in that order (assert call ordering via mock call order, matching the intent of the described save flow).
- Deleting a bundle prompts `confirm()` (mock `window.confirm` to return `true`/`false` and assert the delete call is/isn't made, matching `handleDeleteCategory`'s existing test-equivalent pattern if one exists for categories, else establishing it fresh).

**RPC (`add_bundle_to_order`):** smoke-tested manually via the Supabase SQL Editor — this repo has no automated SQL test harness (established convention, stated identically in both template specs). Manual coverage should include: happy path (2–3 course bundle, valid selections), `item_not_eligible_for_course` (a `menu_item_id` not linked to the claimed slot), `item_no_longer_available` (deactivate an eligible item then attempt to select it), `order_not_open` (attempt on a `paid` order), `invalid_party_size` (0 and negative), and the cross-tenant `permission_denied` path.

## Implementation Notes

- New migration file (not created by this spec-writing pass — implementation happens separately, in an isolated worktree, per this repo's established process): `supabase/migrations/20260708_000058_preset_order_bundles.sql`, numbered directly after the most recently merged migration on `main` (`20260707_000057_order_item_integrity.sql`). Contains: the three new tables + RLS + indexes, the `restaurant_order_items.bundle_id` column, the `add_bundle_to_order` function, and the `get_public_menu` redefinition (`CREATE OR REPLACE FUNCTION`, additive — existing keys in its JSONB output are unchanged). Purely additive; no existing table's columns are altered beyond the one new nullable `bundle_id` column. Delivered as a file, applied manually via the Supabase Dashboard SQL Editor per this repo's convention.
- No edge function work, no redeploy needed — entirely client-driven (direct table CRUD for bundle config, one RPC for the order-time atomic insert), same category as Waitlist Management.
- `src/components/restaurant/MenuManagement.tsx` (the orphaned, unrouted 943-line file containing dead modifier-group CRUD code) is left untouched — noted for awareness only, not in scope to delete or resurrect as part of this feature.
- The QR-bundle-ordering deferral (Scope section) is the one open decision in this spec requiring explicit human sign-off before implementation; everything else reflects the prior brainstorm's settled architecture plus this pass's worked-out technical details.
