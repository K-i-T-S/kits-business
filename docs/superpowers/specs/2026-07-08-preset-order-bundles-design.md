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
- `get_public_menu` extended to include bundles (browse-only — see explicit scope decision below; **superseded for ordering, see Addendum**).
- Vitest test plan for `BundleOrderModal` and the new Bundles CRUD tab.
- **QR self-service bundle ordering** (resolved into scope 2026-07-08 — see the "Addendum: QR Self-Service Bundle Ordering" section at the end of this document): extending `qr_place_order` to accept bundle-adds alongside regular items, a new `QRBundleDetail.tsx` course-choice screen, `useCart.ts`/`QRCart.tsx` changes to carry a bundle-in-cart through checkout, and the corresponding error-handling and test plan.

**Explicitly out of scope (stated boundary, not a defect):**
- **Per-guest individual course customization.** One shared set of choices per bundle-add, quantity = party size — this is the confirmed, settled design (matches real prix-fixe service), not a v1 limitation to "fix" later.
- **Per-dish revenue attribution for bundled components in existing analytics** (`restaurant_menu_engineering_cache`, item velocity views, etc.) — deliberately $0 for bundle components; quantity-based metrics (86 counts, popularity) remain accurate. Confirmed trade-off, not touched here.
- **QR self-service bundle ORDERING.** Recommended to defer to staff-only for this first pass — flagged explicitly below as a scope decision needing the human reviewer's confirmation (it was not explicitly settled in the prior brainstorm, unlike everything else in this spec).
  **RESOLVED 2026-07-08 — now IN SCOPE.** The project owner has confirmed QR self-service bundle ordering is required for this feature, not deferred. The original staff-only design below (RPC, `BundleOrderModal`, admin CRUD) is unchanged and still ships. See the new **"Addendum: QR Self-Service Bundle Ordering"** section at the end of this document for the full design of the QR customer-facing path (extended `qr_place_order`, `QRBundleDetail.tsx`, cart changes, error handling, testing).
- **Editing/re-configuring an in-flight bundle-add.** Once `add_bundle_to_order` inserts its rows, they become ordinary `restaurant_order_items` rows, individually removable via the existing per-item "remove" control (when `status = 'pending'`) exactly like any other item. There is no bundle-aware "undo the whole bundle atomically" or "swap one course after the fact" action — staff wanting to change a course selection remove the mis-selected component row(s) and re-run the bundle flow, or handle it as free-form order editing. Noted as a known interaction, not solved here (see Error Handling).
- **Bundle-level discounts, modifiers, or up-charges on individual bundle components** (e.g. "add cheese to your main, +$2"). Components are strictly `unit_price = 0`; the flat `price_per_guest` is the only chargeable amount. Not requested, not designed.
- **Branch-level bundle price/availability overrides** (the `restaurant_menu_items_branch_overrides` pattern). Not requested; menu items already have this, bundles do not get it in v1.
- Any change to `deduct_recipe_ingredients`, `KitchenDisplay.tsx`'s ready-transition handlers, or KDS station routing — the whole point of the $0-component design is that **zero** changes are needed there; bundle components are indistinguishable from ordinary order items to that entire code path.
- Any change to `fn_close_restaurant_bill` — verified it already handles this correctly with no modification (see Backend section, "No changes needed" note).

**Scope decision requiring human confirmation — QR bundle ordering:**
This spec recommends bundles be **browsable but not orderable** via the QR self-service menu in this first pass. Rationale: course-choice UI (N single-select pickers + a party-size input + validation) is meaningfully harder to do well on a small mobile screen under `QRCart.tsx`'s existing constraints than in a staff-operated screen, and every other complex, multi-step operation added to this vertical so far (table transfer, bill split, waitlist seating) has shipped staff-only first. `get_public_menu` is extended to *list* bundles (name, price, course structure, eligible items) so the QR menu can display "Family Feast — $18/guest" as a browsable menu entry with an "ask your waiter" affordance, but `QRCart.tsx` and `qr_place_order` are **not** touched — no anonymous customer can call `add_bundle_to_order` in this pass (it has no public grant path, unlike `qr_place_order`, and is designed exclusively for the authenticated-staff `current_tenant_id()` check). **This is a recommendation, not a settled decision** — flagged for the human reviewer to confirm or override before implementation.

**RESOLVED 2026-07-08:** the project owner has confirmed QR self-service bundle ordering IS in scope — a QR customer must be able to browse, configure (party size + course choices), and check out a bundle themselves, in the same cart/checkout flow as regular menu items. The recommendation above (browse-only) is superseded for the ordering question but its underlying `get_public_menu` browse extension (bundles/bundle_courses/bundle_course_items keys, already specified above) remains exactly as designed and is now also the data source for the ordering UI, not just display. Full design: see **"Addendum: QR Self-Service Bundle Ordering"** at the end of this document.

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

**Superseded 2026-07-08:** the "no ordering capability" line above no longer holds — see the Addendum at the end of this document. The `bundles`/`bundle_courses`/`bundle_course_items` keys specified here are unchanged in shape and are now consumed by both the display-only "Combos" listing described above *and* the new `QRBundleDetail.tsx` ordering screen; no second query or second RPC extension was needed for browsing versus ordering, since the same `get_public_menu` payload already carries everything ordering needs (course structure, eligible items, price).

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
- The QR-bundle-ordering deferral (Scope section) is the one open decision in this spec requiring explicit human sign-off before implementation; everything else reflects the prior brainstorm's settled architecture plus this pass's worked-out technical details. **RESOLVED 2026-07-08 — see the Addendum below.** With this resolved, every decision in this spec (staff ordering + QR ordering) is now settled; nothing remains open pending human confirmation.
- The migration file path/number above (`20260708_000058_preset_order_bundles.sql`) now also carries the QR-ordering additions from the Addendum below (the extended `qr_place_order` function and, if the project owner wants it split out, an optional immediately-following migration) — see the Addendum's own Implementation Notes for the exact delta.

---

# Addendum: QR Self-Service Bundle Ordering

**Date:** 2026-07-08
**Status:** Draft — extends the approved design above with a decision the project owner has now made explicitly: **QR customers order bundles themselves**, not staff-only. Everything in the body of this document (staff ordering via `BundleOrderModal` + `add_bundle_to_order`, admin CRUD, data model) stays exactly as designed and continues to ship. This Addendum is additive: a second, independent ordering path into the same data model, for the anonymous QR customer.

## Summary of the decision

A QR customer browsing the digital menu must be able to see a bundle (e.g. "Family Feast — $18/guest"), open it, set a party size, choose one item per course, add it to their cart alongside regular dishes, and check out — all without staff involvement — through the existing `qr_place_order` anonymous RPC path, exactly as regular menu items already work via `QRCart.tsx` today.

## Backend

### Decision: extend `qr_place_order`'s `p_items`, not a new RPC

Two options were considered:

- **(a) Extend `qr_place_order`'s `p_items` array** so each element is either a regular item (`{menu_item_id, quantity, modifier_ids, notes}`) or a bundle-add (`{bundle_id, party_size, course_selections}`), distinguished structurally by which key is present (`? 'bundle_id'`), with the existing loop body branching to handle both. One RPC call, one transaction, one `table_orders` find-or-create, one `order_flow` resolution — shared by both kinds of cart lines.
- **(b) A separate new anonymous RPC** (e.g. `qr_place_bundle_order`), structurally parallel to `qr_place_order`.

**Chosen: (a).** Reasons:
1. `QRCart.tsx` is a single cart with a single "Place Order" button/action (see `handlePlaceOrder` in the existing file) — a customer ordering "2 Hummus + 1 Family Feast" expects one tap, one confirmation, one atomic order. Two RPCs would mean either two round-trips (non-atomic — the regular items could succeed while the bundle fails, or vice versa, leaving a half-placed order with no clean way to communicate that to the customer) or the frontend orchestrating its own two-phase commit, which this codebase has no precedent for and shouldn't invent here.
2. Option (b) would duplicate `qr_place_order`'s tenant-resolution (`SELECT tenant_id FROM restaurant_tables ...`) and its `table_orders` find-or-create-with-`order_flow`-resolution block (including the `unique_violation` race-recovery `BEGIN/EXCEPTION` block) verbatim. That logic already has one subtle invariant baked in (the `table_orders_one_open_per_table` unique index added in migration `20260707_000057`) that a second, independently-written copy could easily get wrong or drift from over time.
3. Every course-selection validation rule (`bundle_not_found`, `item_not_eligible_for_course`, `item_no_longer_available`, etc.) is copied identically from `add_bundle_to_order` regardless of which option is chosen — that duplication is unavoidable structurally (the QR RPC has no `current_tenant_id()` to lean on and must re-derive tenant from `p_table_id`, so it cannot simply call `add_bundle_to_order` internally either). Choosing (a) at least avoids *also* duplicating the order-shell/order-flow logic on top of that.

### `p_items` shape — extended

Each element of `p_items` is now one of two shapes, and the RPC's per-element loop branches on `jsonb ? 'bundle_id'`:

```json
// Regular item (unchanged from the order-item-integrity spec)
{ "menu_item_id": "uuid", "quantity": 2, "modifier_ids": ["uuid"], "notes": "no onions" }

// Bundle-add (new)
{
  "bundle_id": "uuid",
  "party_size": 4,
  "course_selections": [
    { "bundle_course_id": "uuid", "menu_item_id": "uuid" },
    { "bundle_course_id": "uuid", "menu_item_id": "uuid" }
  ]
}
```

### Full modified `qr_place_order` function body

Replaces the function defined in `supabase/migrations/20260707_000057_order_item_integrity.sql` in full (`CREATE OR REPLACE FUNCTION`). The regular-item branch is copied verbatim from the existing function (no behavior change); the bundle branch re-implements `add_bundle_to_order`'s exact validation sequence (bundle lookup/active check, required-course-count check, per-course eligibility + live-active re-check, duplicate/unknown-course rejection) against the tables from the main spec (`restaurant_bundles`, `restaurant_bundle_courses`, `restaurant_bundle_course_items`) and then either queues pending-order items (`waiter_confirm`) or inserts real `restaurant_order_items` rows (`direct`) using the same `$0`-component-plus-one-charge-line pricing architecture as `add_bundle_to_order`:

```sql
CREATE OR REPLACE FUNCTION qr_place_order(p_table_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id           uuid;
  v_order_id            uuid;
  v_order_flow          text;
  v_default_flow        text;
  v_item                jsonb;
  v_menu_item_id        uuid;
  v_menu_item_name      text;
  v_base_price          numeric;
  v_quantity            integer;
  v_mod_id              text;
  v_mod_name            text;
  v_mod_price           numeric;
  v_line_price          numeric;
  v_line_modifiers      jsonb;
  v_pending_items       jsonb := '[]'::jsonb;
  v_valid_count         integer := 0;
  -- Bundle-add handling (added for QR self-service bundle ordering)
  v_bundle_id           uuid;
  v_party_size          integer;
  v_course_selections   jsonb;
  v_bundle_name         text;
  v_price_per_guest     numeric;
  v_bundle_active       boolean;
  v_required_course_ids uuid[];
  v_matched_course_ids  uuid[];
  v_bsel                jsonb;
  v_bcourse_id          uuid;
  v_bmenu_item_id       uuid;
  v_bcourse_slot        text;
  v_bitem_name          text;
  v_bitem_active        boolean;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM restaurant_tables WHERE id = p_table_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'table_not_found';
  END IF;

  SELECT id, order_flow INTO v_order_id, v_order_flow
    FROM table_orders WHERE table_id = p_table_id AND status = 'open' LIMIT 1;

  IF v_order_id IS NULL THEN
    SELECT default_order_flow INTO v_default_flow FROM restaurant_settings WHERE tenant_id = v_tenant_id;
    v_order_flow := COALESCE(v_default_flow, 'waiter_confirm');
    BEGIN
      INSERT INTO table_orders (tenant_id, table_id, status, current_course, order_flow)
      VALUES (v_tenant_id, p_table_id, 'open', 'appetizers', v_order_flow)
      RETURNING id INTO v_order_id;
    EXCEPTION WHEN unique_violation THEN
      -- A concurrent call won the race and already created the open order for this table.
      SELECT id, order_flow INTO v_order_id, v_order_flow
        FROM table_orders WHERE table_id = p_table_id AND status = 'open' LIMIT 1;
    END;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    ------------------------------------------------------------------
    -- Bundle-add branch: this element carries `bundle_id` instead of
    -- `menu_item_id`. Validation mirrors add_bundle_to_order exactly
    -- (same table lookups, same exception names), but the resulting
    -- rows are queued/inserted through THIS function's existing
    -- order_flow branch rather than a second RPC duplicating it.
    ------------------------------------------------------------------
    IF v_item ? 'bundle_id' THEN
      v_bundle_id := NULLIF(v_item->>'bundle_id', '')::uuid;
      v_party_size := (v_item->>'party_size')::int;
      v_course_selections := COALESCE(v_item->'course_selections', '[]'::jsonb);

      IF v_bundle_id IS NULL THEN
        RAISE EXCEPTION 'malformed_bundle_item';
      END IF;

      IF v_party_size IS NULL OR v_party_size <= 0 THEN
        RAISE EXCEPTION 'invalid_party_size: %', v_party_size;
      END IF;

      SELECT name, price_per_guest_usd, is_active
        INTO v_bundle_name, v_price_per_guest, v_bundle_active
        FROM restaurant_bundles
        WHERE id = v_bundle_id AND tenant_id = v_tenant_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'bundle_not_found: %', v_bundle_id;
      END IF;

      IF NOT v_bundle_active THEN
        RAISE EXCEPTION 'bundle_inactive: %', v_bundle_id;
      END IF;

      SELECT array_agg(id) INTO v_required_course_ids
        FROM restaurant_bundle_courses WHERE bundle_id = v_bundle_id;

      IF v_required_course_ids IS NULL OR array_length(v_required_course_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'bundle_has_no_courses: %', v_bundle_id;
      END IF;

      IF jsonb_array_length(v_course_selections) <> array_length(v_required_course_ids, 1) THEN
        RAISE EXCEPTION 'incomplete_course_selection: expected % course(s), got %',
          array_length(v_required_course_ids, 1), jsonb_array_length(v_course_selections);
      END IF;

      v_matched_course_ids := '{}';

      FOR v_bsel IN SELECT * FROM jsonb_array_elements(v_course_selections)
      LOOP
        v_bcourse_id    := NULLIF(v_bsel->>'bundle_course_id', '')::uuid;
        v_bmenu_item_id := NULLIF(v_bsel->>'menu_item_id', '')::uuid;

        IF v_bcourse_id IS NULL OR v_bmenu_item_id IS NULL THEN
          RAISE EXCEPTION 'malformed_course_selection';
        END IF;

        IF NOT (v_bcourse_id = ANY(v_required_course_ids)) THEN
          RAISE EXCEPTION 'course_not_in_bundle: %', v_bcourse_id;
        END IF;

        IF v_bcourse_id = ANY(v_matched_course_ids) THEN
          RAISE EXCEPTION 'duplicate_course_selection: %', v_bcourse_id;
        END IF;

        -- Eligibility: the chosen item must actually be configured for this slot.
        IF NOT EXISTS (
          SELECT 1 FROM restaurant_bundle_course_items
          WHERE bundle_course_id = v_bcourse_id AND menu_item_id = v_bmenu_item_id
        ) THEN
          RAISE EXCEPTION 'item_not_eligible_for_course: item % not eligible for course %', v_bmenu_item_id, v_bcourse_id;
        END IF;

        -- Re-resolve the item live — never trust client-supplied name, and
        -- catches the item having been deactivated since the customer's
        -- browser fetched get_public_menu.
        SELECT name, is_active INTO v_bitem_name, v_bitem_active
          FROM restaurant_menu_items
          WHERE id = v_bmenu_item_id AND tenant_id = v_tenant_id;

        IF NOT FOUND OR NOT v_bitem_active THEN
          RAISE EXCEPTION 'item_no_longer_available: %', v_bmenu_item_id;
        END IF;

        SELECT course INTO v_bcourse_slot FROM restaurant_bundle_courses WHERE id = v_bcourse_id;

        IF v_order_flow = 'waiter_confirm' THEN
          v_pending_items := v_pending_items || jsonb_build_object(
            'menu_item_id', v_bmenu_item_id,
            'name', v_bitem_name,
            'quantity', v_party_size,
            'unit_price', 0,
            'modifiers', '[]'::jsonb,
            'notes', '',
            'course', v_bcourse_slot,
            'bundle_id', v_bundle_id
          );
        ELSE
          INSERT INTO restaurant_order_items (
            tenant_id, order_id, menu_item_id, product_name, quantity, unit_price,
            modifiers, course, status, bundle_id
          ) VALUES (
            v_tenant_id, v_order_id, v_bmenu_item_id, v_bitem_name, v_party_size, 0,
            '[]'::jsonb, v_bcourse_slot, 'pending', v_bundle_id
          );
        END IF;

        v_matched_course_ids := array_append(v_matched_course_ids, v_bcourse_id);
      END LOOP;

      -- Belt-and-suspenders, mirrors add_bundle_to_order's equivalent check.
      IF array_length(v_matched_course_ids, 1) <> array_length(v_required_course_ids, 1) THEN
        RAISE EXCEPTION 'incomplete_course_selection';
      END IF;

      -- The one charge line — same $0-components-plus-one-charge-line
      -- pricing architecture as add_bundle_to_order. In the waiter_confirm
      -- branch this is queued into v_pending_items instead of inserted
      -- directly; see the "PendingOrderItem.bundle_id" note below for why
      -- that queued charge line still needs its bundle_id to survive
      -- through confirmPendingOrder.
      IF v_order_flow = 'waiter_confirm' THEN
        v_pending_items := v_pending_items || jsonb_build_object(
          'menu_item_id', NULL,
          'name', 'Bundle: ' || v_bundle_name,
          'quantity', v_party_size,
          'unit_price', v_price_per_guest,
          'modifiers', '[]'::jsonb,
          'notes', '',
          'course', 'mains',
          'bundle_id', v_bundle_id
        );
      ELSE
        INSERT INTO restaurant_order_items (
          tenant_id, order_id, menu_item_id, product_name, quantity, unit_price,
          modifiers, course, status, bundle_id, sent_at
        ) VALUES (
          v_tenant_id, v_order_id, NULL, 'Bundle: ' || v_bundle_name, v_party_size, v_price_per_guest,
          '[]'::jsonb, 'mains', 'served', v_bundle_id, now()
        );
      END IF;

      v_valid_count := v_valid_count + 1;
      CONTINUE;
    END IF;

    ------------------------------------------------------------------
    -- Regular item branch — unchanged from migration 20260707_000057.
    ------------------------------------------------------------------
    v_menu_item_id := NULL;
    SELECT id, name, base_price_usd INTO v_menu_item_id, v_menu_item_name, v_base_price
      FROM restaurant_menu_items
      WHERE id = (v_item->>'menu_item_id')::uuid AND tenant_id = v_tenant_id AND is_active = true;

    IF v_menu_item_id IS NULL THEN
      CONTINUE; -- forged/stale/inactive menu_item_id — skip, don't trust client data
    END IF;

    v_quantity := (v_item->>'quantity')::int;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      CONTINUE; -- non-positive/malformed quantity — skip, don't trust client data
    END IF;

    v_line_price := v_base_price;
    v_line_modifiers := '[]'::jsonb;

    IF v_item ? 'modifier_ids' THEN
      FOR v_mod_id IN SELECT * FROM jsonb_array_elements_text(v_item->'modifier_ids')
      LOOP
        v_mod_name := NULL;
        SELECT name, price_delta INTO v_mod_name, v_mod_price
          FROM restaurant_modifiers
          WHERE id = v_mod_id::uuid AND tenant_id = v_tenant_id;
        IF v_mod_name IS NOT NULL THEN
          v_line_price := v_line_price + v_mod_price;
          v_line_modifiers := v_line_modifiers || jsonb_build_object('name', v_mod_name, 'price_delta', v_mod_price);
        END IF;
      END LOOP;
    END IF;

    v_valid_count := v_valid_count + 1;

    IF v_order_flow = 'waiter_confirm' THEN
      v_pending_items := v_pending_items || jsonb_build_object(
        'menu_item_id', v_menu_item_id,
        'name', v_menu_item_name,
        'quantity', v_quantity,
        'unit_price', v_line_price,
        'modifiers', v_line_modifiers,
        'notes', COALESCE(v_item->>'notes', ''),
        'course', 'mains',
        'bundle_id', NULL
      );
    ELSE
      INSERT INTO restaurant_order_items (
        tenant_id, order_id, menu_item_id, product_name, quantity, unit_price, modifiers, course, status, notes
      ) VALUES (
        v_tenant_id, v_order_id, v_menu_item_id, v_menu_item_name,
        v_quantity, v_line_price, v_line_modifiers, 'mains', 'pending',
        NULLIF(v_item->>'notes', '')
      );
    END IF;
  END LOOP;

  IF v_valid_count = 0 THEN
    RAISE EXCEPTION 'no_valid_items';
  END IF;

  IF v_order_flow = 'waiter_confirm' THEN
    INSERT INTO restaurant_pending_orders (tenant_id, table_id, table_order_id, items, status)
    VALUES (v_tenant_id, p_table_id, v_order_id, v_pending_items, 'pending');
    RETURN jsonb_build_object('mode', 'pending', 'order_id', v_order_id);
  ELSE
    RETURN jsonb_build_object('mode', 'direct', 'order_id', v_order_id);
  END IF;
END;
$$;
```

**Deliberate asymmetry — skip vs. raise:** a forged/stale `menu_item_id` on a *regular* item line is silently skipped (`CONTINUE`, unchanged existing behavior) — harmless, since the customer's menu view may simply be a few seconds stale and the rest of their order still goes through. A bundle-add validation failure instead **raises**, aborting the entire `qr_place_order` call (nothing is inserted, not even the customer's other, valid cart lines — the whole call is one transaction). This is intentional, not an oversight: a bundle represents a flat per-guest charge tied to a specific set of course choices; silently dropping it (as if it were a stale hummus) could mean the kitchen either serves an incomplete/wrong bundle or the guest is charged for one that never got recorded. Failing the whole checkout loudly, so the customer can remove the stale bundle line and retry, is the safer failure mode — see Error Handling below for how this surfaces in `QRCart.tsx`.

**No `FOR UPDATE` lock added.** `add_bundle_to_order` (the staff RPC) takes `SELECT ... FOR UPDATE` on `table_orders` because it operates against an *existing* order and needs to serialize concurrent adds to it. `qr_place_order` already didn't take that lock for its find-or-create path (accepted low-stakes race, per the order-item-integrity spec) — the bundle branch doesn't change that risk profile (worst case: two near-simultaneous QR bundle-adds to the same brand-new order both trigger the order-shell race already handled by the existing `unique_violation` recovery block) and doesn't introduce a new one. Not hardened further here, consistent with the existing spec's stated trade-off.

### Required corollary change: `PendingOrderItem.bundle_id` and `confirmPendingOrder`

For tenants configured with `order_flow = 'waiter_confirm'` (the `COALESCE` default when nothing is configured), a QR bundle-add doesn't reach `restaurant_order_items` immediately — its component rows and charge line are queued into `restaurant_pending_orders.items` (the `v_pending_items` JSONB array above) and only become real rows when staff later confirm the pending order. For those rows to carry the correct `bundle_id` tag (needed for the revenue/consumption queries described in the main spec's Executive Summary), `bundle_id` must survive the pending → confirmed transition. Two small changes, not covered by the RPC alone:

1. **`src/types/restaurant.ts`** — `PendingOrderItem` gains a `bundle_id: string | null;` field (every element the RPC now queues includes this key, including regular items, which pass `NULL`).
2. **`confirmPendingOrder`** — both existing implementations (`src/hooks/useRestaurantOrder.ts`'s `confirmPendingOrder`, and `WaiterInterface.tsx`'s own inline `handleConfirmPendingOrder`, per the order-item-integrity spec's note that these are pre-existing parallel implementations) must add `bundle_id: item.bundle_id ?? null` to the `restaurant_order_items` insert alongside the already-fixed `menu_item_id: item.menu_item_id`. Without this, a QR-ordered bundle under `waiter_confirm` would silently lose its `bundle_id` tag the moment staff hit "Confirm" — the components would still deduct inventory correctly (real `menu_item_id` + `quantity` is unaffected), but bundle-level revenue reporting (`SUM(unit_price * quantity) WHERE bundle_id = X`) would undercount, and the $0 components would look like ordinary free items with no traceable bundle origin.

This is the one piece of this Addendum that touches a file outside the QR customer-facing surface — flagged clearly here because it's easy to miss (the bug would be silent, not a crash) and is a hard requirement for the `waiter_confirm` order-flow path to work correctly with bundles at all.

## Frontend

### `src/types/restaurant.ts` additions

`get_public_menu`'s three new keys (`bundles`, `bundle_courses`, `bundle_course_items` — already specified in the main spec's Backend section, unchanged in shape) need corresponding TypeScript types on `QRMenuData`. They're narrower projections than the full `RestaurantBundle`/`RestaurantBundleCourse` types (no `tenant_id`, `is_active`, meal-time flags — mirroring how `QRMenuTenant` is already a narrower projection of the full tenant row for the same reason: `get_public_menu`'s `jsonb_build_object` only projects the fields the public menu needs):

```ts
export interface QRMenuBundle {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  price_per_guest_usd: number;
  sort_order: number;
}

export interface QRMenuBundleCourse {
  id: string;
  bundle_id: string;
  course: CourseType;
  label: string;
  sort_order: number;
}

export interface QRMenuData {
  tenant: QRMenuTenant;
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  modifier_groups: RestaurantModifierGroup[];
  modifiers: RestaurantModifier[];
  item_modifier_links: Array<{ menu_item_id: string; modifier_group_id: string }>;
  bundles: QRMenuBundle[];
  bundle_courses: QRMenuBundleCourse[];
  bundle_course_items: RestaurantBundleCourseItem[]; // exact shape match, reused as-is
}
```

Cart-side, a bundle-in-cart needs its own shape — it has no single `menu_item_id`, no single price until party size is set, and carries a set of course selections rather than a modifier map:

```ts
export interface QRCartBundleSelection {
  bundleCourseId: string;
  menuItemId: string;
  itemName: string; // for cart-line display without re-joining menuData
}

export interface QRCartBundleItem {
  cartKey: string;          // generated on add (crypto.randomUUID()) — see rationale below
  bundleId: string;
  bundleName: string;
  pricePerGuestUsd: number;
  partySize: number;
  courseSelections: QRCartBundleSelection[];
  totalPrice: number;       // pricePerGuestUsd * partySize, computed on add
}
```

`QRCartItem` itself is **unchanged** — regular items keep their existing shape and dedup-by-`menuItemId`+modifier-key behavior exactly as today.

### `useCart.ts` — new parallel array, not a discriminated union

**Decision:** `useCart()` gains a second, parallel array (`bundleItems: QRCartBundleItem[]`) alongside the existing `items: QRCartItem[]`, rather than converting `items` into a discriminated union of `{kind: 'item'} | {kind: 'bundle'}`. Reasoning: `QRCart.tsx`'s existing item-rendering block (quantity stepper, modifier summary, remove button, `getModifierKey`-based dedup) is written entirely against `QRCartItem`'s flat shape; forcing every consumer to narrow a union just to keep rendering regular items unchanged would touch more surface area for no behavioral gain. A bundle line is visually and behaviorally different enough (no quantity stepper — see below — different card content) that it renders as its own block in `QRCart.tsx` regardless of whether the underlying state is a union or a second array.

```ts
interface UseCartResult {
  items: QRCartItem[];
  bundleItems: QRCartBundleItem[];
  totalItems: number;   // regular item quantities + one count per bundle line (see below)
  totalPrice: number;   // sum of both arrays' totalPrice
  addItem: (...) => void;              // unchanged
  updateQuantity: (...) => void;       // unchanged
  removeItem: (...) => void;           // unchanged
  clearCart: () => void;               // extended to also clear bundleItems
  addBundleItem: (
    bundle: QRMenuBundle,
    partySize: number,
    courseSelections: QRCartBundleSelection[],
  ) => void;
  removeBundleItem: (cartKey: string) => void;
}
```

- **`addBundleItem`** always appends a new line (no dedup-and-merge like `addItem`'s quantity-increment behavior) — a customer adding "Family Feast for 4" twice with different course choices, or even identical ones, gets two distinct cart lines, each independently removable. Merging two bundle-adds into one would require merging or picking between two different `course_selections`, which has no sensible resolution; two lines is simpler and correct.
- **No `updatePartySize`/in-place bundle edit.** Consistent with the main spec's already-established scope boundary ("Editing/re-configuring an in-flight bundle-add" is out of scope for staff too) — a QR customer who wants to change a bundle's party size or course choice removes the line (`removeBundleItem`) and re-adds it via `QRBundleDetail` again. No partial-edit affordance is designed for either ordering path.
- **`totalItems` counts each bundle line as 1**, not `partySize`. Rationale: the cart badge ("3 items") should read as "3 things you're ordering," matching how a customer thinks about their cart — "Family Feast for 4" is one decision/one line, not four. `totalPrice` still correctly sums the full `partySize`-scaled amount from each bundle line; only the *count* badge treats a bundle as one unit.
- **`cartKey` generation:** `crypto.randomUUID()` (available in all modern mobile browsers this QR menu targets; no new dependency). Used only as a React key / removal handle — never sent to the server (the RPC payload has no concept of a cart key, only `bundle_id` + selections).

### Browsing: "Combos" section in `QRMenuHome.tsx`

A new section, `BundlesSection`, added structurally parallel to the existing `FeaturedSection`/`chefPicks` blocks (same horizontal-scroll pattern, same `!selectedCategoryId`-gated visibility — bundles aren't category-filtered, so they only make sense on the unfiltered "All" view, matching how Featured/Chef's Picks already behave):

```tsx
{!selectedCategoryId && menuData.bundles.length > 0 && (
  <BundlesSection bundles={menuData.bundles} courses={menuData.bundle_courses} lang={lang} onSelectBundle={onSelectBundle} />
)}
```

Placed after the existing `FeaturedSection`/Chef's Picks blocks and before `CategoryPills`, so bundles read as "a third curated row" rather than competing with the item grid. `BundlesSection` renders a `BundleCard` per bundle (new component, visually a simplified `ItemCard` variant — no photo support in v1 since `restaurant_bundles` has no `photo_url` column, per the main spec's data model — showing: 🎁 emoji badge, name, price per guest, and a one-line course-count summary e.g. "3 courses" derived from `courses.filter(c => c.bundle_id === bundle.id).length`). Tapping a `BundleCard` calls `onSelectBundle(bundle)`, a new prop threaded from `QRMenuHome` up to `QRMenuPage.tsx`, mirroring `onSelectItem` exactly.

### New screen: `QRItemDetail.tsx`'s course-choice sibling, `QRBundleDetail.tsx`

New component, structurally mirroring `QRItemDetail.tsx`'s bottom-sheet layout (`fixed inset-0`, scrollable content + fixed bottom action bar) but replacing single-item modifier groups with per-course single-select pickers:

```tsx
interface QRBundleDetailProps {
  bundle: QRMenuBundle;
  courses: QRMenuBundleCourse[];         // pre-filtered by QRMenuPage to this bundle's courses
  courseItems: RestaurantBundleCourseItem[]; // pre-filtered to this bundle's courses
  menuItems: RestaurantMenuItem[];       // full menu, for name/price/active lookups
  lang: 'en' | 'ar';
  onClose: () => void;
  onAddToCart: (bundle: QRMenuBundle, partySize: number, selections: QRCartBundleSelection[]) => void;
}
```

- **Header:** bundle name, price per guest, close button — same visual treatment as `QRItemDetail`'s title block (no hero image, since bundles have no `photo_url`).
- **Party size stepper:** same +/− stepper component/visual as `QRItemDetail`'s quantity stepper, **defaulting to 1** (not `table.seats` like the staff `BundleOrderModal` — the QR flow has no reliable table-covers data available client-side without a new query, and defaulting low is the safer failure mode: better to make a party of 6 tap + five times than to silently overcharge a party of 2 who got a stale default of 6). Floors at 1, no upper bound (matches `add_bundle_to_order`'s server-side check, which only rejects `<= 0`).
- **One section per course** (sorted by `sort_order`), each showing the course's `label` (e.g. "Choose your appetizer") and its eligible items — `menuItems` filtered to `courseItems` entries for that `course.id`, **further filtered to `is_active === true`** (client-side mirror of the server's live re-check; an item deactivated after the customer's browser fetched `get_public_menu` will still be caught server-side, see Error Handling) — rendered as single-select pill buttons, visually identical to `QRItemDetail`'s `max_selections === 1` modifier-group radio pattern (tap selects; radios don't un-select to empty, since every course is required, matching `QRItemDetail`'s existing required-group behavior).
- **Empty-course guard:** if a course's filtered eligible-items list is empty (every configured item is currently inactive), that section renders a muted "Not available right now" line instead of pills, and the Confirm button is disabled — the same client-side backstop `BundleOrderModal` uses on the staff side.
- **Running total:** `price_per_guest_usd × partySize`, updates live as the stepper changes — same visual treatment as `QRItemDetail`'s `totalPrice` display in the fixed bottom bar.
- **Confirm ("Add to Order") button:** disabled until every course section has exactly one selection and `partySize >= 1` (mirrors `QRItemDetail`'s `allRequiredSelected`-gated button, generalized from "every required modifier group" to "every course"). On tap: calls `onAddToCart(bundle, partySize, selections)`, then `onClose()` — mirroring `QRItemDetail`'s `handleAdd` exactly (`onAddToCart` then `onClose`).

### `QRMenuPage.tsx` wiring

- `MenuView` gains `'bundle-detail'` alongside the existing `'splash' | 'menu' | 'item-detail' | 'cart' | 'success'`.
- New state: `selectedBundle: QRMenuBundle | null`.
- New handler, structurally identical to the existing `handleSelectItem`/`handleAddToCart` pair:
  ```ts
  const handleSelectBundle = (bundle: QRMenuBundle) => {
    setSelectedBundle(bundle);
    setView('bundle-detail');
  };
  const handleAddBundleToCart = (bundle: QRMenuBundle, partySize: number, selections: QRCartBundleSelection[]) => {
    addBundleItem(bundle, partySize, selections);
    setView('menu');
  };
  ```
- `useCart()` destructuring extended to pull `bundleItems`, `addBundleItem`, `removeBundleItem` alongside the existing `items`, `totalItems`, `totalPrice`, `addItem`, `updateQuantity`, `removeItem`, `clearCart`.
- `<QRBundleDetail>` rendered inside an `AnimatePresence` block when `view === 'bundle-detail' && selectedBundle`, passing `data.bundle_courses.filter(c => c.bundle_id === selectedBundle.id)` and `data.bundle_course_items.filter(ci => courseIdsForThisBundle.includes(ci.bundle_course_id))` — same filter-on-render pattern `QRItemDetail` already uses for `item_modifier_links`/`modifier_groups`.
- `<QRCart>` gains `bundleItems={bundleItems}` and `onRemoveBundleItem={(cartKey) => removeBundleItem(cartKey)}` props.
- `<QRMenuHome>` gains `onSelectBundle={handleSelectBundle}` prop (its `menuData` prop already carries `.bundles`/`.bundle_courses`, no new prop needed for browsing).

### `QRCart.tsx` — checkout payload + bundle cart lines

**Payload construction**, matching the Backend section's chosen `p_items` shape — regular items and bundle-adds concatenated into one array for one `qr_place_order` call:

```ts
const handlePlaceOrder = async () => {
  if (items.length === 0 && bundleItems.length === 0) return;
  setPlacing(true);
  setPlaceError(null);
  try {
    const regularPayload = items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      modifier_ids: Object.values(item.selectedModifiers).flat(),
      notes: item.notes || undefined,
    }));
    const bundlePayload = bundleItems.map((b) => ({
      bundle_id: b.bundleId,
      party_size: b.partySize,
      course_selections: b.courseSelections.map((cs) => ({
        bundle_course_id: cs.bundleCourseId,
        menu_item_id: cs.menuItemId,
      })),
    }));
    const payload = [...regularPayload, ...bundlePayload];

    const { data, error } = (await supabase.rpc('qr_place_order', {
      p_table_id: tableId,
      p_items: payload,
    })) as { data: { mode: 'direct' | 'pending'; order_id: string } | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    if (!data) throw new Error('qr_place_order returned no data');

    onSuccess(data.order_id.slice(-6).toUpperCase(), data.mode);
  } catch (err) {
    console.error('[QRCart] place order error:', err);
    setPlaceError(mapPlaceOrderError(err)); // see Error Handling below
  } finally {
    setPlacing(false);
  }
};
```

**New props:** `bundleItems: QRCartBundleItem[]`, `onRemoveBundleItem: (cartKey: string) => void`.

**Rendering:** bundle cart lines render in their own block (visually distinct card — 🎁 badge, bundle name, "for {partySize} guests" subtitle, list of chosen course items as a one-line summary e.g. "Fattoush, Grilled Chicken, Baklava", price, remove button) placed above or below the existing regular-item list (ordering is a cosmetic choice at implementation time — either is fine since both feed the same combined total). **No quantity stepper on a bundle cart line** — per the `useCart.ts` design decision above, party size isn't adjustable in-cart; the remove button is the only control. The existing footer (`Total (N items)`, grand total, Place Order button, error banner) is unchanged in structure — its inputs (`totalPrice`, item count) already come from the combined `useCart` totals once `QRMenuPage.tsx` passes them through.

## Error Handling & Edge Cases (QR-specific additions)

Extends the main spec's Error Handling table with cases specific to the QR self-service path. The existing table's rows (server-side re-validation of stale/deactivated items, `FOR UPDATE` locking, forged-payload rejection) already describe the RPC-level backstops this reuses; these rows describe what the **QR customer sees** when they fire.

| Case | Handling |
|---|---|
| A bundle goes inactive (or is deleted) between the customer opening the QR menu and hitting "Place Order" | `qr_place_order` re-resolves the bundle fresh inside the transaction (never trusts the client's cached `get_public_menu` snapshot) and raises `bundle_not_found`/`bundle_inactive`. Because the whole RPC call is one transaction, **nothing is inserted for that checkout at all** — not even the customer's other, valid regular-item lines (see the "Deliberate asymmetry" note in Backend). `QRCart.tsx` shows the mapped bundle-error banner (see below); the bundle line stays in the cart so the customer can see and remove it, then retry. |
| A course slot's only eligible item is deactivated between browse-time and checkout | Same mechanism as above — `item_not_eligible_for_course` (if the item was fully unlinked from the course) or `item_no_longer_available` (if merely deactivated) aborts the transaction. `QRBundleDetail` already filters to `is_active` items live at the moment the customer opens the bundle screen, so this specifically covers the narrower race window between opening `QRBundleDetail` (or even between adding to cart) and tapping "Place Order" in `QRCart.tsx` — expected to be rare but not preventable client-side without a live subscription, which is out of scope here (this repo doesn't currently give the QR menu a realtime channel — it's a fetch-once-per-session `get_public_menu` call). |
| `qr_place_order` raises a bundle-related exception (`bundle_not_found`, `bundle_inactive`, `bundle_has_no_courses`, `item_not_eligible_for_course`, `item_no_longer_available`, `incomplete_course_selection`, `invalid_party_size`, `malformed_bundle_item`, `duplicate_course_selection`, `course_not_in_bundle`) | `QRCart.tsx`'s catch block gains a small `mapPlaceOrderError(err)` helper that pattern-matches these known bundle-prefixed codes and returns one shared, friendlier message: *"One of your combo selections is no longer available — please remove it from your cart and try again."* — distinct from the existing generic *"Something went wrong placing your order…"* message, so a customer isn't left guessing whether the whole order is broken or just their bundle. Any other/unrecognized error message falls through to today's existing generic copy, unchanged. This is a string-matching mapping only (the RPC returns a plain `TEXT` exception message via PostgREST, not a structured error code) — acceptable given this repo's established convention of RPC errors as plain exception strings throughout (`no_valid_items`, `table_not_found`, etc. are handled the same way today). |
| Customer's cart has both regular items and a now-broken bundle | Per the "one transaction" design, the entire order fails together — the regular items are **not** partially placed. This is called out explicitly as the accepted trade-off of choosing backend option (a): the alternative (two separate RPC calls) would let the regular items succeed independently, but at the cost of duplicating `qr_place_order`'s tenant/order-shell logic in a second function and losing single-tap atomicity for the common case (which matters far more often than the rare deactivation race). The customer's fix is simple and immediate: remove the flagged bundle line, tap Place Order again — their regular items go through cleanly on the retry since nothing was consumed by the failed attempt (the whole transaction rolled back). |
| `party_size` left at 0, or a non-integer somehow reaches the payload | Blocked client-side (`QRBundleDetail`'s stepper floors at 1, Confirm disabled if a course lacks a selection) and backstopped server-side (`invalid_party_size` — same defense-in-depth posture as the staff RPC and as `qr_place_order`'s existing `quantity <= 0` check for regular items). |
| Customer adds the same bundle twice with different course choices (e.g., two different "Family Feast" configurations for two ends of a shared table) | Explicitly allowed — `addBundleItem` never merges (see `useCart.ts` design above). Both lines check out in the same `qr_place_order` call as two separate bundle-add elements in `p_items`, each independently validated and each producing its own set of `bundle_id`-tagged rows. |

## Testing (QR-specific additions)

Extends the main spec's Testing section. Same conventions: Vitest + Testing Library, `QRCart.test.tsx`'s `vi.mock('@/utils/supabaseClient', ...)` + `mockRpc` shape for anything hitting the RPC, `framer-motion` mocked the same way `QRCart.test.tsx` already does (`motion: new Proxy(...)`, `AnimatePresence` passthrough) for any new component that imports it.

**`QRBundleDetail.test.tsx` (new file):**
- Renders one section per course (from the `courses` prop) with that course's `label`, and lists only that course's eligible, active items (filters out inactive items and items linked to other courses).
- A course with zero eligible active items renders a disabled/empty state for that section and keeps Confirm disabled.
- Party size stepper defaults to 1, floors at 1 (cannot go below), and the running total (`price_per_guest_usd × partySize`) recomputes as it changes.
- Confirm button is disabled until every course section has a selection; becomes enabled once the last required course is filled.
- Confirm calls `onAddToCart(bundle, partySize, selections)` with one `{bundleCourseId, menuItemId, itemName}` entry per course, then calls `onClose()` — mirroring `QRItemDetail`'s existing `handleAdd` test pattern if one exists (check `QRItemDetail.test.tsx` first; if it doesn't exist yet, this establishes the pattern fresh for both).

**`QRCart.test.tsx` (extend the existing file):**
- New test: cart with both a regular item and a bundle line calls `qr_place_order` with `p_items` containing **both** shapes concatenated in one array — asserts the exact combined payload (`[{menu_item_id, quantity, modifier_ids, notes}, {bundle_id, party_size, course_selections}]`), verifying the single-atomic-call design end to end.
- New test: cart with only a bundle line (no regular items) still enables the Place Order button and calls the RPC with a `p_items` array containing just the bundle-add element.
- New test: `onRemoveBundleItem` is called with the correct `cartKey` when a bundle cart line's remove button is tapped, and the removed line disappears from the rendered cart (bundle line count/total updates accordingly).
- New test: RPC error `{ message: 'item_not_eligible_for_course: ...' }` renders the mapped bundle-specific error copy (*"One of your combo selections is no longer available…"*), not the generic fallback message — asserting `mapPlaceOrderError`'s pattern-matching behavior via the rendered banner text. A non-bundle error (e.g. `no_valid_items`, reusing the existing test's exact case) continues to render the existing generic message unchanged — regression-guards that the new mapping doesn't accidentally swallow non-bundle errors.

**`useCart.test.ts` (new file — none exists today; this establishes the first test file for the hook, covering both regular-item and new bundle-item behavior since they now share one hook):**
- `addBundleItem` appends a new line with a generated `cartKey`, correct `totalPrice = pricePerGuestUsd * partySize`.
- Adding the same bundle twice (even with identical selections) produces two separate lines, not a merged/incremented one (regression guard against accidentally reusing `addItem`'s merge-by-key behavior for bundles).
- `removeBundleItem(cartKey)` removes only the matching line.
- `totalItems` counts each bundle line as 1 regardless of `partySize`; `totalPrice` correctly sums `pricePerGuestUsd * partySize` across all bundle lines plus the existing regular-item total.
- `clearCart()` empties both `items` and `bundleItems`.

**RPC (`qr_place_order`, extended):** smoke-tested manually via the Supabase SQL Editor, same established convention as the rest of this spec (no automated SQL test harness in this repo). Manual coverage should add, on top of the existing regular-item cases already covered by the order-item-integrity spec: a cart with one bundle + one regular item under both `order_flow` values (`direct` and `waiter_confirm`); confirming a `waiter_confirm`-queued bundle via `confirmPendingOrder` and verifying the resulting `restaurant_order_items` rows carry the correct `bundle_id` (this is the one case that would silently fail without the `PendingOrderItem.bundle_id` corollary fix above — explicitly worth a manual pass); `bundle_inactive` and `item_no_longer_available` triggering a full-transaction rollback (verify via `SELECT` that zero rows were inserted, including for the cart's regular items); and the two-bundles-same-type-different-selections case.

## Implementation Notes (Addendum)

- No new tables, no new columns beyond what the main spec's migration (`20260708_000058_preset_order_bundles.sql`) already adds. This Addendum's only database change is the `CREATE OR REPLACE FUNCTION qr_place_order(...)` body above, replacing the version from `20260707_000057_order_item_integrity.sql`. It can be folded into the same `20260708_000058` migration file (appended after the `add_bundle_to_order` definition, since both need `restaurant_bundles`/`restaurant_bundle_courses`/`restaurant_bundle_course_items` to already exist earlier in the same file) or delivered as its own immediately-following migration (`20260708_000059_qr_bundle_ordering.sql`) if the project owner prefers smaller, single-purpose migration files — either is consistent with this repo's conventions; not a decision this spec needs to force.
- Frontend-only changes beyond the RPC: `src/types/restaurant.ts` (new types, `QRMenuData` extension, `PendingOrderItem.bundle_id`), `src/pages/qr-menu/useCart.ts` (bundle array + actions), `src/pages/qr-menu/QRBundleDetail.tsx` (new file), `src/pages/qr-menu/QRMenuHome.tsx` (`BundlesSection`/`BundleCard`, new prop), `src/pages/qr-menu/QRMenuPage.tsx` (new view state + handlers + prop wiring), `src/pages/qr-menu/QRCart.tsx` (payload + rendering + error mapping), `src/hooks/useRestaurantOrder.ts` and `WaiterInterface.tsx` (the `confirmPendingOrder`/`handleConfirmPendingOrder` `bundle_id` corollary fix).
- No edge function work, no redeploy needed — same as the rest of this spec, entirely client + one RPC.
- This Addendum does not change or re-open anything in the staff-ordering design (`add_bundle_to_order`, `BundleOrderModal`, admin CRUD) above — that path is untouched and ships as originally specified, independent of whether QR ordering ships in the same release.
