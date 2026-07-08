# Preset Order Bundles (Tier 2.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship preset order bundles (prix-fixe combos) end to end — schema/RPC/admin CRUD/staff ordering (already fully specified) plus QR self-service bundle ordering (resolved into scope 2026-07-08) — per `docs/superpowers/specs/2026-07-08-preset-order-bundles-design.md`.

**Architecture:** Each bundle-add writes one `$0`-priced `restaurant_order_items` row per chosen component (real `menu_item_id`, real `quantity = party_size`, so KDS/recipe-deduction need zero changes) plus one `menu_item_id = NULL` charge row (`unit_price = price_per_guest`, `quantity = party_size`), all tagged with a shared `bundle_id`. Staff order bundles via a new `add_bundle_to_order` RPC from `BundleOrderModal`; QR customers order bundles via an extended `qr_place_order` RPC (single atomic call, regular items and bundle-adds concatenated in one `p_items` array) from a new `QRBundleDetail` screen wired into the existing cart.

**Tech Stack:** React 18 + TypeScript (strict) + Vite, Supabase Postgres (PL/pgSQL RPCs, RLS), Tailwind, Vitest + Testing Library, i18next.

## Global Constraints

- TypeScript strict, `noUncheckedIndexedAccess` — no `any`; narrow `unknown`. Run `npm run typecheck` after every task.
- `npm run lint` must stay at zero warnings after every task.
- Frontend never filters by `tenant_id` in queries — RLS enforces it. The one exception already established in this schema: junction tables with no `tenant_id` column (e.g. `restaurant_bundle_course_items`) are scoped by RLS via a join, and the frontend queries them with no `.eq('tenant_id', …)` at all — same pattern as `restaurant_menu_item_modifiers`.
- Dark theme only: `bg-slate-900`/`bg-slate-950`/`bg-white/5`/`bg-white/10` backgrounds, `text-white`/`text-white/80`/`text-white/60`/`text-white/40` text, `border-white/10`/`border-white/20` borders, primary button `bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl`.
- All new UI copy uses `useTranslation()`'s `t(key, defaultValue)` pattern with an English default, matching every existing string in `WaiterInterface.tsx`/`MenuManagement.tsx` — new keys are **not** added to `src/i18n/locales/*.json` in this plan (consistent with how numerous existing keys in this codebase already render via their English fallback only; Arabic remains partially complete per `CLAUDE.md`).
- Money: USD only for bundles (`price_per_guest_usd`), matching `restaurant_bundles`' schema — no LBP column on bundles, so no dual-currency handling is needed for this feature specifically (existing dual-currency display elsewhere is untouched).
- No edge function changes, no redeploys — entirely client + two RPCs (one new: `add_bundle_to_order`; one extended: `qr_place_order`), same category as prior F&B RPC features.
- Every task ends green: `npm run typecheck` clean, relevant Vitest suite passing, full suite (`npm run test`) still at 261+ passing (261 pre-existing + new tests added by each task), before committing.
- Commit after every task (not every step) unless a step explicitly says to commit — see each task's final step.

### Migration numbering — correction to the spec

The spec's Implementation Notes say the new migration should be `20260708_000058_preset_order_bundles.sql`, numbered after `20260707_000057_order_item_integrity.sql`. **This is stale.** Two migrations have since landed on `main`: `20260708_000058_security_performance_audit.sql` and `20260708_000059_fix_close_bill_overload_ambiguity.sql`. This worktree's branch (`worktree-preset-order-bundles`) currently contains `000058` but **not** `000059` — `git merge-base --is-ancestor HEAD main` confirms this worktree's HEAD is a clean ancestor of `main`, i.e. `main` has one additional commit (`2673509c`, which added `000059`) that landed *after* this worktree branched. `000059` is real and already merged to `main` — it is simply not yet in this branch's history.

**Resolution:** the new migration in this plan is `supabase/migrations/20260708_000060_preset_order_bundles.sql` — the correct next number relative to `main`, which is what matters once this branch merges. **Before running Task 1**, merge or rebase latest `main` into this branch (`git merge main` or `git rebase main`) so `20260708_000059_fix_close_bill_overload_ambiguity.sql` is actually present on disk — otherwise `000060` would not yet have a real `000059` predecessor in this branch, and a fresh sequential replay on a new client's Supabase project would silently skip a number. This merge is a prerequisite, not part of Task 1's steps (it's a one-time `git` operation, not a code change).

---

## Task 1: Migration — schema, `add_bundle_to_order`, `get_public_menu` extension, `qr_place_order` replacement

**Files:**
- Create: `supabase/migrations/20260708_000060_preset_order_bundles.sql`

**Interfaces:**
- Produces: tables `restaurant_bundles`, `restaurant_bundle_courses`, `restaurant_bundle_course_items`; column `restaurant_order_items.bundle_id UUID NULL`; RPC `add_bundle_to_order(p_table_order_id uuid, p_bundle_id uuid, p_party_size int, p_course_selections jsonb) RETURNS jsonb`; extended `get_public_menu(p_tenant_slug TEXT) RETURNS JSONB` (adds `bundles`/`bundle_courses`/`bundle_course_items` keys); replaced `qr_place_order(p_table_id uuid, p_items jsonb) RETURNS jsonb` (adds bundle-add branch alongside the unchanged regular-item branch).
- Consumes: existing `current_tenant_id()` SECURITY DEFINER function, existing `table_orders`, `restaurant_menu_items`, `restaurant_order_items`, `restaurant_pending_orders`, `restaurant_settings`, `restaurant_tables` tables and the `table_orders_one_open_per_table` unique index from migration `000057`.

This task has no Vitest cycle — it is pure SQL with no automated harness in this repo (established convention). The "test cycle" is: write the file, then run the manual verification SQL in Step 2 against a Supabase SQL Editor connected to a dev project, confirming each expected result.

- [ ] **Step 1: Write the migration file**

```sql
-- Migration: 20260708_000060_preset_order_bundles.sql
-- Preset Order Bundles (Tier 2.1) — schema, staff RPC, QR ordering extension.
-- See docs/superpowers/specs/2026-07-08-preset-order-bundles-design.md for full design.
--
-- Numbered 000060 (not 000058 as an earlier draft of the spec said) because
-- 20260708_000058_security_performance_audit.sql and
-- 20260708_000059_fix_close_bill_overload_ambiguity.sql landed on main after
-- this feature's spec was written. This file must be applied after 000059.

-- ── Data Model ──────────────────────────────────────────────────────────────

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

-- Public read for QR menu browsing AND ordering (get_public_menu + qr_place_order below).
CREATE POLICY "public_read_bundles" ON restaurant_bundles
  FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_bundle_courses" ON restaurant_bundle_courses
  FOR SELECT USING (true);
CREATE POLICY "public_read_bundle_course_items" ON restaurant_bundle_course_items
  FOR SELECT USING (true);

-- ── Backend: add_bundle_to_order (staff RPC) ─────────────────────────────────

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

-- No GRANT/REVOKE — matches this repo's convention for staff-only RPCs
-- (fn_seat_waitlist_party, fn_transfer_table_order have none; default PUBLIC
-- EXECUTE plus the in-function current_tenant_id() check is this schema's
-- established security model for authenticated-only RPCs).

-- ── Backend: get_public_menu extension (adds bundles/bundle_courses/bundle_course_items) ──

CREATE OR REPLACE FUNCTION get_public_menu(p_tenant_slug TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE tenant_slug = p_tenant_slug;
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
      WHERE b.tenant_id = v_tenant_id AND b.is_active = true), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- ── Backend: qr_place_order full replacement (adds bundle-add branch) ───────
-- Replaces the version from 20260707_000057_order_item_integrity.sql in full.
-- The regular-item branch below is copied verbatim (no behavior change).

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
      -- directly; see the "PendingOrderItem.bundle_id" corollary in Task 3
      -- for why that queued charge line still needs its bundle_id to
      -- survive through confirmPendingOrder.
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

- [ ] **Step 2: Manual verification via Supabase SQL Editor**

Run against a dev project with at least one tenant, one open `table_orders` row, and a handful of active `restaurant_menu_items`. Substitute real UUIDs for the bracketed placeholders.

**2a. Schema sanity**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('restaurant_bundles', 'restaurant_bundle_courses', 'restaurant_bundle_course_items');
-- Expected: 3 rows.

SELECT column_name FROM information_schema.columns
WHERE table_name = 'restaurant_order_items' AND column_name = 'bundle_id';
-- Expected: 1 row.
```

**2b. Seed a bundle for testing**
```sql
INSERT INTO restaurant_bundles (tenant_id, name, price_per_guest_usd, is_active)
VALUES ('<tenant_id>', 'Family Feast', 18, true)
RETURNING id; -- save as <bundle_id>

INSERT INTO restaurant_bundle_courses (bundle_id, tenant_id, course, label, sort_order)
VALUES
  ('<bundle_id>', '<tenant_id>', 'appetizers', 'Choose your appetizer', 0),
  ('<bundle_id>', '<tenant_id>', 'mains', 'Choose your main', 1)
RETURNING id; -- save as <course_1_id>, <course_2_id>

INSERT INTO restaurant_bundle_course_items (bundle_course_id, menu_item_id) VALUES
  ('<course_1_id>', '<active_menu_item_1>'),
  ('<course_2_id>', '<active_menu_item_2>');
```

**2c. `add_bundle_to_order` — happy path**
```sql
SELECT add_bundle_to_order(
  '<open_table_order_id>', '<bundle_id>', 4,
  jsonb_build_array(
    jsonb_build_object('bundle_course_id', '<course_1_id>', 'menu_item_id', '<active_menu_item_1>'),
    jsonb_build_object('bundle_course_id', '<course_2_id>', 'menu_item_id', '<active_menu_item_2>')
  )
);
-- Expected: jsonb with order_id, bundle_id, charge_item_id, party_size=4.

SELECT product_name, menu_item_id, quantity, unit_price, status, bundle_id, sent_at
FROM restaurant_order_items WHERE bundle_id = '<bundle_id>' ORDER BY id;
-- Expected: 3 rows — 2 component rows (unit_price=0, quantity=4, status='pending', sent_at NULL,
-- real menu_item_id) + 1 charge row ('Bundle: Family Feast', menu_item_id NULL, unit_price=18,
-- quantity=4, status='served', sent_at NOT NULL).
```

**2d. `item_not_eligible_for_course`**
```sql
SELECT add_bundle_to_order(
  '<open_table_order_id>', '<bundle_id>', 2,
  jsonb_build_array(
    jsonb_build_object('bundle_course_id', '<course_1_id>', 'menu_item_id', '<active_menu_item_2>'), -- wrong slot
    jsonb_build_object('bundle_course_id', '<course_2_id>', 'menu_item_id', '<active_menu_item_2>')
  )
);
-- Expected: ERROR: item_not_eligible_for_course: item ... not eligible for course ...
```

**2e. `item_no_longer_available`**
```sql
UPDATE restaurant_menu_items SET is_active = false WHERE id = '<active_menu_item_1>';
SELECT add_bundle_to_order(
  '<open_table_order_id>', '<bundle_id>', 2,
  jsonb_build_array(
    jsonb_build_object('bundle_course_id', '<course_1_id>', 'menu_item_id', '<active_menu_item_1>'),
    jsonb_build_object('bundle_course_id', '<course_2_id>', 'menu_item_id', '<active_menu_item_2>')
  )
);
-- Expected: ERROR: item_no_longer_available: <active_menu_item_1>
UPDATE restaurant_menu_items SET is_active = true WHERE id = '<active_menu_item_1>'; -- restore
```

**2f. `order_not_open`**
```sql
SELECT add_bundle_to_order('<a_paid_or_cancelled_table_order_id>', '<bundle_id>', 2, '[]'::jsonb);
-- Expected: ERROR: order_not_open: status = paid  (or cancelled/merged, per the row you pick)
```

**2g. `invalid_party_size`**
```sql
SELECT add_bundle_to_order('<open_table_order_id>', '<bundle_id>', 0, '[]'::jsonb);
-- Expected: ERROR: invalid_party_size: 0
SELECT add_bundle_to_order('<open_table_order_id>', '<bundle_id>', -1, '[]'::jsonb);
-- Expected: ERROR: invalid_party_size: -1
```

**2h. `permission_denied` (cross-tenant)** — run as a session whose `current_tenant_id()` resolves to a *different* tenant than the one that owns `<open_table_order_id>` (e.g. switch tenant in the app first, or use `SET request.jwt.claims` in the SQL Editor if your setup supports it):
```sql
SELECT add_bundle_to_order('<open_table_order_id_belonging_to_other_tenant>', '<bundle_id>', 2, '[]'::jsonb);
-- Expected: ERROR: permission_denied
```

**2i. `get_public_menu` includes bundles**
```sql
SELECT jsonb_pretty(get_public_menu('<tenant_slug>') -> 'bundles');
SELECT jsonb_pretty(get_public_menu('<tenant_slug>') -> 'bundle_courses');
SELECT jsonb_pretty(get_public_menu('<tenant_slug>') -> 'bundle_course_items');
-- Expected: bundles shows Family Feast with id/name/price_per_guest_usd/sort_order;
-- bundle_courses shows the 2 course rows; bundle_course_items shows the 2 links.
```

**2j. `qr_place_order` — bundle + regular item, `direct` flow**
```sql
UPDATE restaurant_settings SET default_order_flow = 'direct' WHERE tenant_id = '<tenant_id>';
SELECT qr_place_order(
  '<table_id>',
  jsonb_build_array(
    jsonb_build_object('menu_item_id', '<active_menu_item_3>', 'quantity', 1, 'modifier_ids', '[]'::jsonb),
    jsonb_build_object(
      'bundle_id', '<bundle_id>', 'party_size', 3,
      'course_selections', jsonb_build_array(
        jsonb_build_object('bundle_course_id', '<course_1_id>', 'menu_item_id', '<active_menu_item_1>'),
        jsonb_build_object('bundle_course_id', '<course_2_id>', 'menu_item_id', '<active_menu_item_2>')
      )
    )
  )
);
-- Expected: { "mode": "direct", "order_id": "..." }
SELECT product_name, menu_item_id, quantity, unit_price, bundle_id FROM restaurant_order_items
WHERE order_id = (SELECT id FROM table_orders WHERE table_id = '<table_id>' AND status = 'open') ORDER BY id;
-- Expected: the regular item row (bundle_id NULL) + 2 bundle component rows + 1 bundle charge row.
```

**2k. `qr_place_order` — bundle under `waiter_confirm`, then `confirmPendingOrder` carries `bundle_id`**
```sql
UPDATE restaurant_settings SET default_order_flow = 'waiter_confirm' WHERE tenant_id = '<tenant_id>';
-- Use a table with no open order so a fresh shell + pending order is created.
SELECT qr_place_order(
  '<fresh_table_id>',
  jsonb_build_array(
    jsonb_build_object(
      'bundle_id', '<bundle_id>', 'party_size', 2,
      'course_selections', jsonb_build_array(
        jsonb_build_object('bundle_course_id', '<course_1_id>', 'menu_item_id', '<active_menu_item_1>'),
        jsonb_build_object('bundle_course_id', '<course_2_id>', 'menu_item_id', '<active_menu_item_2>')
      )
    )
  )
);
-- Expected: { "mode": "pending", "order_id": "..." }
SELECT items FROM restaurant_pending_orders WHERE table_id = '<fresh_table_id>' AND status = 'pending';
-- Expected: jsonb array of 3 items, each with a "bundle_id" key set to <bundle_id> (2 components + 1 charge line).
-- Now confirm it from the app (Task 3's fixed confirmPendingOrder) and re-run:
SELECT bundle_id, menu_item_id, quantity, unit_price FROM restaurant_order_items
WHERE bundle_id = '<bundle_id>' AND order_id = (SELECT table_order_id FROM restaurant_pending_orders WHERE table_id = '<fresh_table_id>' ORDER BY created_at DESC LIMIT 1);
-- Expected: 3 rows, all with bundle_id populated (this is the one case that silently fails
-- without Task 3's fix — if bundle_id is NULL here, Task 3 was not applied correctly).
```

**2l. `bundle_inactive` rolls back the whole transaction, including valid regular items**
```sql
UPDATE restaurant_bundles SET is_active = false WHERE id = '<bundle_id>';
SELECT qr_place_order(
  '<table_id>',
  jsonb_build_array(
    jsonb_build_object('menu_item_id', '<active_menu_item_3>', 'quantity', 1, 'modifier_ids', '[]'::jsonb),
    jsonb_build_object('bundle_id', '<bundle_id>', 'party_size', 2, 'course_selections', '[]'::jsonb)
  )
);
-- Expected: ERROR: bundle_inactive: <bundle_id>
SELECT count(*) FROM restaurant_order_items WHERE product_name = '<active_menu_item_3's name>' AND created_at > now() - interval '1 minute';
-- Expected: 0 — confirms the regular item line was NOT inserted despite being valid (whole-transaction rollback).
UPDATE restaurant_bundles SET is_active = true WHERE id = '<bundle_id>'; -- restore
```

**2m. Two bundle-adds, same bundle, different course selections, in one call**
```sql
SELECT qr_place_order(
  '<table_id>',
  jsonb_build_array(
    jsonb_build_object('bundle_id', '<bundle_id>', 'party_size', 2, 'course_selections', jsonb_build_array(
      jsonb_build_object('bundle_course_id', '<course_1_id>', 'menu_item_id', '<active_menu_item_1>'),
      jsonb_build_object('bundle_course_id', '<course_2_id>', 'menu_item_id', '<active_menu_item_2>')
    )),
    jsonb_build_object('bundle_id', '<bundle_id>', 'party_size', 5, 'course_selections', jsonb_build_array(
      jsonb_build_object('bundle_course_id', '<course_1_id>', 'menu_item_id', '<active_menu_item_1>'),
      jsonb_build_object('bundle_course_id', '<course_2_id>', 'menu_item_id', '<active_menu_item_2>')
    ))
  )
);
-- Expected: success; restaurant_order_items (or restaurant_pending_orders.items, depending on
-- order_flow) shows TWO separate charge lines for <bundle_id> — one at party_size=2, one at
-- party_size=5 — not merged into one.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260708_000060_preset_order_bundles.sql
git commit -m "$(cat <<'EOF'
feat(db): add preset order bundles schema, add_bundle_to_order RPC, and QR bundle ordering

Adds restaurant_bundles/restaurant_bundle_courses/restaurant_bundle_course_items
tables + RLS, restaurant_order_items.bundle_id, the add_bundle_to_order staff
RPC, a get_public_menu extension exposing bundles for QR browsing, and a full
qr_place_order replacement that accepts bundle-adds alongside regular items in
one atomic p_items array. Numbered 000060, not 000058 as the original spec
draft said, since 000058/000059 landed on main after the spec was written.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Types — `src/types/restaurant.ts` additions

**Files:**
- Modify: `src/types/restaurant.ts`

**Interfaces:**
- Consumes: nothing new (pure type additions).
- Produces: `RestaurantBundle`, `RestaurantBundleCourse`, `RestaurantBundleCourseItem`, `RestaurantOrderItem.bundle_id`, `PendingOrderItem.bundle_id`, `QRMenuBundle`, `QRMenuBundleCourse`, `QRMenuData.bundles/bundle_courses/bundle_course_items`, `QRCartBundleSelection`, `QRCartBundleItem` — every later task imports these exact names/shapes.

No Vitest cycle for this task — it is pure type declarations with no runtime behavior. Verification is `npm run typecheck` staying clean (it will show errors in files that already reference these types once later tasks add them — for this task alone, typecheck must stay clean since nothing yet consumes the new types in a way that could break).

- [ ] **Step 1: Add `RestaurantBundle`, `RestaurantBundleCourse`, `RestaurantBundleCourseItem` after `RestaurantModifier`, before `QRMenuTenant`**

In `src/types/restaurant.ts`, the `RestaurantModifier` interface currently ends right before `export interface QRMenuTenant {`:

```ts
export interface RestaurantModifier {
  id: string;
  group_id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  price_delta: number;
  sort_order: number;
}
```

Insert immediately after it (before `export interface QRMenuTenant {`):

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

- [ ] **Step 2: Add `bundle_id` to `RestaurantOrderItem`**

Current:
```ts
export interface RestaurantOrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  menu_item_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  modifiers: OrderItemModifier[];
  course: CourseType;
  status: ItemStatus;
  notes: string | null;
  sent_at: string | null;
  ready_at: string | null;
}
```

Change to:
```ts
export interface RestaurantOrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  menu_item_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  modifiers: OrderItemModifier[];
  course: CourseType;
  status: ItemStatus;
  bundle_id: string | null;
  notes: string | null;
  sent_at: string | null;
  ready_at: string | null;
}
```

- [ ] **Step 3: Add `QRMenuBundle`/`QRMenuBundleCourse`, extend `QRMenuData`, add bundle cart types**

Current:
```ts
export interface QRMenuTenant {
  id: string;
  name: string;
  brand_logo_url: string | null;
  brand_primary: string | null;
  qr_menu_palette: string;
  qr_menu_promotional_banner: string | null;
}

export interface QRMenuData {
  tenant: QRMenuTenant;
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  modifier_groups: RestaurantModifierGroup[];
  modifiers: RestaurantModifier[];
  item_modifier_links: Array<{ menu_item_id: string; modifier_group_id: string }>;
}

export interface QRCartItem {
  menuItemId: string;
  menuItem: RestaurantMenuItem;
  quantity: number;
  selectedModifiers: Record<string, string[]>;
  totalPrice: number;
  notes: string;
}
```

Change to:
```ts
export interface QRMenuTenant {
  id: string;
  name: string;
  brand_logo_url: string | null;
  brand_primary: string | null;
  qr_menu_palette: string;
  qr_menu_promotional_banner: string | null;
}

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

export interface QRCartItem {
  menuItemId: string;
  menuItem: RestaurantMenuItem;
  quantity: number;
  selectedModifiers: Record<string, string[]>;
  totalPrice: number;
  notes: string;
}

export interface QRCartBundleSelection {
  bundleCourseId: string;
  menuItemId: string;
  itemName: string; // for cart-line display without re-joining menuData
}

export interface QRCartBundleItem {
  cartKey: string;          // generated on add (crypto.randomUUID()) — see rationale in useCart.ts
  bundleId: string;
  bundleName: string;
  pricePerGuestUsd: number;
  partySize: number;
  courseSelections: QRCartBundleSelection[];
  totalPrice: number;       // pricePerGuestUsd * partySize, computed on add
}
```

- [ ] **Step 4: Add `bundle_id` to `PendingOrderItem`**

Current:
```ts
export interface PendingOrderItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  modifiers: Array<{ name: string; price_delta: number }>;
  notes: string;
  course: CourseType;
}
```

Change to:
```ts
export interface PendingOrderItem {
  menu_item_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  modifiers: Array<{ name: string; price_delta: number }>;
  notes: string;
  course: CourseType;
  bundle_id: string | null;
}
```

Note: `menu_item_id` widens from `string` to `string | null` here because the bundle charge line queued by `qr_place_order`'s `waiter_confirm` branch has `'menu_item_id', NULL` (matching the real `restaurant_order_items.menu_item_id` column, which is already nullable). This is a real, necessary type correction, not scope creep — without it, `PendingOrderItem.bundle_id` would be unreachable-safe but `menu_item_id` would silently lie about what the RPC actually queues.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean (no errors) — nothing yet consumes the widened `menu_item_id` type in a way that breaks, since `RestaurantOrderItem.menu_item_id` was already `string | null` and `useRestaurantOrder.ts`/`WaiterInterface.tsx` already read `item.menu_item_id` in nullable-safe contexts (passed straight through to an `insert()` call, not dereferenced).

- [ ] **Step 6: Commit**

```bash
git add src/types/restaurant.ts
git commit -m "$(cat <<'EOF'
feat(f&b): add preset order bundle types

RestaurantBundle/RestaurantBundleCourse/RestaurantBundleCourseItem for the
staff-facing tables, QRMenuBundle/QRMenuBundleCourse/QRMenuData extension for
the QR menu payload, QRCartBundleSelection/QRCartBundleItem for the cart, and
bundle_id on both RestaurantOrderItem and PendingOrderItem.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `PendingOrderItem.bundle_id` corollary — fix both `confirmPendingOrder` implementations

**Files:**
- Modify: `src/hooks/useRestaurantOrder.ts:284-321` (the `confirmPendingOrder` callback)
- Modify: `src/pages/restaurant/WaiterInterface.tsx:1910-1960` (the `handleConfirmPendingOrder` function)

**Interfaces:**
- Consumes: `PendingOrderItem.bundle_id` from Task 2.
- Produces: nothing new — both functions already insert `menu_item_id: item.menu_item_id` (fixed by a prior session's `order-item-integrity` work); this task adds the mirroring `bundle_id: item.bundle_id ?? null` field to the same insert payloads.

Without this fix, a QR-ordered bundle under `order_flow = 'waiter_confirm'` loses its `bundle_id` tag the moment staff hit "Confirm" — inventory deduction still works (real `menu_item_id` + `quantity` survive unaffected) but bundle revenue reporting (`SUM(unit_price * quantity) WHERE bundle_id = X`) silently undercounts, and the `$0` components look like ordinary free items with no bundle origin.

No dedicated unit test exists for either `confirmPendingOrder` implementation in this codebase today (`src/hooks/useRestaurantOrder.ts` and `src/pages/restaurant/WaiterInterface.tsx` have no `.test.ts(x)` files — a pre-existing gap, not something this task is scoped to fix). This task's correctness is verified by `npm run typecheck` plus Task 1's manual SQL step **2k**, which explicitly checks that `restaurant_order_items.bundle_id` survives the pending → confirmed transition end to end.

- [ ] **Step 1: Fix `useRestaurantOrder.ts`'s `confirmPendingOrder`**

Current (`src/hooks/useRestaurantOrder.ts:290-303`):
```ts
    // Insert items into restaurant_order_items
    const inserts = pendingItems.map((item) => ({
      tenant_id: tenantId,
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      course: item.course,
      notes: item.notes || null,
      modifiers: item.modifiers,
      status: 'pending' as const,
    }));
```

Change to:
```ts
    // Insert items into restaurant_order_items
    const inserts = pendingItems.map((item) => ({
      tenant_id: tenantId,
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      course: item.course,
      notes: item.notes || null,
      modifiers: item.modifiers,
      status: 'pending' as const,
      bundle_id: item.bundle_id ?? null,
    }));
```

- [ ] **Step 2: Fix `WaiterInterface.tsx`'s `handleConfirmPendingOrder`**

Current (`src/pages/restaurant/WaiterInterface.tsx:1919-1932`):
```ts
      const itemRows = editedItems.map((item) => ({
        tenant_id: tenantId,
        order_id: tableOrder.id,
        table_id: order.table_id,
        product_name: item.name,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        course: item.course,
        notes: item.notes || null,
        modifiers: item.modifiers,
        status: 'pending' as const,
        sent_at: null,
      }));
```

Change to:
```ts
      const itemRows = editedItems.map((item) => ({
        tenant_id: tenantId,
        order_id: tableOrder.id,
        table_id: order.table_id,
        product_name: item.name,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        course: item.course,
        notes: item.notes || null,
        modifiers: item.modifiers,
        status: 'pending' as const,
        sent_at: null,
        bundle_id: item.bundle_id ?? null,
      }));
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useRestaurantOrder.ts src/pages/restaurant/WaiterInterface.tsx
git commit -m "$(cat <<'EOF'
fix(f&b): carry bundle_id through confirmPendingOrder for QR-ordered bundles

Both confirmPendingOrder implementations (useRestaurantOrder.ts and
WaiterInterface.tsx's inline handleConfirmPendingOrder) already carry
menu_item_id from a prior fix; this mirrors that pattern for bundle_id so a
QR bundle ordered under order_flow='waiter_confirm' keeps its bundle
revenue/consumption tag once staff confirm the pending order. Without this,
inventory deduction still works but bundle-level revenue reporting silently
undercounts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Staff CRUD — "Bundles" tab in `src/pages/restaurant/MenuManagement.tsx`

**Files:**
- Modify: `src/pages/restaurant/MenuManagement.tsx`
- Create: `src/pages/restaurant/MenuManagement.test.tsx` (new file — no test file exists for this page today)

**Interfaces:**
- Consumes: `RestaurantBundle`, `RestaurantBundleCourse`, `RestaurantBundleCourseItem`, `CourseType`, `COURSE_LABELS` from `@/types/restaurant` (Task 2); tables `restaurant_bundles`/`restaurant_bundle_courses`/`restaurant_bundle_course_items` from Task 1.
- Produces: nothing consumed by later tasks — this tab is a leaf UI surface.

**Judgment call:** the spec frames `BundlesManager`/`BundleFormModal` as "new components" without mandating a file. This codebase's actual convention in this exact file is that every tab's components (`MenuBuilder`/`ItemFormModal`/`MenuItemCard` for the Builder tab, `WaiterOrderPanel` for the Waiter tab, `QRMenuSettings`/`TableQRSection` for the QR tab) are defined **inline in `src/pages/restaurant/MenuManagement.tsx`** — none are split into separate files, confirmed via `grep -n "^function " src/pages/restaurant/MenuManagement.tsx`. `BundlesManager` and `BundleFormModal` follow that established in-file convention, matching `MenuBuilder`/`ItemFormModal` exactly.

- [ ] **Step 1: Write the failing test for the Bundles tab list**

Create `src/pages/restaurant/MenuManagement.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeSelectChain(data: unknown[]) {
  const p = Promise.resolve({ data, error: null }) as Promise<{ data: unknown[]; error: null }> & {
    eq: () => typeof p;
    order: () => typeof p;
    select: () => typeof p;
  };
  p.eq = () => p;
  p.order = () => p;
  p.select = () => p;
  return p;
}

let mockCategories: unknown[] = [];
let mockItems: unknown[] = [];
let mockBundles: unknown[] = [];
let mockBundleCourses: unknown[] = [];
let mockBundleCourseItems: unknown[] = [];

const callOrder: string[] = [];
const mockBundleInsert = vi.fn();
const mockBundleUpdate = vi.fn();
const mockBundleDelete = vi.fn();
const mockCourseDelete = vi.fn();
const mockCourseInsert = vi.fn();
const mockCourseItemsInsert = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'restaurant_menu_categories') return { select: () => makeSelectChain(mockCategories) };
      if (table === 'restaurant_menu_items') return { select: () => makeSelectChain(mockItems) };
      if (table === 'restaurant_bundle_course_items') {
        return {
          select: () => makeSelectChain(mockBundleCourseItems),
          insert: (rows: unknown) => {
            callOrder.push('bundle_course_items.insert');
            mockCourseItemsInsert(rows);
            return Promise.resolve({ data: rows, error: null });
          },
        };
      }
      if (table === 'restaurant_bundle_courses') {
        return {
          select: () => makeSelectChain(mockBundleCourses),
          delete: () => {
            callOrder.push('bundle_courses.delete');
            mockCourseDelete();
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
          insert: (row: unknown) => {
            callOrder.push('bundle_courses.insert');
            mockCourseInsert(row);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: `new-course-${callOrder.length}`, ...(row as object) }, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'restaurant_bundles') {
        return {
          select: () => makeSelectChain(mockBundles),
          insert: (row: unknown) => {
            callOrder.push('bundles.insert');
            mockBundleInsert(row);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'new-bundle-1', ...(row as object) }, error: null }),
              }),
            };
          },
          update: (row: unknown) => {
            callOrder.push('bundles.update');
            mockBundleUpdate(row);
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
          delete: () => {
            mockBundleDelete();
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        };
      }
      return { select: () => makeSelectChain([]) };
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ currentTenant: { id: 't1' } }),
}));

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/restaurant/AIContentGeneratorModal', () => ({
  AIContentGeneratorModal: () => null,
}));

import MenuManagement from './MenuManagement';

const bundleFixture = {
  id: 'bundle-1', tenant_id: 't1', name: 'Family Feast', name_ar: null, description: null,
  price_per_guest_usd: 18, is_active: true, active_breakfast: true, active_lunch: true,
  active_dinner: true, sort_order: 0,
};
const courseFixture = {
  id: 'c1', bundle_id: 'bundle-1', tenant_id: 't1', course: 'appetizers', label: 'Choose your appetizer', sort_order: 0,
};
const courseItemFixture = { bundle_course_id: 'c1', menu_item_id: 'mi-1' };
const menuItemFixture = {
  id: 'mi-1', tenant_id: 't1', category_id: null, name: 'Fattoush', name_ar: null,
  description: null, description_ar: null, photo_url: null, base_price_usd: 5,
  base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [],
  is_featured: false, is_chef_pick: false, is_eighty_sixd: false,
  active_breakfast: true, active_lunch: true, active_dinner: true,
  sort_order: 0, is_active: true,
};

async function openBundlesTab() {
  render(<MenuManagement />);
  fireEvent.click(await screen.findByRole('button', { name: /bundles/i }));
}

describe('MenuManagement — Bundles tab', () => {
  beforeEach(() => {
    mockCategories = [];
    mockItems = [menuItemFixture];
    mockBundles = [bundleFixture];
    mockBundleCourses = [courseFixture];
    mockBundleCourseItems = [courseItemFixture];
    callOrder.length = 0;
    mockBundleInsert.mockClear();
    mockBundleUpdate.mockClear();
    mockBundleDelete.mockClear();
    mockCourseDelete.mockClear();
    mockCourseInsert.mockClear();
    mockCourseItemsInsert.mockClear();
  });

  it('renders the Bundles tab and lists fetched bundles with name and price', async () => {
    await openBundlesTab();
    expect(await screen.findByText('Family Feast')).toBeInTheDocument();
    expect(screen.getByText('$18.00/guest')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/pages/restaurant/MenuManagement.test.tsx`
Expected: FAIL — there is no "Bundles" tab button yet (`getByRole('button', { name: /bundles/i })` throws), and `MenuManagement`'s `loadData` doesn't fetch `restaurant_bundles` yet.

- [ ] **Step 3: Add `Layers` import and extend the `Tab` type**

In `src/pages/restaurant/MenuManagement.tsx`, current import block:
```ts
import {
  ArrowLeft,
  ChefHat,
  Copy,
  Download,
  Edit2,
  GripVertical,
  Image,
  Link,
  Loader2,
  Plus,
  Printer,
  QrCode,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  Wand2,
  X,
} from 'lucide-react';
```

Change to:
```ts
import {
  ArrowLeft,
  ChefHat,
  Copy,
  Download,
  Edit2,
  GripVertical,
  Image,
  Layers,
  Link,
  Loader2,
  Plus,
  Printer,
  QrCode,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  Wand2,
  X,
} from 'lucide-react';
```

Current type import block:
```ts
import type {
  BranchMenuOverride,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantTable,
} from '@/types/restaurant';
```

Change to:
```ts
import type {
  BranchMenuOverride,
  CourseType,
  RestaurantBundle,
  RestaurantBundleCourse,
  RestaurantBundleCourseItem,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantTable,
} from '@/types/restaurant';
import { COURSE_LABELS } from '@/types/restaurant';
```

- [ ] **Step 4: Add `BundlesManager` and `BundleFormModal` — form state, props, and validation**

Insert this new section into `src/pages/restaurant/MenuManagement.tsx` immediately after the `MenuBuilder` function's closing brace (i.e. right before the `// ── Tab 2: Waiter Order Panel` — or equivalent — comment that precedes `WaiterOrderPanel`; use `grep -n "^function WaiterOrderPanel"` to find the exact insertion point):

```tsx
// ── Tab: Bundles (Preset Order Bundles / Prix-Fixe Combos) ─────────────────────

interface BundleFormState {
  name: string;
  name_ar: string;
  description: string;
  price_per_guest_usd: string;
  is_active: boolean;
  active_breakfast: boolean;
  active_lunch: boolean;
  active_dinner: boolean;
}

const EMPTY_BUNDLE_FORM: BundleFormState = {
  name: '',
  name_ar: '',
  description: '',
  price_per_guest_usd: '',
  is_active: true,
  active_breakfast: true,
  active_lunch: true,
  active_dinner: true,
};

interface CourseDraft {
  localId: string;
  course: CourseType;
  label: string;
  eligibleItemIds: string[];
}

interface BundleFormModalProps {
  bundle: RestaurantBundle | null;
  courses: RestaurantBundleCourse[];
  courseItems: RestaurantBundleCourseItem[];
  menuItems: RestaurantMenuItem[];
  onClose: () => void;
  onSave: () => void;
}

function BundleFormModal({ bundle, courses, courseItems, menuItems, onClose, onSave }: BundleFormModalProps) {
  const { currentTenant } = useApp();
  const [form, setForm] = useState<BundleFormState>(() => {
    if (!bundle) return EMPTY_BUNDLE_FORM;
    return {
      name: bundle.name,
      name_ar: bundle.name_ar ?? '',
      description: bundle.description ?? '',
      price_per_guest_usd: String(bundle.price_per_guest_usd),
      is_active: bundle.is_active,
      active_breakfast: bundle.active_breakfast,
      active_lunch: bundle.active_lunch,
      active_dinner: bundle.active_dinner,
    };
  });
  const [courseDrafts, setCourseDrafts] = useState<CourseDraft[]>(() => {
    if (!bundle) return [];
    return courses
      .filter(c => c.bundle_id === bundle.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => ({
        localId: c.id,
        course: c.course,
        label: c.label,
        eligibleItemIds: courseItems.filter(ci => ci.bundle_course_id === c.id).map(ci => ci.menu_item_id),
      }));
  });
  const [itemSearch, setItemSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const activeMenuItems = menuItems.filter(mi => mi.is_active);
  const searchedMenuItems = itemSearch
    ? activeMenuItems.filter(mi => mi.name.toLowerCase().includes(itemSearch.toLowerCase()))
    : activeMenuItems;

  const handleAddCourseSlot = () => {
    setCourseDrafts(prev => [...prev, { localId: crypto.randomUUID(), course: 'mains', label: '', eligibleItemIds: [] }]);
  };

  const handleDeleteCourseSlot = (localId: string) => {
    setCourseDrafts(prev => prev.filter(cd => cd.localId !== localId));
  };

  const handleUpdateCourseSlot = (localId: string, patch: Partial<Pick<CourseDraft, 'course' | 'label'>>) => {
    setCourseDrafts(prev => prev.map(cd => (cd.localId === localId ? { ...cd, ...patch } : cd)));
  };

  const toggleEligibleItem = (localId: string, itemId: string) => {
    setCourseDrafts(prev => prev.map(cd => {
      if (cd.localId !== localId) return cd;
      const has = cd.eligibleItemIds.includes(itemId);
      return { ...cd, eligibleItemIds: has ? cd.eligibleItemIds.filter(id => id !== itemId) : [...cd.eligibleItemIds, itemId] };
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price_per_guest_usd || parseFloat(form.price_per_guest_usd) <= 0) {
      toast.error('Name and a price greater than $0 are required');
      return;
    }
    if (courseDrafts.length === 0) {
      toast.error('Add at least one course slot');
      return;
    }
    if (courseDrafts.some(cd => cd.eligibleItemIds.length === 0)) {
      toast.error('Every course slot needs at least one eligible item');
      return;
    }
    if (!currentTenant?.id) { toast.error('No active tenant'); return; }
    setSaving(true);
    try {
      const payload = {
        tenant_id: currentTenant.id,
        name: form.name.trim(),
        name_ar: form.name_ar.trim() || null,
        description: form.description.trim() || null,
        price_per_guest_usd: parseFloat(form.price_per_guest_usd) || 0,
        is_active: form.is_active,
        active_breakfast: form.active_breakfast,
        active_lunch: form.active_lunch,
        active_dinner: form.active_dinner,
      };

      let bundleId: string;
      if (bundle) {
        const { error } = await supabase.from('restaurant_bundles').update(payload).eq('id', bundle.id);
        if (error) throw error;
        bundleId = bundle.id;
        const { error: delErr } = await supabase.from('restaurant_bundle_courses').delete().eq('bundle_id', bundleId);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase.from('restaurant_bundles').insert(payload).select().single();
        if (error) throw error;
        bundleId = (data as RestaurantBundle).id;
      }

      for (let i = 0; i < courseDrafts.length; i++) {
        const draft = courseDrafts[i]!;
        const { data: courseRow, error: courseErr } = await supabase
          .from('restaurant_bundle_courses')
          .insert({
            bundle_id: bundleId,
            tenant_id: currentTenant.id,
            course: draft.course,
            label: draft.label.trim() || 'Choose one',
            sort_order: i,
          })
          .select()
          .single();
        if (courseErr) throw courseErr;
        const newCourseId = (courseRow as RestaurantBundleCourse).id;
        const { error: itemsErr } = await supabase
          .from('restaurant_bundle_course_items')
          .insert(draft.eligibleItemIds.map(itemId => ({ bundle_course_id: newCourseId, menu_item_id: itemId })));
        if (itemsErr) throw itemsErr;
      }

      toast.success(bundle ? 'Bundle updated' : 'Bundle added');
      onSave();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save bundle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 bg-slate-900 shadow-2xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 flex-shrink-0">
          <h2 className="text-base font-bold text-white">{bundle ? 'Edit Bundle' : 'Add Bundle'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Name (EN) *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                placeholder="e.g. Family Feast"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">الاسم (AR)</label>
              <input
                dir="rtl"
                value={form.name_ar}
                onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                placeholder="وليمة العائلة"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none resize-none"
              placeholder="Brief description of the combo..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">Price per Guest (USD) *</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.price_per_guest_usd}
              onChange={e => setForm(f => ({ ...f, price_per_guest_usd: e.target.value }))}
              className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-white/60">Served During</label>
            <div className="flex flex-wrap gap-2">
              {MEAL_TIMES.map(mt => {
                const isAll = mt.key === 'all_day';
                const checked = isAll
                  ? form.active_breakfast && form.active_lunch && form.active_dinner
                  : form[`active_${mt.key}` as keyof BundleFormState] as boolean;
                return (
                  <button
                    key={mt.key}
                    type="button"
                    onClick={() => {
                      if (isAll) {
                        const all = form.active_breakfast && form.active_lunch && form.active_dinner;
                        setForm(f => ({ ...f, active_breakfast: !all, active_lunch: !all, active_dinner: !all }));
                      } else {
                        const key = `active_${mt.key}` as 'active_breakfast' | 'active_lunch' | 'active_dinner';
                        setForm(f => ({ ...f, [key]: !f[key] }));
                      }
                    }}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                      checked
                        ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                        : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                    }`}
                  >
                    {mt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`h-5 w-9 rounded-full border transition-all cursor-pointer ${
                  form.is_active ? 'border-indigo-500/50 bg-indigo-500/40' : 'border-white/20 bg-white/10'
                }`}
              >
                <span className={`block h-3.5 w-3.5 rounded-full mt-[2px] transition-transform ${
                  form.is_active ? 'translate-x-4 bg-indigo-400' : 'translate-x-0.5 bg-white/30'
                }`} />
              </div>
              <span className="text-xs text-white/60">Active</span>
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-medium text-white/60">Course Slots</label>
              <button
                type="button"
                onClick={handleAddCourseSlot}
                className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Course Slot
              </button>
            </div>

            <div className="space-y-4">
              {courseDrafts.map(cd => (
                <div key={cd.localId} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <select
                      value={cd.course}
                      onChange={e => handleUpdateCourseSlot(cd.localId, { course: e.target.value as CourseType })}
                      className="rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5 text-xs text-white focus:border-indigo-500/50 focus:outline-none"
                    >
                      {(Object.keys(COURSE_LABELS) as CourseType[]).map(c => (
                        <option key={c} value={c}>{COURSE_LABELS[c]}</option>
                      ))}
                    </select>
                    <input
                      value={cd.label}
                      onChange={e => handleUpdateCourseSlot(cd.localId, { label: e.target.value })}
                      placeholder="Choose your appetizer"
                      className="flex-1 rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteCourseSlot(cd.localId)}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      aria-label="Delete course slot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                    Eligible Items
                  </p>
                  {activeMenuItems.length > 8 && (
                    <input
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                      placeholder="Search menu items..."
                      className="mb-2 w-full rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                    />
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {searchedMenuItems.map(mi => {
                      const isSelected = cd.eligibleItemIds.includes(mi.id);
                      return (
                        <button
                          key={mi.id}
                          type="button"
                          onClick={() => toggleEligibleItem(cd.localId, mi.id)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                            isSelected
                              ? 'border-indigo-500/70 bg-indigo-600/30 text-white'
                              : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                          }`}
                        >
                          {mi.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {courseDrafts.length === 0 && (
                <p className="text-xs text-white/30">No course slots yet — add at least one.</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-4 flex-shrink-0">
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {bundle ? 'Save Changes' : 'Create Bundle'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface BundlesManagerProps {
  bundles: RestaurantBundle[];
  courses: RestaurantBundleCourse[];
  courseItems: RestaurantBundleCourseItem[];
  menuItems: RestaurantMenuItem[];
  onRefresh: () => void;
}

function BundlesManager({ bundles, courses, courseItems, menuItems, onRefresh }: BundlesManagerProps) {
  const [editingBundle, setEditingBundle] = useState<RestaurantBundle | null | undefined>(undefined);

  const handleDeleteBundle = async (id: string) => {
    if (!confirm('Delete this bundle?')) return;
    const { error } = await supabase.from('restaurant_bundles').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    onRefresh();
  };

  const handleToggleActive = async (b: RestaurantBundle) => {
    const { error } = await supabase.from('restaurant_bundles').update({ is_active: !b.is_active }).eq('id', b.id);
    if (error) { toast.error(error.message); return; }
    onRefresh();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={() => setEditingBundle(null)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Bundle
        </button>
      </div>

      {bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 py-16 text-center">
          <Layers className="mb-3 h-8 w-8 text-white/20" />
          <p className="text-sm text-white/40">No bundles yet</p>
          <p className="mt-1 text-xs text-white/25">Click "Add Bundle" to create a combo</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {bundles.map(b => {
            const courseCount = courses.filter(c => c.bundle_id === b.id).length;
            return (
              <div
                key={b.id}
                data-testid={`bundle-card-${b.id}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 to-white/3 backdrop-blur-md shadow-xl p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{b.name}</p>
                    {b.name_ar && <p className="truncate text-xs text-white/40" dir="rtl">{b.name_ar}</p>}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-emerald-400">${b.price_per_guest_usd.toFixed(2)}/guest</span>
                </div>
                <p className="mb-2 text-xs text-white/40">{courseCount} course{courseCount !== 1 ? 's' : ''}</p>
                <div className="mt-auto flex items-center justify-between">
                  <button
                    onClick={() => void handleToggleActive(b)}
                    className={`h-6 w-11 rounded-full border transition-all ${
                      b.is_active ? 'border-emerald-500/50 bg-emerald-500/30' : 'border-white/20 bg-white/10'
                    }`}
                    aria-label={b.is_active ? 'Disable bundle' : 'Enable bundle'}
                  >
                    <span className={`block h-4 w-4 rounded-full transition-transform ${
                      b.is_active ? 'translate-x-6 bg-emerald-400' : 'translate-x-1 bg-white/30'
                    }`} />
                  </button>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setEditingBundle(b)}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-indigo-400 transition-colors"
                      aria-label="Edit bundle"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void handleDeleteBundle(b.id)}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      aria-label="Delete bundle"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingBundle !== undefined && (
        <BundleFormModal
          bundle={editingBundle}
          courses={courses}
          courseItems={courseItems}
          menuItems={menuItems}
          onClose={() => setEditingBundle(undefined)}
          onSave={onRefresh}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire the tab into the main `MenuManagement` component**

Current `Tab` type and state (`src/pages/restaurant/MenuManagement.tsx:1658-1666`):
```ts
type Tab = 'builder' | 'waiter' | 'qr';

export default function MenuManagement() {
  const navigate = useNavigate();
  const { currentTenant } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('builder');
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [items, setItems] = useState<RestaurantMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
```

Change to:
```ts
type Tab = 'builder' | 'waiter' | 'bundles' | 'qr';

export default function MenuManagement() {
  const navigate = useNavigate();
  const { currentTenant } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('builder');
  const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
  const [items, setItems] = useState<RestaurantMenuItem[]>([]);
  const [bundles, setBundles] = useState<RestaurantBundle[]>([]);
  const [bundleCourses, setBundleCourses] = useState<RestaurantBundleCourse[]>([]);
  const [bundleCourseItems, setBundleCourseItems] = useState<RestaurantBundleCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
```

Current `loadData` (`src/pages/restaurant/MenuManagement.tsx:1668-1678`):
```ts
  const loadData = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const [catRes, itemRes] = await Promise.all([
      supabase.from('restaurant_menu_categories').select('*').eq('tenant_id', currentTenant.id).order('sort_order'),
      supabase.from('restaurant_menu_items').select('*').eq('tenant_id', currentTenant.id).order('sort_order'),
    ]);
    setCategories((catRes.data ?? []) as RestaurantMenuCategory[]);
    setItems((itemRes.data ?? []) as RestaurantMenuItem[]);
    setLoading(false);
  }, [currentTenant?.id]);
```

Change to:
```ts
  const loadData = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const [catRes, itemRes, bundleRes, bundleCourseRes, bundleCourseItemRes] = await Promise.all([
      supabase.from('restaurant_menu_categories').select('*').eq('tenant_id', currentTenant.id).order('sort_order'),
      supabase.from('restaurant_menu_items').select('*').eq('tenant_id', currentTenant.id).order('sort_order'),
      supabase.from('restaurant_bundles').select('*').eq('tenant_id', currentTenant.id).order('sort_order'),
      supabase.from('restaurant_bundle_courses').select('*').eq('tenant_id', currentTenant.id).order('sort_order'),
      // No tenant_id column on restaurant_bundle_course_items — RLS scopes it via a join,
      // matching restaurant_menu_item_modifiers's established convention.
      supabase.from('restaurant_bundle_course_items').select('*'),
    ]);
    setCategories((catRes.data ?? []) as RestaurantMenuCategory[]);
    setItems((itemRes.data ?? []) as RestaurantMenuItem[]);
    setBundles((bundleRes.data ?? []) as RestaurantBundle[]);
    setBundleCourses((bundleCourseRes.data ?? []) as RestaurantBundleCourse[]);
    setBundleCourseItems((bundleCourseItemRes.data ?? []) as RestaurantBundleCourseItem[]);
    setLoading(false);
  }, [currentTenant?.id]);
```

Current `tabs` array (`src/pages/restaurant/MenuManagement.tsx:1682-1686`):
```ts
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'builder', label: 'Menu Builder', icon: <ChefHat className="h-4 w-4" /> },
    { key: 'waiter', label: 'Waiter Order', icon: <ShoppingCart className="h-4 w-4" /> },
    { key: 'qr', label: 'QR Menu', icon: <QrCode className="h-4 w-4" /> },
  ];
```

Change to:
```ts
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'builder', label: 'Menu Builder', icon: <ChefHat className="h-4 w-4" /> },
    { key: 'waiter', label: 'Waiter Order', icon: <ShoppingCart className="h-4 w-4" /> },
    { key: 'bundles', label: 'Bundles', icon: <Layers className="h-4 w-4" /> },
    { key: 'qr', label: 'QR Menu', icon: <QrCode className="h-4 w-4" /> },
  ];
```

Current tab content switch (`src/pages/restaurant/MenuManagement.tsx:1734-1744`):
```tsx
            <>
              {activeTab === 'builder' && (
                <MenuBuilder categories={categories} items={items} onRefresh={() => { void loadData(); }} />
              )}
              {activeTab === 'waiter' && (
                <WaiterOrderPanel categories={categories} items={items} />
              )}
              {activeTab === 'qr' && (
                <QRMenuSettings items={items} onRefresh={() => { void loadData(); }} />
              )}
            </>
```

Change to:
```tsx
            <>
              {activeTab === 'builder' && (
                <MenuBuilder categories={categories} items={items} onRefresh={() => { void loadData(); }} />
              )}
              {activeTab === 'waiter' && (
                <WaiterOrderPanel categories={categories} items={items} />
              )}
              {activeTab === 'bundles' && (
                <BundlesManager
                  bundles={bundles}
                  courses={bundleCourses}
                  courseItems={bundleCourseItems}
                  menuItems={items}
                  onRefresh={() => { void loadData(); }}
                />
              )}
              {activeTab === 'qr' && (
                <QRMenuSettings items={items} onRefresh={() => { void loadData(); }} />
              )}
            </>
```

- [ ] **Step 6: Run the test, verify it passes**

Run: `npx vitest run src/pages/restaurant/MenuManagement.test.tsx`
Expected: PASS.

- [ ] **Step 7: Add the remaining Bundles-tab tests**

Append these `it` blocks inside the same `describe('MenuManagement — Bundles tab', ...)` block, after the existing test:

```tsx
  it('"Add Bundle" opens BundleFormModal with an empty form', async () => {
    await openBundlesTab();
    fireEvent.click(await screen.findByRole('button', { name: /add bundle/i }));
    expect(screen.getByText('Add Bundle')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Family Feast')).toHaveValue('');
  });

  it('"Edit" opens BundleFormModal pre-filled from the selected bundle data', async () => {
    await openBundlesTab();
    const card = await screen.findByTestId('bundle-card-bundle-1');
    fireEvent.click(within(card).getByLabelText('Edit bundle'));
    expect(screen.getByDisplayValue('Family Feast')).toBeInTheDocument();
  });

  it('attempting to save with no course slots shows a toast.error and does not call insert/update', async () => {
    await openBundlesTab();
    fireEvent.click(await screen.findByRole('button', { name: /add bundle/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Family Feast'), { target: { value: 'New Combo' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /create bundle/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Add at least one course slot');
    });
    expect(mockBundleInsert).not.toHaveBeenCalled();
  });

  it('attempting to save a course slot with zero eligible items shows a toast.error and does not call insert/update', async () => {
    await openBundlesTab();
    fireEvent.click(await screen.findByRole('button', { name: /add bundle/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Family Feast'), { target: { value: 'New Combo' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /add course slot/i }));
    fireEvent.click(screen.getByRole('button', { name: /create bundle/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Every course slot needs at least one eligible item');
    });
    expect(mockBundleInsert).not.toHaveBeenCalled();
  });

  it('a valid save calls the bundle upsert, then delete-and-reinsert on courses/course_items in that order', async () => {
    await openBundlesTab();
    const card = await screen.findByTestId('bundle-card-bundle-1');
    fireEvent.click(within(card).getByLabelText('Edit bundle'));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockBundleUpdate).toHaveBeenCalled();
    });
    expect(callOrder).toEqual(['bundles.update', 'bundle_courses.delete', 'bundle_courses.insert', 'bundle_course_items.insert']);
  });

  it('deleting a bundle prompts confirm() and only deletes when confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    await openBundlesTab();
    const card = await screen.findByTestId('bundle-card-bundle-1');
    const deleteButton = within(card).getByLabelText('Delete bundle');

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(deleteButton);
    expect(mockBundleDelete).not.toHaveBeenCalled();

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(mockBundleDelete).toHaveBeenCalled();
    });
    confirmSpy.mockRestore();
  });
```

Also add the `toast` import at the top of the test file (needed by the new assertions), right after the `MenuManagement` import:
```ts
import MenuManagement from './MenuManagement';
import { toast } from 'sonner';
```

- [ ] **Step 8: Run the full test file, verify all pass**

Run: `npx vitest run src/pages/restaurant/MenuManagement.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 9: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 10: Commit**

```bash
git add src/pages/restaurant/MenuManagement.tsx src/pages/restaurant/MenuManagement.test.tsx
git commit -m "$(cat <<'EOF'
feat(f&b): add Bundles tab to Menu Management for staff CRUD

BundlesManager (grid of bundle cards, active toggle, edit/delete) and
BundleFormModal (name/price/served-during/course-slot editor with a
per-slot eligible-items chip picker) are defined inline in
MenuManagement.tsx, matching this file's established convention where every
tab's components (MenuBuilder/ItemFormModal, WaiterOrderPanel,
QRMenuSettings) live in the same file rather than being split out.

Save flow is delete-and-reinsert on restaurant_bundle_courses /
restaurant_bundle_course_items on every edit — safe because course/
course-item rows are never referenced by historical orders (only bundle_id
is, via ON DELETE SET NULL).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Staff ordering — `BundleOrderModal` + `WaiterInterface.tsx` wiring

**Files:**
- Create: `src/components/restaurant/BundleOrderModal.tsx`
- Create: `src/components/restaurant/BundleOrderModal.test.tsx`
- Modify: `src/pages/restaurant/WaiterInterface.tsx`

**Interfaces:**
- Consumes: `RestaurantBundle`, `RestaurantBundleCourse`, `RestaurantBundleCourseItem`, `RestaurantMenuItem` (Task 2); `add_bundle_to_order` RPC (Task 1).
- Produces: `BundleOrderModal` default export with props `{ bundle: RestaurantBundle; courses: RestaurantBundleCourse[]; courseItems: RestaurantBundleCourseItem[]; menuItems: RestaurantMenuItem[]; defaultPartySize: number; tableOrderId: string; onClose: () => void; onConfirm: () => void }` — no later task consumes this beyond its own wiring in this task.

**Judgment call:** the spec calls `QuickAddModal` (inline in `WaiterInterface.tsx`) `BundleOrderModal`'s "structural sibling" for **visual/interaction conventions** (bottom sheet, stepper, radio-pill), not for file placement. `QuickAddModal` has no dedicated test file, but the spec explicitly requires `BundleOrderModal.test.tsx`. This codebase's actual convention for **testable, standalone modals wired into `WaiterInterface.tsx`** is a separate file under `src/components/restaurant/` with a co-located test (`TableTransferModal.tsx` + `TableTransferModal.test.tsx`, `BillSplitModal.tsx`, `CloseBillModal.tsx`) — `BundleOrderModal` follows that convention instead, since it needs the isolated test surface those modals have and `QuickAddModal` doesn't.

- [ ] **Step 1: Write the failing test**

Create `src/components/restaurant/BundleOrderModal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, defaultValue: string) => defaultValue }),
}));

import BundleOrderModal from './BundleOrderModal';
import { toast } from 'sonner';
import type { RestaurantBundle, RestaurantBundleCourse, RestaurantBundleCourseItem, RestaurantMenuItem } from '@/types/restaurant';

const bundle: RestaurantBundle = {
  id: 'bundle-1', tenant_id: 't1', name: 'Family Feast', name_ar: null, description: null,
  price_per_guest_usd: 18, is_active: true, active_breakfast: true, active_lunch: true,
  active_dinner: true, sort_order: 0,
};

const courses: RestaurantBundleCourse[] = [
  { id: 'c1', bundle_id: 'bundle-1', tenant_id: 't1', course: 'appetizers', label: 'Choose your appetizer', sort_order: 0 },
  { id: 'c2', bundle_id: 'bundle-1', tenant_id: 't1', course: 'mains', label: 'Choose your main', sort_order: 1 },
];

const courseItems: RestaurantBundleCourseItem[] = [
  { bundle_course_id: 'c1', menu_item_id: 'mi-1' },
  { bundle_course_id: 'c1', menu_item_id: 'mi-2' },
  { bundle_course_id: 'c2', menu_item_id: 'mi-3' },
];

function makeMenuItem(overrides: Partial<RestaurantMenuItem>): RestaurantMenuItem {
  return {
    id: 'mi-x', tenant_id: 't1', category_id: null, name: 'Item', name_ar: null,
    description: null, description_ar: null, photo_url: null, base_price_usd: 5,
    base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [],
    is_featured: false, is_chef_pick: false, is_eighty_sixd: false,
    active_breakfast: true, active_lunch: true, active_dinner: true,
    sort_order: 0, is_active: true,
    ...overrides,
  };
}

const menuItems: RestaurantMenuItem[] = [
  makeMenuItem({ id: 'mi-1', name: 'Fattoush' }),
  makeMenuItem({ id: 'mi-2', name: 'Tabbouleh' }),
  makeMenuItem({ id: 'mi-3', name: 'Grilled Chicken' }),
  makeMenuItem({ id: 'mi-4', name: 'Not Linked' }),
];

const baseProps = {
  bundle,
  courses,
  courseItems,
  menuItems,
  defaultPartySize: 4,
  tableOrderId: 'order-1',
};

describe('BundleOrderModal', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('renders one section per course slot with the label, listing only that slot eligible items', () => {
    render(<BundleOrderModal {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Choose your appetizer')).toBeInTheDocument();
    expect(screen.getByText('Choose your main')).toBeInTheDocument();
    expect(screen.getByText('Fattoush')).toBeInTheDocument();
    expect(screen.getByText('Tabbouleh')).toBeInTheDocument();
    expect(screen.getByText('Grilled Chicken')).toBeInTheDocument();
    expect(screen.queryByText('Not Linked')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/components/restaurant/BundleOrderModal.test.tsx`
Expected: FAIL — `./BundleOrderModal` does not exist yet.

- [ ] **Step 3: Write `BundleOrderModal.tsx`**

Create `src/components/restaurant/BundleOrderModal.tsx`:

```tsx
import { Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { RestaurantBundle, RestaurantBundleCourse, RestaurantBundleCourseItem, RestaurantMenuItem } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

interface BundleOrderModalProps {
  bundle: RestaurantBundle;
  courses: RestaurantBundleCourse[];
  courseItems: RestaurantBundleCourseItem[];
  menuItems: RestaurantMenuItem[];
  defaultPartySize: number;
  tableOrderId: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function BundleOrderModal({
  bundle,
  courses,
  courseItems,
  menuItems,
  defaultPartySize,
  tableOrderId,
  onClose,
  onConfirm,
}: BundleOrderModalProps) {
  const { t } = useTranslation();
  const [partySize, setPartySize] = useState(Math.max(1, defaultPartySize));
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const sortedCourses = [...courses].sort((a, b) => a.sort_order - b.sort_order);

  const eligibleItemsFor = (courseId: string): RestaurantMenuItem[] =>
    courseItems
      .filter((ci) => ci.bundle_course_id === courseId)
      .map((ci) => menuItems.find((mi) => mi.id === ci.menu_item_id))
      .filter((mi): mi is RestaurantMenuItem => mi !== undefined && mi.is_active);

  const selectItem = (courseId: string, menuItemId: string) => {
    setSelections((prev) => ({ ...prev, [courseId]: menuItemId }));
  };

  const allSelected = sortedCourses.length > 0 && sortedCourses.every((c) => selections[c.id] !== undefined);
  const canConfirm = allSelected && partySize >= 1 && !submitting;
  const totalPrice = bundle.price_per_guest_usd * partySize;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const p_course_selections = sortedCourses.map((c) => ({
        bundle_course_id: c.id,
        menu_item_id: selections[c.id],
      }));
      const { error } = await supabase.rpc('add_bundle_to_order', {
        p_table_order_id: tableOrderId,
        p_bundle_id: bundle.id,
        p_party_size: partySize,
        p_course_selections,
      });
      if (error) throw new Error(error.message);
      toast.success(t('restaurant.bundle.added', 'Bundle added — sent to running order'));
      onConfirm();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('restaurant.bundle.addFailed', 'Failed to add bundle'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-slate-900 p-5 pb-safe max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">🎁 {bundle.name}</h3>
            {bundle.name_ar && <p className="text-sm text-white/40" dir="rtl">{bundle.name_ar}</p>}
            <p className="mt-0.5 text-lg font-black text-emerald-400">
              ${bundle.price_per_guest_usd.toFixed(2)} {t('restaurant.bundle.perGuest', 'per guest')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-white/40 hover:bg-white/10 transition-all"
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Party size stepper */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-white/40">
            {t('restaurant.bundle.partySize', 'Party Size')}
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPartySize((p) => Math.max(1, p - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white active:scale-95 transition-all"
              aria-label="Decrease party size"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="w-12 text-center text-2xl font-black text-white">{partySize}</span>
            <button
              onClick={() => setPartySize((p) => p + 1)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white active:scale-95 transition-all"
              aria-label="Increase party size"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Course sections */}
        <div className="mb-5 space-y-5">
          {sortedCourses.map((course) => {
            const eligible = eligibleItemsFor(course.id);
            const selected = selections[course.id];
            return (
              <div key={course.id}>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/60">
                  {course.label}
                </p>
                {eligible.length === 0 ? (
                  <p className="text-xs italic text-white/30">
                    {t('restaurant.bundle.noItemsAvailable', 'Not available right now')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {eligible.map((item) => {
                      const isSelected = selected === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => selectItem(course.id, item.id)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
                            isSelected
                              ? 'border-indigo-500/70 bg-indigo-600/30 text-white'
                              : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10'
                          }`}
                        >
                          <span>{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirm */}
        <button
          onClick={() => { void handleConfirm(); }}
          disabled={!canConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 py-4 text-sm font-bold text-white active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
          {t('restaurant.bundle.addToOrder', 'Add Bundle to Order')} · ${totalPrice.toFixed(2)}
        </button>
        {!allSelected && (
          <p className="mt-2 text-center text-xs text-red-400">
            {t('restaurant.modifier.pleaseSelect', 'Please complete all required selections')}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/components/restaurant/BundleOrderModal.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 5: Add the remaining `BundleOrderModal` tests**

Append these `it` blocks inside the same `describe('BundleOrderModal', ...)` block:

```tsx
  it('Confirm button is disabled until every slot has a selection, enabling after the last one', () => {
    render(<BundleOrderModal {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const confirmBtn = screen.getByRole('button', { name: /add bundle to order/i });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Fattoush'));
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Grilled Chicken'));
    expect(confirmBtn).not.toBeDisabled();
  });

  it('party size stepper defaults to the passed party size, floors at 1, and the running total recomputes', () => {
    render(<BundleOrderModal {...baseProps} defaultPartySize={4} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByLabelText('Decrease party size'));
    }
    expect(screen.getByText('1')).toBeInTheDocument(); // floors at 1, cannot go below
    fireEvent.click(screen.getByLabelText('Increase party size'));
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/\$36\.00/)).toBeInTheDocument(); // 18 * 2
  });

  it('Confirm calls add_bundle_to_order with the exact selection shape, one entry per slot in render order', async () => {
    mockRpc.mockResolvedValue({ data: { order_id: 'order-1', bundle_id: 'bundle-1', charge_item_id: 'item-1', party_size: 4 }, error: null });
    render(<BundleOrderModal {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Fattoush'));
    fireEvent.click(screen.getByText('Grilled Chicken'));
    fireEvent.click(screen.getByRole('button', { name: /add bundle to order/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('add_bundle_to_order', {
        p_table_order_id: 'order-1',
        p_bundle_id: 'bundle-1',
        p_party_size: 4,
        p_course_selections: [
          { bundle_course_id: 'c1', menu_item_id: 'mi-1' },
          { bundle_course_id: 'c2', menu_item_id: 'mi-3' },
        ],
      });
    });
  });

  it('success path shows a success toast and calls onConfirm then onClose', async () => {
    mockRpc.mockResolvedValue({ data: { order_id: 'order-1' }, error: null });
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<BundleOrderModal {...baseProps} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Fattoush'));
    fireEvent.click(screen.getByText('Grilled Chicken'));
    fireEvent.click(screen.getByRole('button', { name: /add bundle to order/i }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('error path shows an error toast and keeps the modal open (does not call onClose)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'order_not_open: status = paid' } });
    const onClose = vi.fn();
    render(<BundleOrderModal {...baseProps} onClose={onClose} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Fattoush'));
    fireEvent.click(screen.getByText('Grilled Chicken'));
    fireEvent.click(screen.getByRole('button', { name: /add bundle to order/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a course slot with zero eligible items renders with no selectable pills and keeps Confirm disabled', () => {
    render(
      <BundleOrderModal
        {...baseProps}
        courseItems={[{ bundle_course_id: 'c1', menu_item_id: 'mi-1' }]}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('Not available right now')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fattoush'));
    expect(screen.getByRole('button', { name: /add bundle to order/i })).toBeDisabled();
  });
```

- [ ] **Step 6: Run the full test file, verify all pass**

Run: `npx vitest run src/components/restaurant/BundleOrderModal.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 7: Wire bundles into `WaiterInterface.tsx` — imports, types, state**

Current import block (`src/pages/restaurant/WaiterInterface.tsx:45-49`):
```ts
import RoleGate from '@/components/RoleGate';
import BillSplitter from '@/components/restaurant/BillSplitter';
import { BillSplitModal } from '@/components/restaurant/BillSplitModal';
import CloseBillModal from '@/components/restaurant/CloseBillModal';
import TableTransferModal from '@/components/restaurant/TableTransferModal';
```

Change to:
```ts
import RoleGate from '@/components/RoleGate';
import BillSplitter from '@/components/restaurant/BillSplitter';
import { BillSplitModal } from '@/components/restaurant/BillSplitModal';
import BundleOrderModal from '@/components/restaurant/BundleOrderModal';
import CloseBillModal from '@/components/restaurant/CloseBillModal';
import TableTransferModal from '@/components/restaurant/TableTransferModal';
```

Current type import block (`src/pages/restaurant/WaiterInterface.tsx:56-71`):
```ts
import type {
  RestaurantTable,
  TableOrder,
  RestaurantOrderItem,
  RestaurantSettings,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantModifierGroup,
  RestaurantModifier,
  CourseType,
  SplitType,
  BillSplitPart,
  PendingOrder,
  PendingOrderItem,
  TableOrderExtended,
} from '@/types/restaurant';
```

Change to:
```ts
import type {
  RestaurantTable,
  TableOrder,
  RestaurantOrderItem,
  RestaurantSettings,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantModifierGroup,
  RestaurantModifier,
  RestaurantBundle,
  RestaurantBundleCourse,
  RestaurantBundleCourseItem,
  CourseType,
  SplitType,
  BillSplitPart,
  PendingOrder,
  PendingOrderItem,
  TableOrderExtended,
} from '@/types/restaurant';
```

- [ ] **Step 8: Extend `MenuBrowserSheet` with a "🎁 Bundles" pill and bundle grid**

Current (`src/pages/restaurant/WaiterInterface.tsx:693-710`):
```tsx
interface MenuBrowserSheetProps {
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  onClose: () => void;
  onSelect: (item: RestaurantMenuItem) => void;
}

function MenuBrowserSheet({ categories, items, onClose, onSelect }: MenuBrowserSheetProps) {
  const { t } = useTranslation();
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');

  const displayed = items.filter((i) => {
    if (!i.is_active) return false;
    if (selectedCat !== 'all' && i.category_id !== selectedCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !(i.name_ar ?? '').includes(search)) return false;
    return true;
  });

  return (
```

Change to:
```tsx
interface MenuBrowserSheetProps {
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  bundles: RestaurantBundle[];
  onClose: () => void;
  onSelect: (item: RestaurantMenuItem) => void;
  onSelectBundle: (bundle: RestaurantBundle) => void;
}

const BUNDLES_PSEUDO_CATEGORY = '__bundles__';

function MenuBrowserSheet({ categories, items, bundles, onClose, onSelect, onSelectBundle }: MenuBrowserSheetProps) {
  const { t } = useTranslation();
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');

  const showingBundles = selectedCat === BUNDLES_PSEUDO_CATEGORY;

  const displayed = items.filter((i) => {
    if (!i.is_active) return false;
    if (selectedCat !== 'all' && i.category_id !== selectedCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !(i.name_ar ?? '').includes(search)) return false;
    return true;
  });

  const displayedBundles = bundles.filter((b) => b.is_active);

  return (
```

Current header count badge (`src/pages/restaurant/WaiterInterface.tsx:725`):
```tsx
          <span className="ms-auto rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">{displayed.length}</span>
```

Change to:
```tsx
          <span className="ms-auto rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">
            {showingBundles ? displayedBundles.length : displayed.length}
          </span>
```

Current category pill row's closing (`src/pages/restaurant/WaiterInterface.tsx:759-773`):
```tsx
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCat === cat.id
                  ? 'bg-amber-500/80 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>
```

Change to:
```tsx
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCat === cat.id
                  ? 'bg-amber-500/80 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
          {bundles.length > 0 && (
            <button
              onClick={() => setSelectedCat(BUNDLES_PSEUDO_CATEGORY)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                showingBundles
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }`}
            >
              🎁 {t('restaurant.bundle.pillLabel', 'Bundles')}
            </button>
          )}
        </div>
      </div>
```

Current item grid section (`src/pages/restaurant/WaiterInterface.tsx:776-832`):
```tsx
      {/* Item grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <UtensilsCrossed className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">{t('restaurant.noItemsFound', 'No items found')}</p>
          </div>
        ) : (
```

Change to:
```tsx
      {/* Item / bundle grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {showingBundles ? (
          displayedBundles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <UtensilsCrossed className="mb-3 h-10 w-10 text-white/20" />
              <p className="text-sm text-white/40">{t('restaurant.bundle.noneFound', 'No bundles found')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {displayedBundles.map((bundle) => (
                <button
                  key={bundle.id}
                  onClick={() => onSelectBundle(bundle)}
                  className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-3 text-start transition-all active:scale-95 hover:border-amber-500/30 hover:bg-white/8"
                >
                  <span className="text-2xl">🎁</span>
                  <p className="mt-1.5 text-xs font-semibold leading-tight text-white line-clamp-2">{bundle.name}</p>
                  <p className="mt-1.5 text-sm font-black text-emerald-400">${bundle.price_per_guest_usd.toFixed(2)}/guest</p>
                </button>
              ))}
            </div>
          )
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <UtensilsCrossed className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">{t('restaurant.noItemsFound', 'No items found')}</p>
          </div>
        ) : (
```

The existing item-grid `<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{displayed.map(...)}</div>` block and its closing `)}` / `</div>` / `</div>` (`src/pages/restaurant/WaiterInterface.tsx:833-835`, the closing of the outer conditional and the two wrapping `</div>`s) are otherwise **unchanged** — the edit above only changes the *opening* of the ternary chain so the existing item-grid branch becomes the final `else` arm.

- [ ] **Step 9: Add `selectedBundle` state and `bundles`/`bundleCourses`/`bundleCourseItems` props to `TableDetail`**

Current `TableDetailProps` and function signature (`src/pages/restaurant/WaiterInterface.tsx:839-852`):
```tsx
interface TableDetailProps {
  tableData: TableWithOrder;
  settings: RestaurantSettings | null;
  menuCategories: RestaurantMenuCategory[];
  menuItems: RestaurantMenuItem[];
  onClose: () => void;
  onOrderClosed: () => void;
  isOnline: boolean;
  allTables: RestaurantTable[];
  allOrders: TableOrder[];
  employees: Employee[];
}

function TableDetail({ tableData, settings, menuCategories, menuItems, onClose, onOrderClosed, isOnline, allTables, allOrders, employees }: TableDetailProps) {
```

Change to:
```tsx
interface TableDetailProps {
  tableData: TableWithOrder;
  settings: RestaurantSettings | null;
  menuCategories: RestaurantMenuCategory[];
  menuItems: RestaurantMenuItem[];
  bundles: RestaurantBundle[];
  bundleCourses: RestaurantBundleCourse[];
  bundleCourseItems: RestaurantBundleCourseItem[];
  onClose: () => void;
  onOrderClosed: () => void;
  isOnline: boolean;
  allTables: RestaurantTable[];
  allOrders: TableOrder[];
  employees: Employee[];
}

function TableDetail({ tableData, settings, menuCategories, menuItems, bundles, bundleCourses, bundleCourseItems, onClose, onOrderClosed, isOnline, allTables, allOrders, employees }: TableDetailProps) {
```

Current menu-browser state (`src/pages/restaurant/WaiterInterface.tsx:926-928`):
```tsx
  // Menu browser state
  const [showMenuBrowser, setShowMenuBrowser] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<RestaurantMenuItem | null>(null);
```

Change to:
```tsx
  // Menu browser state
  const [showMenuBrowser, setShowMenuBrowser] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<RestaurantMenuItem | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<RestaurantBundle | null>(null);
```

- [ ] **Step 10: Wire `MenuBrowserSheet` call site and render `BundleOrderModal`**

Current (`src/pages/restaurant/WaiterInterface.tsx:1645-1656`):
```tsx
      {/* Menu browser */}
      {showMenuBrowser && (
        <MenuBrowserSheet
          categories={menuCategories}
          items={menuItems}
          onClose={() => setShowMenuBrowser(false)}
          onSelect={(item) => {
            setSelectedMenuItem(item);
            setShowMenuBrowser(false);
          }}
        />
      )}
```

Change to:
```tsx
      {/* Menu browser */}
      {showMenuBrowser && (
        <MenuBrowserSheet
          categories={menuCategories}
          items={menuItems}
          bundles={bundles}
          onClose={() => setShowMenuBrowser(false)}
          onSelect={(item) => {
            setSelectedMenuItem(item);
            setShowMenuBrowser(false);
          }}
          onSelectBundle={(bundle) => {
            setSelectedBundle(bundle);
            setShowMenuBrowser(false);
          }}
        />
      )}

      {/* Bundle order modal */}
      {selectedBundle && order?.id && (
        <BundleOrderModal
          bundle={selectedBundle}
          courses={bundleCourses.filter((c) => c.bundle_id === selectedBundle.id)}
          courseItems={bundleCourseItems.filter((ci) =>
            bundleCourses.filter((c) => c.bundle_id === selectedBundle.id).map((c) => c.id).includes(ci.bundle_course_id),
          )}
          menuItems={menuItems}
          defaultPartySize={table.seats}
          tableOrderId={order.id}
          onClose={() => setSelectedBundle(null)}
          onConfirm={() => setSelectedBundle(null)}
        />
      )}
```

- [ ] **Step 11: Fetch bundles at the top level and pass them down to `TableDetail`**

Current state block (`src/pages/restaurant/WaiterInterface.tsx:1754-1755`):
```ts
  const [menuCategories, setMenuCategories] = useState<RestaurantMenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<RestaurantMenuItem[]>([]);
```

Change to:
```ts
  const [menuCategories, setMenuCategories] = useState<RestaurantMenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<RestaurantMenuItem[]>([]);
  const [bundles, setBundles] = useState<RestaurantBundle[]>([]);
  const [bundleCourses, setBundleCourses] = useState<RestaurantBundleCourse[]>([]);
  const [bundleCourseItems, setBundleCourseItems] = useState<RestaurantBundleCourseItem[]>([]);
```

Current `loadData` (`src/pages/restaurant/WaiterInterface.tsx:1776-1809`):
```ts
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [tRes, oRes, oiRes, poRes, sRes, catRes, miRes] = await Promise.all([
        supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId).order('number'),
        supabase.from('table_orders').select('*').eq('tenant_id', tenantId).eq('status', 'open'),
        supabase.from('restaurant_order_items').select('*').eq('tenant_id', tenantId).neq('status', 'served'),
        supabase.from('restaurant_pending_orders').select('*').eq('tenant_id', tenantId).eq('status', 'pending').order('created_at', { ascending: true }),
        supabase.from('restaurant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('restaurant_menu_categories').select('*').eq('tenant_id', tenantId).order('sort_order'),
        supabase.from('restaurant_menu_items').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order'),
      ]);
      if (tRes.data) setTables(tRes.data as RestaurantTable[]);
      if (oRes.data) setOrders(oRes.data as TableOrder[]);
      if (oiRes.data) setAllItems(oiRes.data as RestaurantOrderItem[]);
      if (poRes.data) {
        const fullOrders = poRes.data as PendingOrder[];
        setPendingOrders(fullOrders);
        const counts: Record<string, number> = {};
        fullOrders.forEach(({ table_id }) => {
          counts[table_id] = (counts[table_id] ?? 0) + 1;
        });
        setPendingOrderCounts(counts);
      }
      if (sRes.data) setSettings(sRes.data as RestaurantSettings);
      if (catRes.data) setMenuCategories(catRes.data as RestaurantMenuCategory[]);
      if (miRes.data) setMenuItems(miRes.data as RestaurantMenuItem[]);
    } catch (err) {
      console.error('[WaiterInterface] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId]);
```

Change to:
```ts
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [tRes, oRes, oiRes, poRes, sRes, catRes, miRes, bRes, bcRes, bciRes] = await Promise.all([
        supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId).order('number'),
        supabase.from('table_orders').select('*').eq('tenant_id', tenantId).eq('status', 'open'),
        supabase.from('restaurant_order_items').select('*').eq('tenant_id', tenantId).neq('status', 'served'),
        supabase.from('restaurant_pending_orders').select('*').eq('tenant_id', tenantId).eq('status', 'pending').order('created_at', { ascending: true }),
        supabase.from('restaurant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('restaurant_menu_categories').select('*').eq('tenant_id', tenantId).order('sort_order'),
        supabase.from('restaurant_menu_items').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order'),
        supabase.from('restaurant_bundles').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order'),
        supabase.from('restaurant_bundle_courses').select('*').eq('tenant_id', tenantId).order('sort_order'),
        // No tenant_id column on restaurant_bundle_course_items — RLS scopes it via a join.
        supabase.from('restaurant_bundle_course_items').select('*'),
      ]);
      if (tRes.data) setTables(tRes.data as RestaurantTable[]);
      if (oRes.data) setOrders(oRes.data as TableOrder[]);
      if (oiRes.data) setAllItems(oiRes.data as RestaurantOrderItem[]);
      if (poRes.data) {
        const fullOrders = poRes.data as PendingOrder[];
        setPendingOrders(fullOrders);
        const counts: Record<string, number> = {};
        fullOrders.forEach(({ table_id }) => {
          counts[table_id] = (counts[table_id] ?? 0) + 1;
        });
        setPendingOrderCounts(counts);
      }
      if (sRes.data) setSettings(sRes.data as RestaurantSettings);
      if (catRes.data) setMenuCategories(catRes.data as RestaurantMenuCategory[]);
      if (miRes.data) setMenuItems(miRes.data as RestaurantMenuItem[]);
      if (bRes.data) setBundles(bRes.data as RestaurantBundle[]);
      if (bcRes.data) setBundleCourses(bcRes.data as RestaurantBundleCourse[]);
      if (bciRes.data) setBundleCourseItems(bciRes.data as RestaurantBundleCourseItem[]);
    } catch (err) {
      console.error('[WaiterInterface] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId]);
```

Current `TableDetail` call site (`src/pages/restaurant/WaiterInterface.tsx:2500-2513`):
```tsx
      {selectedTableId && selectedTableData && (
        <TableDetail
          tableData={selectedTableData}
          settings={settings}
          menuCategories={menuCategories}
          menuItems={menuItems}
          onClose={() => setSelectedTableId(null)}
          onOrderClosed={() => { void loadData(); }}
          isOnline={isOnline}
          allTables={tables}
          allOrders={orders}
          employees={employees}
        />
      )}
```

Change to:
```tsx
      {selectedTableId && selectedTableData && (
        <TableDetail
          tableData={selectedTableData}
          settings={settings}
          menuCategories={menuCategories}
          menuItems={menuItems}
          bundles={bundles}
          bundleCourses={bundleCourses}
          bundleCourseItems={bundleCourseItems}
          onClose={() => setSelectedTableId(null)}
          onOrderClosed={() => { void loadData(); }}
          isOnline={isOnline}
          allTables={tables}
          allOrders={orders}
          employees={employees}
        />
      )}
```

- [ ] **Step 12: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 13: Full test suite**

Run: `npm run test`
Expected: all pass (261 pre-existing + 8 new from this task's `BundleOrderModal.test.tsx` — 1 from Step 1 plus 6 from Step 5, since Step 5 also keeps the Step-1 test — i.e. 7 total in that file per Step 6, matching the count there).

- [ ] **Step 14: Commit**

```bash
git add src/components/restaurant/BundleOrderModal.tsx src/components/restaurant/BundleOrderModal.test.tsx src/pages/restaurant/WaiterInterface.tsx
git commit -m "$(cat <<'EOF'
feat(f&b): wire staff bundle ordering into WaiterInterface

New BundleOrderModal (party-size stepper + one single-select radio-pill
section per course slot, calling add_bundle_to_order) as a standalone
component under src/components/restaurant/, matching TableTransferModal's
file+test convention rather than QuickAddModal's inline one (BundleOrderModal
needs the isolated test surface QuickAddModal doesn't have).

MenuBrowserSheet gains a "🎁 Bundles" pill (sharing the existing category-pill
row via a pseudo-category sentinel) that swaps the item grid for a bundle
grid. WaiterInterface's top-level loadData now also fetches
restaurant_bundles/restaurant_bundle_courses/restaurant_bundle_course_items
and threads them down through TableDetail.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `useCart.ts` extension — `bundleItems`, `addBundleItem`, `removeBundleItem`

**Files:**
- Modify: `src/pages/qr-menu/useCart.ts`
- Create: `src/pages/qr-menu/useCart.test.ts` (new file — first test file for this hook)

**Interfaces:**
- Consumes: `QRCartBundleItem`, `QRCartBundleSelection`, `QRMenuBundle` (Task 2).
- Produces: `useCart()` returns `{ items, bundleItems, totalItems, totalPrice, addItem, updateQuantity, removeItem, clearCart, addBundleItem, removeBundleItem }` — `addBundleItem: (bundle: QRMenuBundle, partySize: number, courseSelections: QRCartBundleSelection[]) => void`, `removeBundleItem: (cartKey: string) => void`. Task 8 (`QRMenuPage.tsx`) and Task 9 (`QRCart.tsx`) both consume this exact shape.

- [ ] **Step 1: Write the failing test**

Create `src/pages/qr-menu/useCart.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCart } from './useCart';
import type { QRMenuBundle, QRCartBundleSelection } from '@/types/restaurant';

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
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/pages/qr-menu/useCart.test.ts`
Expected: FAIL — `addBundleItem` does not exist on the object returned by `useCart()`.

- [ ] **Step 3: Extend `useCart.ts`**

Current `src/pages/qr-menu/useCart.ts` in full:
```ts
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
```

Replace the whole file with:
```ts
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
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/pages/qr-menu/useCart.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the remaining `useCart` bundle tests**

Append these `it` blocks (and the `menuItem`/`makeMenuItem` fixture they need) inside the same `describe('useCart — bundle items', ...)` block. First, add this fixture right after the `selections` constant:

```ts
const menuItem: RestaurantMenuItem = {
  id: 'mi-1', tenant_id: 't1', category_id: null, name: 'Hummus', name_ar: null,
  description: null, description_ar: null, photo_url: null, base_price_usd: 5,
  base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [],
  is_featured: false, is_chef_pick: false, is_eighty_sixd: false,
  active_breakfast: true, active_lunch: true, active_dinner: true,
  sort_order: 0, is_active: true,
};
```

(add `RestaurantMenuItem` to the existing `import type { QRMenuBundle, QRCartBundleSelection } from '@/types/restaurant';` line, making it `import type { QRMenuBundle, QRCartBundleSelection, RestaurantMenuItem } from '@/types/restaurant';`)

Then append the tests:
```ts
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
```

- [ ] **Step 6: Run the full test file, verify all pass**

Run: `npx vitest run src/pages/qr-menu/useCart.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/pages/qr-menu/useCart.ts src/pages/qr-menu/useCart.test.ts
git commit -m "$(cat <<'EOF'
feat(f&b): add bundle line support to useCart

bundleItems is a second, parallel array alongside items rather than a
discriminated union — QRCart.tsx's existing item-rendering block is written
entirely against QRCartItem's flat shape, and a bundle line is visually and
behaviorally different enough (no quantity stepper, different card content)
that it renders as its own block regardless. addBundleItem never merges
(unlike addItem's quantity-increment dedup) since two different course
selections have no sensible merge resolution. First test file for this hook.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `QRBundleDetail.tsx` — QR course-choice screen

**Files:**
- Create: `src/pages/qr-menu/QRBundleDetail.tsx`
- Create: `src/pages/qr-menu/QRBundleDetail.test.tsx`

**Interfaces:**
- Consumes: `QRMenuBundle`, `QRMenuBundleCourse`, `RestaurantBundleCourseItem`, `RestaurantMenuItem`, `QRCartBundleSelection` (Task 2).
- Produces: `QRBundleDetail` default export with props `{ bundle: QRMenuBundle; courses: QRMenuBundleCourse[]; courseItems: RestaurantBundleCourseItem[]; menuItems: RestaurantMenuItem[]; lang: 'en' | 'ar'; onClose: () => void; onAddToCart: (bundle: QRMenuBundle, partySize: number, selections: QRCartBundleSelection[]) => void }` — consumed by Task 8's `QRMenuPage.tsx` wiring.

`src/pages/qr-menu/QRItemDetail.tsx` (this component's structural sibling) has **no** existing `QRItemDetail.test.tsx` — confirmed via `find src/pages/qr-menu -name "*.test.*"` (only `QRCart.test.tsx` exists in this directory today). This task establishes the pattern fresh, matching `QRCart.test.tsx`'s `framer-motion` mock shape.

`QRBundleDetail` deliberately omits `QRItemDetail`'s hero-image parallax (`useScroll`/`useTransform`/`heroRef`) since `restaurant_bundles` has no `photo_url` column — there is no image to parallax.

- [ ] **Step 1: Write the failing test**

Create `src/pages/qr-menu/QRBundleDetail.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_target, prop) => prop }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import QRBundleDetail from './QRBundleDetail';
import type { QRMenuBundle, QRMenuBundleCourse, RestaurantBundleCourseItem, RestaurantMenuItem } from '@/types/restaurant';

const bundle: QRMenuBundle = {
  id: 'bundle-1', name: 'Family Feast', name_ar: null, description: 'A great combo', price_per_guest_usd: 18, sort_order: 0,
};

const courses: QRMenuBundleCourse[] = [
  { id: 'c1', bundle_id: 'bundle-1', course: 'appetizers', label: 'Choose your appetizer', sort_order: 0 },
  { id: 'c2', bundle_id: 'bundle-1', course: 'mains', label: 'Choose your main', sort_order: 1 },
];

const courseItems: RestaurantBundleCourseItem[] = [
  { bundle_course_id: 'c1', menu_item_id: 'mi-1' },
  { bundle_course_id: 'c1', menu_item_id: 'mi-2' },
  { bundle_course_id: 'c2', menu_item_id: 'mi-3' },
];

function makeMenuItem(overrides: Partial<RestaurantMenuItem>): RestaurantMenuItem {
  return {
    id: 'mi-x', tenant_id: 't1', category_id: null, name: 'Item', name_ar: null,
    description: null, description_ar: null, photo_url: null, base_price_usd: 5,
    base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [],
    is_featured: false, is_chef_pick: false, is_eighty_sixd: false,
    active_breakfast: true, active_lunch: true, active_dinner: true,
    sort_order: 0, is_active: true,
    ...overrides,
  };
}

const menuItems: RestaurantMenuItem[] = [
  makeMenuItem({ id: 'mi-1', name: 'Fattoush' }),
  makeMenuItem({ id: 'mi-2', name: 'Tabbouleh' }),
  makeMenuItem({ id: 'mi-3', name: 'Grilled Chicken' }),
  makeMenuItem({ id: 'mi-4', name: 'Unrelated Dish' }),
];

describe('QRBundleDetail', () => {
  it('renders one section per course with that course label, listing only that course eligible active items', () => {
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={menuItems} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    expect(screen.getByText('Choose your appetizer')).toBeInTheDocument();
    expect(screen.getByText('Choose your main')).toBeInTheDocument();
    expect(screen.getByText('Fattoush')).toBeInTheDocument();
    expect(screen.getByText('Tabbouleh')).toBeInTheDocument();
    expect(screen.getByText('Grilled Chicken')).toBeInTheDocument();
    expect(screen.queryByText('Unrelated Dish')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/pages/qr-menu/QRBundleDetail.test.tsx`
Expected: FAIL — `./QRBundleDetail` does not exist yet.

- [ ] **Step 3: Write `QRBundleDetail.tsx`**

Create `src/pages/qr-menu/QRBundleDetail.tsx`:

```tsx
import { motion } from 'framer-motion';
import { Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';

import type { QRCartBundleSelection, QRMenuBundle, QRMenuBundleCourse, RestaurantBundleCourseItem, RestaurantMenuItem } from '@/types/restaurant';

interface QRBundleDetailProps {
  bundle: QRMenuBundle;
  courses: QRMenuBundleCourse[];
  courseItems: RestaurantBundleCourseItem[];
  menuItems: RestaurantMenuItem[];
  lang: 'en' | 'ar';
  onClose: () => void;
  onAddToCart: (bundle: QRMenuBundle, partySize: number, selections: QRCartBundleSelection[]) => void;
}

export default function QRBundleDetail({ bundle, courses, courseItems, menuItems, lang, onClose, onAddToCart }: QRBundleDetailProps) {
  const [partySize, setPartySize] = useState(1);
  const [selections, setSelections] = useState<Record<string, string>>({}); // courseId -> menuItemId

  const name = lang === 'ar' && bundle.name_ar ? bundle.name_ar : bundle.name;
  const sortedCourses = [...courses].sort((a, b) => a.sort_order - b.sort_order);

  const eligibleItemsFor = (courseId: string): RestaurantMenuItem[] =>
    courseItems
      .filter((ci) => ci.bundle_course_id === courseId)
      .map((ci) => menuItems.find((mi) => mi.id === ci.menu_item_id))
      .filter((mi): mi is RestaurantMenuItem => mi !== undefined && mi.is_active);

  const selectItem = (courseId: string, menuItemId: string) => {
    setSelections((prev) => ({ ...prev, [courseId]: menuItemId }));
  };

  const allSelected = sortedCourses.length > 0 && sortedCourses.every((c) => selections[c.id] !== undefined);
  const canConfirm = allSelected && partySize >= 1;
  const totalPrice = bundle.price_per_guest_usd * partySize;

  const handleAdd = () => {
    if (!canConfirm) return;
    const built: QRCartBundleSelection[] = sortedCourses.map((c) => {
      const menuItemId = selections[c.id]!;
      const item = menuItems.find((mi) => mi.id === menuItemId);
      return { bundleCourseId: c.id, menuItemId, itemName: item?.name ?? '' };
    });
    onAddToCart(bundle, partySize, built);
    onClose();
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-40 flex flex-col overflow-hidden"
      style={{ background: 'var(--qr-bg)' }}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pb-32 pt-5">
          {/* Header: emoji badge + close, no hero image (bundles have no photo_url) */}
          <div className="mb-4 flex items-start justify-between">
            <span className="text-4xl">🎁</span>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: 'var(--qr-surface-2)' }}
              aria-label="Close"
            >
              <X className="h-5 w-5" style={{ color: 'var(--qr-text)' }} />
            </button>
          </div>

          <h2
            className="mb-1 text-2xl font-bold leading-tight"
            style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {name}
          </h2>
          <p className="text-xl font-semibold" style={{ color: 'var(--qr-accent)' }}>
            ${bundle.price_per_guest_usd.toFixed(2)} / guest
          </p>
          {bundle.description && (
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: 'var(--qr-text-muted)' }}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              {bundle.description}
            </p>
          )}

          {/* Party size stepper — defaults to 1, not table.seats like the staff
              BundleOrderModal: the QR flow has no reliable table-covers data
              client-side, and defaulting low is the safer failure mode. */}
          <div className="mb-6 mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--qr-text-muted)' }}>
              Party Size
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{ background: 'var(--qr-surface-2)', color: 'var(--qr-text)' }}
                aria-label="Decrease party size"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-lg font-bold" style={{ color: 'var(--qr-text)' }}>
                {partySize}
              </span>
              <button
                onClick={() => setPartySize((p) => p + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
                style={{ background: 'var(--qr-surface-2)', color: 'var(--qr-text)' }}
                aria-label="Increase party size"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Courses */}
          <div className="space-y-5">
            {sortedCourses.map((course) => {
              const eligible = eligibleItemsFor(course.id);
              const selected = selections[course.id];
              return (
                <div key={course.id}>
                  <p className="mb-3 font-semibold" style={{ color: 'var(--qr-text)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    {course.label}
                  </p>
                  {eligible.length === 0 ? (
                    <p className="text-sm italic" style={{ color: 'var(--qr-text-muted)' }}>
                      Not available right now
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {eligible.map((item) => {
                        const isSelected = selected === item.id;
                        const itemName = lang === 'ar' && item.name_ar ? item.name_ar : item.name;
                        return (
                          <button
                            key={item.id}
                            onClick={() => selectItem(course.id, item.id)}
                            className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all active:scale-[0.98]"
                            style={{
                              background: isSelected ? 'rgba(var(--qr-accent-rgb), 0.15)' : 'var(--qr-surface)',
                              border: `1px solid ${isSelected ? 'var(--qr-accent)' : 'var(--qr-border)'}`,
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold transition-all"
                                style={{
                                  background: isSelected ? 'var(--qr-accent)' : 'transparent',
                                  border: `2px solid ${isSelected ? 'var(--qr-accent)' : 'var(--qr-border)'}`,
                                  color: 'var(--qr-bg)',
                                }}
                              >
                                {isSelected && '✓'}
                              </div>
                              <span className="text-sm" style={{ color: 'var(--qr-text)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                                {itemName}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed bottom bar */}
      <div className="border-t px-5 py-4" style={{ background: 'var(--qr-surface)', borderColor: 'var(--qr-border)' }}>
        <button
          onClick={handleAdd}
          disabled={!canConfirm}
          className="flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-40"
          style={{
            background: canConfirm ? 'var(--qr-accent)' : 'var(--qr-surface-2)',
            color: canConfirm ? 'var(--qr-bg)' : 'var(--qr-text-muted)',
            boxShadow: canConfirm ? '0 4px 20px rgba(var(--qr-accent-rgb), 0.35)' : 'none',
          }}
        >
          <span>Add to Order</span>
          <span>${totalPrice.toFixed(2)}</span>
        </button>
        {!allSelected && (
          <p className="mt-2 text-center text-xs" style={{ color: '#f87171' }}>
            Please complete all course selections
          </p>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/pages/qr-menu/QRBundleDetail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the remaining `QRBundleDetail` tests**

Append these `it` blocks inside the same `describe('QRBundleDetail', ...)` block:

```tsx
  it('filters out inactive items from a course eligible list', () => {
    const itemsWithInactive = [
      makeMenuItem({ id: 'mi-1', name: 'Fattoush' }),
      makeMenuItem({ id: 'mi-2', name: 'Tabbouleh' }),
      makeMenuItem({ id: 'mi-3', name: 'Grilled Chicken', is_active: false }),
    ];
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={itemsWithInactive} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    expect(screen.queryByText('Grilled Chicken')).not.toBeInTheDocument();
    expect(screen.getByText('Not available right now')).toBeInTheDocument();
  });

  it('a course with zero eligible active items renders a disabled empty state and keeps Confirm disabled', () => {
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={[]} menuItems={menuItems} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    expect(screen.getAllByText('Not available right now')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /add to order/i })).toBeDisabled();
  });

  it('party size stepper defaults to 1, floors at 1, and the running total recomputes', () => {
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={menuItems} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Decrease party size'));
    expect(screen.getByText('1')).toBeInTheDocument(); // floors at 1
    fireEvent.click(screen.getByLabelText('Increase party size'));
    fireEvent.click(screen.getByLabelText('Increase party size'));
    expect(screen.getByText('$54.00')).toBeInTheDocument(); // 18 * 3
  });

  it('Confirm is disabled until every course has a selection, enabling once the last one is filled', () => {
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={menuItems} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    const confirmBtn = screen.getByRole('button', { name: /add to order/i });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Fattoush'));
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Grilled Chicken'));
    expect(confirmBtn).not.toBeDisabled();
  });

  it('Confirm calls onAddToCart with one selection per course, then calls onClose', () => {
    const onAddToCart = vi.fn();
    const onClose = vi.fn();
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={menuItems} lang="en" onClose={onClose} onAddToCart={onAddToCart} />,
    );
    fireEvent.click(screen.getByText('Fattoush'));
    fireEvent.click(screen.getByText('Grilled Chicken'));
    fireEvent.click(screen.getByRole('button', { name: /add to order/i }));
    expect(onAddToCart).toHaveBeenCalledWith(bundle, 1, [
      { bundleCourseId: 'c1', menuItemId: 'mi-1', itemName: 'Fattoush' },
      { bundleCourseId: 'c2', menuItemId: 'mi-3', itemName: 'Grilled Chicken' },
    ]);
    expect(onClose).toHaveBeenCalled();
  });
```

- [ ] **Step 6: Run the full test file, verify all pass**

Run: `npx vitest run src/pages/qr-menu/QRBundleDetail.test.tsx`
Expected: PASS — 6 tests.

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/pages/qr-menu/QRBundleDetail.tsx src/pages/qr-menu/QRBundleDetail.test.tsx
git commit -m "feat(f&b): add QRBundleDetail — QR customer course-choice screen

Mirrors QRItemDetail.tsx's bottom-sheet layout (scrollable content + fixed
bottom bar) but replaces single-item modifier groups with one single-select
picker per course slot. Party size defaults to 1 (not table.seats like the
staff BundleOrderModal) since the QR flow has no reliable table-covers data
client-side - defaulting low is the safer failure mode. No hero image, since
restaurant_bundles has no photo_url column. Establishes this directory's
first *.test.tsx pattern for a QRItemDetail-shaped component (QRItemDetail
itself has none yet).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `QRMenuHome.tsx` (`BundlesSection`/`BundleCard`) + `QRMenuPage.tsx` wiring

**Files:**
- Modify: `src/pages/qr-menu/QRMenuHome.tsx`
- Modify: `src/pages/qr-menu/QRMenuPage.tsx`

**Interfaces:**
- Consumes: `QRMenuBundle`, `QRMenuBundleCourse` (Task 2); `QRBundleDetail` (Task 7); `useCart()`'s `bundleItems`/`addBundleItem`/`removeBundleItem` (Task 6).
- Produces: `QRMenuHomeProps.onSelectBundle: (bundle: QRMenuBundle) => void` — consumed only within this task's own wiring.

**No dedicated test file for this task.** The spec's "Testing (QR-specific additions)" section lists exactly three test surfaces for the whole Addendum — `QRBundleDetail.test.tsx` (Task 7), `QRCart.test.tsx` extension (Task 9), `useCart.test.ts` (Task 6) — and does not list `QRMenuHome.tsx` or `QRMenuPage.tsx`. This is a deliberate scope match to the spec, not an oversight: both files are thin wiring/composition layers (prop threading, view-state routing) with no independent logic of their own to unit-test beyond what Tasks 6/7/9's tests already cover through their consumers. Verification for this task is `npm run typecheck` plus a manual dev-server smoke check.

- [ ] **Step 1: Add `onSelectBundle` prop, `BundleCard`, `BundlesSection` to `QRMenuHome.tsx`**

Current type import (`src/pages/qr-menu/QRMenuHome.tsx:5`):
```ts
import type { QRMenuData, RestaurantMenuItem, QRMenuTenant } from '@/types/restaurant';
```

Change to:
```ts
import type { QRMenuBundle, QRMenuBundleCourse, QRMenuData, RestaurantMenuItem, QRMenuTenant } from '@/types/restaurant';
```

Current `QRMenuHomeProps` (`src/pages/qr-menu/QRMenuHome.tsx:7-20`):
```ts
interface QRMenuHomeProps {
  menuData: QRMenuData;
  lang: 'en' | 'ar';
  tableId: string;
  tableDisplayLabel?: string;
  totalCartItems: number;
  onSelectItem: (item: RestaurantMenuItem) => void;
  onOpenCart: () => void;
  onCallWaiter: () => void;
  onFa7em: () => void;
  promotionalBanner: string | null;
  showBanner: boolean;
  onBannerTap: () => void;
}
```

Change to:
```ts
interface QRMenuHomeProps {
  menuData: QRMenuData;
  lang: 'en' | 'ar';
  tableId: string;
  tableDisplayLabel?: string;
  totalCartItems: number;
  onSelectItem: (item: RestaurantMenuItem) => void;
  onSelectBundle: (bundle: QRMenuBundle) => void;
  onOpenCart: () => void;
  onCallWaiter: () => void;
  onFa7em: () => void;
  promotionalBanner: string | null;
  showBanner: boolean;
  onBannerTap: () => void;
}
```

Insert `BundleCard` and `BundlesSection` right after the `FeaturedSection` function (`src/pages/qr-menu/QRMenuHome.tsx:167-199`) and before the `// Category pills` comment:

```tsx
// Bundle card - simplified ItemCard variant, no photo (restaurant_bundles has no photo_url)
function BundleCard({
  bundle,
  courseCount,
  lang,
  onClick,
}: {
  bundle: QRMenuBundle;
  courseCount: number;
  lang: 'en' | 'ar';
  onClick: () => void;
}) {
  const name = lang === 'ar' && bundle.name_ar ? bundle.name_ar : bundle.name;

  return (
    <motion.div
      onClick={onClick}
      className="qr-item-card qr-glass cursor-pointer overflow-hidden rounded-2xl p-4"
      whileTap={{ scale: 0.97 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-2xl">🎁</span>
          <p
            className="mt-2 truncate text-sm font-semibold"
            style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {name}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--qr-text-muted)' }}>
            {courseCount} course{courseCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-bold" style={{ color: 'var(--qr-accent)' }}>
            ${bundle.price_per_guest_usd.toFixed(2)}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--qr-text-muted)' }}>/ guest</p>
        </div>
      </div>
    </motion.div>
  );
}

// Horizontal "Combos" scroll section - structurally parallel to FeaturedSection
function BundlesSection({
  bundles,
  courses,
  lang,
  onSelectBundle,
}: {
  bundles: QRMenuBundle[];
  courses: QRMenuBundleCourse[];
  lang: 'en' | 'ar';
  onSelectBundle: (bundle: QRMenuBundle) => void;
}) {
  if (bundles.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2 px-4">
        <span className="text-lg">🎁</span>
        <h3 className="text-base font-bold" style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}>
          Combos
        </h3>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
        {bundles.map((bundle) => (
          <div key={bundle.id} className="w-56 flex-shrink-0">
            <BundleCard
              bundle={bundle}
              courseCount={courses.filter((c) => c.bundle_id === bundle.id).length}
              lang={lang}
              onClick={() => onSelectBundle(bundle)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Current destructured props (`src/pages/qr-menu/QRMenuHome.tsx:316-329`):
```tsx
export default function QRMenuHome({
  menuData,
  lang,
  tableId,
  tableDisplayLabel,
  totalCartItems,
  onSelectItem,
  onOpenCart,
  onCallWaiter,
  onFa7em,
  promotionalBanner,
  showBanner,
  onBannerTap,
}: QRMenuHomeProps) {
```

Change to:
```tsx
export default function QRMenuHome({
  menuData,
  lang,
  tableId,
  tableDisplayLabel,
  totalCartItems,
  onSelectItem,
  onSelectBundle,
  onOpenCart,
  onCallWaiter,
  onFa7em,
  promotionalBanner,
  showBanner,
  onBannerTap,
}: QRMenuHomeProps) {
```

Current Featured/Chef's Picks block (`src/pages/qr-menu/QRMenuHome.tsx:364-370`):
```tsx
      {/* Featured */}
      {!selectedCategoryId && (
        <>
          <FeaturedSection items={featuredItems} lang={lang} onSelectItem={onSelectItem} title="Featured" emoji="⭐" />
          <FeaturedSection items={chefPicks} lang={lang} onSelectItem={onSelectItem} title="Chef's Picks" emoji="👨‍🍳" />
        </>
      )}
```

Change to:
```tsx
      {/* Featured */}
      {!selectedCategoryId && (
        <>
          <FeaturedSection items={featuredItems} lang={lang} onSelectItem={onSelectItem} title="Featured" emoji="⭐" />
          <FeaturedSection items={chefPicks} lang={lang} onSelectItem={onSelectItem} title="Chef's Picks" emoji="👨‍🍳" />
          <BundlesSection bundles={menuData.bundles} courses={menuData.bundle_courses} lang={lang} onSelectBundle={onSelectBundle} />
        </>
      )}
```

- [ ] **Step 2: Wire `QRBundleDetail` and bundle state into `QRMenuPage.tsx`**

Current imports (`src/pages/qr-menu/QRMenuPage.tsx:1-16`):
```ts
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import '@/styles/qr-menu-themes.css';

import QRCart from './QRCart';
import QRItemDetail from './QRItemDetail';
import QRMenuHome from './QRMenuHome';
import QROrderSuccess from './QROrderSuccess';
import QRSplash from './QRSplash';
import { useCart, getModifierKey } from './useCart';
import { useQRMenu } from './useQRMenu';

import type { RestaurantMenuItem } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

type MenuView = 'splash' | 'menu' | 'item-detail' | 'cart' | 'success';
```

Change to:
```ts
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import '@/styles/qr-menu-themes.css';

import QRBundleDetail from './QRBundleDetail';
import QRCart from './QRCart';
import QRItemDetail from './QRItemDetail';
import QRMenuHome from './QRMenuHome';
import QROrderSuccess from './QROrderSuccess';
import QRSplash from './QRSplash';
import { useCart, getModifierKey } from './useCart';
import { useQRMenu } from './useQRMenu';

import type { QRCartBundleSelection, QRMenuBundle, RestaurantMenuItem } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

type MenuView = 'splash' | 'menu' | 'item-detail' | 'bundle-detail' | 'cart' | 'success';
```

Current state and `useCart()` destructuring (`src/pages/qr-menu/QRMenuPage.tsx:34-44`):
```ts
  const { data, loading, error } = useQRMenu(tenantSlug);
  const { items, totalItems, totalPrice, addItem, updateQuantity, removeItem, clearCart } = useCart();

  const [view, setView] = useState<MenuView>('splash');
  const [selectedItem, setSelectedItem] = useState<RestaurantMenuItem | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderMode, setOrderMode] = useState<'direct' | 'pending'>('direct');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [fa7emSent, setFa7emSent] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [calledWaiter, setCalledWaiter] = useState(false);
```

Change to:
```ts
  const { data, loading, error } = useQRMenu(tenantSlug);
  const {
    items, bundleItems, totalItems, totalPrice,
    addItem, updateQuantity, removeItem, clearCart,
    addBundleItem, removeBundleItem,
  } = useCart();

  const [view, setView] = useState<MenuView>('splash');
  const [selectedItem, setSelectedItem] = useState<RestaurantMenuItem | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<QRMenuBundle | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderMode, setOrderMode] = useState<'direct' | 'pending'>('direct');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [fa7emSent, setFa7emSent] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [calledWaiter, setCalledWaiter] = useState(false);
```

Current `handleSelectItem`/`handleAddToCart` pair (`src/pages/qr-menu/QRMenuPage.tsx:83-97`):
```ts
  const handleSelectItem = (item: RestaurantMenuItem) => {
    setSelectedItem(item);
    setView('item-detail');
  };

  const handleAddToCart = (
    item: RestaurantMenuItem,
    quantity: number,
    selectedModifiers: Record<string, string[]>,
    notes: string,
    priceDelta: number,
  ) => {
    addItem(item, quantity, selectedModifiers, notes, priceDelta);
    setView('menu');
  };
```

Change to:
```ts
  const handleSelectItem = (item: RestaurantMenuItem) => {
    setSelectedItem(item);
    setView('item-detail');
  };

  const handleAddToCart = (
    item: RestaurantMenuItem,
    quantity: number,
    selectedModifiers: Record<string, string[]>,
    notes: string,
    priceDelta: number,
  ) => {
    addItem(item, quantity, selectedModifiers, notes, priceDelta);
    setView('menu');
  };

  const handleSelectBundle = (bundle: QRMenuBundle) => {
    setSelectedBundle(bundle);
    setView('bundle-detail');
  };

  const handleAddBundleToCart = (bundle: QRMenuBundle, partySize: number, selections: QRCartBundleSelection[]) => {
    addBundleItem(bundle, partySize, selections);
    setView('menu');
  };
```

Current `<QRMenuHome>` render (`src/pages/qr-menu/QRMenuPage.tsx:224-237`):
```tsx
            <QRMenuHome
              menuData={data}
              lang={lang}
              tableId={effectiveTableId}
              tableDisplayLabel={tableParam ?? undefined}
              totalCartItems={totalItems}
              onSelectItem={handleSelectItem}
              onOpenCart={() => setView('cart')}
              onCallWaiter={handleCallWaiter}
              onFa7em={handleFa7em}
              promotionalBanner={data.tenant.qr_menu_promotional_banner ?? 'While you wait - try our freshly made desserts 🍮'}
              showBanner={showBanner}
              onBannerTap={handleBannerTap}
            />
```

Change to:
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
              promotionalBanner={data.tenant.qr_menu_promotional_banner ?? 'While you wait - try our freshly made desserts 🍮'}
              showBanner={showBanner}
              onBannerTap={handleBannerTap}
            />
```

Current item-detail + cart render blocks (`src/pages/qr-menu/QRMenuPage.tsx:252-293`):
```tsx
      {/* Item detail bottom sheet */}
      <AnimatePresence>
        {view === 'item-detail' && selectedItem && (
          <QRItemDetail
            key="item-detail"
            item={selectedItem}
            menuData={data}
            lang={lang}
            onClose={() => setView('menu')}
            onAddToCart={handleAddToCart}
          />
        )}
      </AnimatePresence>

      {/* Cart bottom sheet */}
      <AnimatePresence>
        {view === 'cart' && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cart-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setView('menu')}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            />
            <QRCart
              key="cart"
              items={items}
              tableId={effectiveTableId}
              tableDisplayLabel={tableParam ?? undefined}
              tenantId={data?.tenant.id ?? ''}
              totalPrice={totalPrice}
              onUpdateQuantity={(menuItemId, modKey, qty) => updateQuantity(menuItemId, modKey, qty)}
              onRemoveItem={(menuItemId, modKey) => removeItem(menuItemId, modKey)}
              onClose={() => setView('menu')}
              onSuccess={handleOrderSuccess}
            />
          </>
        )}
      </AnimatePresence>
```

Change to:
```tsx
      {/* Item detail bottom sheet */}
      <AnimatePresence>
        {view === 'item-detail' && selectedItem && (
          <QRItemDetail
            key="item-detail"
            item={selectedItem}
            menuData={data}
            lang={lang}
            onClose={() => setView('menu')}
            onAddToCart={handleAddToCart}
          />
        )}
      </AnimatePresence>

      {/* Bundle detail bottom sheet */}
      <AnimatePresence>
        {view === 'bundle-detail' && selectedBundle && (
          <QRBundleDetail
            key="bundle-detail"
            bundle={selectedBundle}
            courses={data.bundle_courses.filter((c) => c.bundle_id === selectedBundle.id)}
            courseItems={data.bundle_course_items.filter((ci) =>
              data.bundle_courses.filter((c) => c.bundle_id === selectedBundle.id).map((c) => c.id).includes(ci.bundle_course_id),
            )}
            menuItems={data.items}
            lang={lang}
            onClose={() => setView('menu')}
            onAddToCart={handleAddBundleToCart}
          />
        )}
      </AnimatePresence>

      {/* Cart bottom sheet */}
      <AnimatePresence>
        {view === 'cart' && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cart-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setView('menu')}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            />
            <QRCart
              key="cart"
              items={items}
              bundleItems={bundleItems}
              tableId={effectiveTableId}
              tableDisplayLabel={tableParam ?? undefined}
              tenantId={data?.tenant.id ?? ''}
              totalPrice={totalPrice}
              onUpdateQuantity={(menuItemId, modKey, qty) => updateQuantity(menuItemId, modKey, qty)}
              onRemoveItem={(menuItemId, modKey) => removeItem(menuItemId, modKey)}
              onRemoveBundleItem={(cartKey) => removeBundleItem(cartKey)}
              onClose={() => setView('menu')}
              onSuccess={handleOrderSuccess}
            />
          </>
        )}
      </AnimatePresence>
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean - note this step will only turn fully clean once Task 9 gives `QRCart` its `bundleItems`/`onRemoveBundleItem` props; if running Task 8 in isolation before Task 9, `npm run typecheck` will show exactly two expected errors on the `<QRCart>` call site (missing props) that Task 9 resolves. Do not treat those two errors as a Task 8 regression - proceed to Task 9 in the same session before considering this pair of tasks done.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, open a tenant's QR menu URL (`/menu/<tenant-slug>/<table-id>`) for a tenant with at least one active bundle configured (via Task 4's Bundles tab). Confirm: a "Combos" horizontal-scroll section appears below Featured/Chef's Picks (only when no category filter is active); tapping a bundle card opens `QRBundleDetail`; selecting one item per course and tapping "Add to Order" returns to the menu view. (Full cart/checkout behavior is exercised in Task 9.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/qr-menu/QRMenuHome.tsx src/pages/qr-menu/QRMenuPage.tsx
git commit -m "feat(f&b): wire bundle browsing and QRBundleDetail into the QR menu

BundlesSection/BundleCard in QRMenuHome.tsx render a horizontal 'Combos' row
structurally parallel to Featured/Chef's Picks, unfiltered-view only. New
'bundle-detail' view state in QRMenuPage.tsx routes bundle selection to the
new QRBundleDetail screen and threads bundleItems/addBundleItem/removeBundleItem
from useCart through to QRCart (finished in the next commit). No dedicated
test file for this task per the spec's own test plan, which scopes automated
tests to QRBundleDetail/QRCart/useCart only - both files here are thin
wiring layers already exercised through those.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `QRCart.tsx` — combined payload, bundle cart lines, `mapPlaceOrderError`

**Files:**
- Modify: `src/pages/qr-menu/QRCart.tsx`
- Modify: `src/pages/qr-menu/QRCart.test.tsx` (extend the existing file)

**Interfaces:**
- Consumes: `QRCartBundleItem` (Task 2); `bundleItems`/`removeBundleItem` from `useCart()` (Task 6); `qr_place_order`'s combined `p_items` shape (Task 1).
- Produces: nothing consumed by a later task — this is the final leaf in the QR ordering chain.

`QRCart.tsx` already calls `qr_place_order` for regular items only (from the prior `order-item-integrity` feature) — this task extends that existing call, it does not replace it.

- [ ] **Step 1: Write the failing test**

`src/pages/qr-menu/QRCart.test.tsx` currently renders `<QRCart>` three times without `bundleItems`/`onRemoveBundleItem` props. First, widen all three existing render calls to pass the new required props (they will typecheck-fail and behavior-fail until Step 3 adds the props to the component). Apply this exact replacement twice (`replace_all`) across the file:

Old (appears 3 times):
```tsx
      <QRCart
        items={[cartItem]}
```
New:
```tsx
      <QRCart
        items={[cartItem]}
        bundleItems={[]}
```

And this exact replacement twice (`replace_all`) across the file:

Old (appears 3 times):
```tsx
        onRemoveItem={vi.fn()}
        onClose={vi.fn()}
```
New:
```tsx
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
```

Then append this new test at the end of the `describe('QRCart', ...)` block (before its closing `});`):

```tsx
  it('calls qr_place_order with a combined p_items array when the cart has both a regular item and a bundle line', async () => {
    mockRpc.mockResolvedValue({ data: { mode: 'direct', order_id: 'order-abcdef' }, error: null });
    const bundleItem = {
      cartKey: 'bk-1',
      bundleId: 'bundle-1',
      bundleName: 'Family Feast',
      pricePerGuestUsd: 18,
      partySize: 4,
      courseSelections: [
        { bundleCourseId: 'c1', menuItemId: 'mi-2', itemName: 'Fattoush' },
        { bundleCourseId: 'c2', menuItemId: 'mi-3', itemName: 'Grilled Chicken' },
      ],
      totalPrice: 72,
    };
    render(
      <QRCart
        items={[cartItem]}
        bundleItems={[bundleItem]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={82}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('qr_place_order', {
        p_table_id: 'tbl-1',
        p_items: [
          { menu_item_id: 'mi-1', quantity: 2, modifier_ids: ['mod-1'], notes: 'no onions' },
          {
            bundle_id: 'bundle-1',
            party_size: 4,
            course_selections: [
              { bundle_course_id: 'c1', menu_item_id: 'mi-2' },
              { bundle_course_id: 'c2', menu_item_id: 'mi-3' },
            ],
          },
        ],
      });
    });
  });
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/pages/qr-menu/QRCart.test.tsx`
Expected: FAIL — `QRCartProps` has no `bundleItems`/`onRemoveBundleItem`, and the new test's assertion doesn't match the current items-only payload.

- [ ] **Step 3: Extend `QRCart.tsx`**

Current `src/pages/qr-menu/QRCart.tsx` in full:
```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import type { QRCartItem } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

interface QRCartProps {
  items: QRCartItem[];
  tableId: string;
  tableDisplayLabel?: string;
  tenantId: string;
  totalPrice: number;
  onUpdateQuantity: (menuItemId: string, modifierKey: string, quantity: number) => void;
  onRemoveItem: (menuItemId: string, modifierKey: string) => void;
  onClose: () => void;
  onSuccess: (orderNumber: string, mode: 'direct' | 'pending') => void;
}

function getModifierKey(item: QRCartItem): string {
  const modStr = Object.entries(item.selectedModifiers)
    .map(([gId, opts]) => `${gId}:${opts.sort().join(',')}`)
    .sort()
    .join('|');
  return `${item.menuItemId}__${modStr}`;
}

export default function QRCart({ items, tableId, tableDisplayLabel, totalPrice, onUpdateQuantity, onRemoveItem, onClose, onSuccess }: QRCartProps) {
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setPlacing(true);
    setPlaceError(null);
    try {
      const payload = items.map((item) => ({
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        modifier_ids: Object.values(item.selectedModifiers).flat(),
        notes: item.notes || undefined,
      }));

      const { data, error } = (await supabase.rpc('qr_place_order', {
        p_table_id: tableId,
        p_items: payload,
      })) as { data: { mode: 'direct' | 'pending'; order_id: string } | null; error: { message: string } | null };
      if (error) throw new Error(error.message);
      if (!data) throw new Error('qr_place_order returned no data');

      onSuccess(data.order_id.slice(-6).toUpperCase(), data.mode);
    } catch (err) {
      console.error('[QRCart] place order error:', err);
      setPlaceError('Something went wrong placing your order — please try again or ask your server for help.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-3xl"
      style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)' }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3">
        <div className="h-1 w-10 rounded-full" style={{ background: 'var(--qr-border)' }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}>
            Your Order
          </h3>
          {(tableDisplayLabel ?? tableId) && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--qr-text-muted)' }}>
              🪑 {tableDisplayLabel ? `Table ${tableDisplayLabel}` : `Table ${tableId.replace('table-', '')}`}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: 'var(--qr-surface-2)' }}
          aria-label="Close cart"
        >
          <X className="h-4 w-4" style={{ color: 'var(--qr-text-muted)' }} />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <AnimatePresence>
          {items.map((item) => {
            const modKey = getModifierKey(item);
            const modSummary = Object.entries(item.selectedModifiers)
              .flatMap(([, ids]) => ids)
              .join(', ');

            return (
              <motion.div
                key={`${item.menuItemId}-${modKey}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                layout
                className="mb-3 rounded-xl p-4"
                style={{ background: 'var(--qr-surface-2)' }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--qr-text)' }}>
                      {item.menuItem.name}
                    </p>
                    {modSummary && (
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--qr-text-muted)' }}>
                        {modSummary}
                      </p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-xs italic" style={{ color: 'var(--qr-text-muted)' }}>
                        Note: {item.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.menuItemId, modKey)}
                    className="flex-shrink-0 p-1"
                    style={{ color: 'var(--qr-text-muted)' }}
                    aria-label={`Remove ${item.menuItem.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onUpdateQuantity(item.menuItemId, modKey, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-95"
                      style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)' }}
                      aria-label="Decrease"
                    >
                      <Minus className="h-3 w-3" style={{ color: 'var(--qr-text)' }} />
                    </button>
                    <span className="text-sm font-semibold" style={{ color: 'var(--qr-text)' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.menuItemId, modKey, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-95"
                      style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)' }}
                      aria-label="Increase"
                    >
                      <Plus className="h-3 w-3" style={{ color: 'var(--qr-text)' }} />
                    </button>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--qr-accent)' }}>
                    ${item.totalPrice.toFixed(2)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t px-5 py-4" style={{ borderColor: 'var(--qr-border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--qr-text-muted)' }}>
            Total ({items.reduce((s, i) => s + i.quantity, 0)} items)
          </span>
          <div className="text-right">
            <span className="text-xl font-bold" style={{ color: 'var(--qr-text)' }}>
              ${totalPrice.toFixed(2)}
            </span>
            <p className="text-xs mt-0.5" style={{ color: 'var(--qr-text-muted)' }}>
              L.L. {(totalPrice * 89500).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {placeError && (
          <p
            className="mb-3 rounded-xl px-3 py-2 text-center text-xs"
            style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--qr-text)' }}
          >
            {placeError}
          </p>
        )}

        <motion.button
          onClick={() => { void handlePlaceOrder(); }}
          disabled={placing || items.length === 0}
          className="w-full rounded-2xl py-4 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background: 'var(--qr-accent)',
            color: 'var(--qr-bg)',
            boxShadow: '0 4px 24px rgba(var(--qr-accent-rgb), 0.35)',
          }}
          whileTap={{ scale: 0.97 }}
        >
          {placing ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                className="inline-block h-4 w-4 rounded-full border-2"
                style={{ borderColor: 'var(--qr-bg)', borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              />
              Placing Order...
            </span>
          ) : (
            'Place Order'
          )}
        </motion.button>

        <p className="mt-2 text-center text-xs" style={{ color: 'var(--qr-text-muted)' }}>
          Your waiter will be notified immediately
        </p>
      </div>
    </motion.div>
  );
}
```

Replace the whole file with:
```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import type { QRCartBundleItem, QRCartItem } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

interface QRCartProps {
  items: QRCartItem[];
  bundleItems: QRCartBundleItem[];
  tableId: string;
  tableDisplayLabel?: string;
  tenantId: string;
  totalPrice: number;
  onUpdateQuantity: (menuItemId: string, modifierKey: string, quantity: number) => void;
  onRemoveItem: (menuItemId: string, modifierKey: string) => void;
  onRemoveBundleItem: (cartKey: string) => void;
  onClose: () => void;
  onSuccess: (orderNumber: string, mode: 'direct' | 'pending') => void;
}

function getModifierKey(item: QRCartItem): string {
  const modStr = Object.entries(item.selectedModifiers)
    .map(([gId, opts]) => `${gId}:${opts.sort().join(',')}`)
    .sort()
    .join('|');
  return `${item.menuItemId}__${modStr}`;
}

// Known bundle-related exception prefixes raised by qr_place_order's bundle
// branch (see the migration in Task 1) — pattern-matched against the plain
// exception-message string PostgREST returns, same convention this repo
// already uses for no_valid_items/table_not_found etc.
const BUNDLE_ERROR_PREFIXES = [
  'bundle_not_found',
  'bundle_inactive',
  'bundle_has_no_courses',
  'item_not_eligible_for_course',
  'item_no_longer_available',
  'incomplete_course_selection',
  'invalid_party_size',
  'malformed_bundle_item',
  'duplicate_course_selection',
  'course_not_in_bundle',
];

function mapPlaceOrderError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (BUNDLE_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix))) {
    return 'One of your combo selections is no longer available — please remove it from your cart and try again.';
  }
  return 'Something went wrong placing your order — please try again or ask your server for help.';
}

export default function QRCart({
  items,
  bundleItems,
  tableId,
  tableDisplayLabel,
  totalPrice,
  onUpdateQuantity,
  onRemoveItem,
  onRemoveBundleItem,
  onClose,
  onSuccess,
}: QRCartProps) {
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

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
      setPlaceError(mapPlaceOrderError(err));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-3xl"
      style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)' }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3">
        <div className="h-1 w-10 rounded-full" style={{ background: 'var(--qr-border)' }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--qr-heading-font)', color: 'var(--qr-text)' }}>
            Your Order
          </h3>
          {(tableDisplayLabel ?? tableId) && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--qr-text-muted)' }}>
              🪑 {tableDisplayLabel ? `Table ${tableDisplayLabel}` : `Table ${tableId.replace('table-', '')}`}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: 'var(--qr-surface-2)' }}
          aria-label="Close cart"
        >
          <X className="h-4 w-4" style={{ color: 'var(--qr-text-muted)' }} />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        <AnimatePresence>
          {items.map((item) => {
            const modKey = getModifierKey(item);
            const modSummary = Object.entries(item.selectedModifiers)
              .flatMap(([, ids]) => ids)
              .join(', ');

            return (
              <motion.div
                key={`${item.menuItemId}-${modKey}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                layout
                className="mb-3 rounded-xl p-4"
                style={{ background: 'var(--qr-surface-2)' }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--qr-text)' }}>
                      {item.menuItem.name}
                    </p>
                    {modSummary && (
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--qr-text-muted)' }}>
                        {modSummary}
                      </p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-xs italic" style={{ color: 'var(--qr-text-muted)' }}>
                        Note: {item.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.menuItemId, modKey)}
                    className="flex-shrink-0 p-1"
                    style={{ color: 'var(--qr-text-muted)' }}
                    aria-label={`Remove ${item.menuItem.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onUpdateQuantity(item.menuItemId, modKey, item.quantity - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-95"
                      style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)' }}
                      aria-label="Decrease"
                    >
                      <Minus className="h-3 w-3" style={{ color: 'var(--qr-text)' }} />
                    </button>
                    <span className="text-sm font-semibold" style={{ color: 'var(--qr-text)' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.menuItemId, modKey, item.quantity + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-95"
                      style={{ background: 'var(--qr-surface)', border: '1px solid var(--qr-border)' }}
                      aria-label="Increase"
                    >
                      <Plus className="h-3 w-3" style={{ color: 'var(--qr-text)' }} />
                    </button>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--qr-accent)' }}>
                    ${item.totalPrice.toFixed(2)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Bundle cart lines — no quantity stepper; party size isn't adjustable
            in-cart (see useCart.ts design note), remove is the only control. */}
        <AnimatePresence>
          {bundleItems.map((b) => {
            const summary = b.courseSelections.map((cs) => cs.itemName).join(', ');
            return (
              <motion.div
                key={b.cartKey}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                layout
                className="mb-3 rounded-xl p-4"
                style={{ background: 'var(--qr-surface-2)' }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--qr-text)' }}>
                      🎁 {b.bundleName}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--qr-text-muted)' }}>
                      for {b.partySize} guest{b.partySize !== 1 ? 's' : ''}
                    </p>
                    {summary && (
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--qr-text-muted)' }}>
                        {summary}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveBundleItem(b.cartKey)}
                    className="flex-shrink-0 p-1"
                    style={{ color: 'var(--qr-text-muted)' }}
                    aria-label={`Remove ${b.bundleName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-end">
                  <span className="text-sm font-bold" style={{ color: 'var(--qr-accent)' }}>
                    ${b.totalPrice.toFixed(2)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t px-5 py-4" style={{ borderColor: 'var(--qr-border)' }}>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--qr-text-muted)' }}>
            Total ({items.reduce((s, i) => s + i.quantity, 0) + bundleItems.length} items)
          </span>
          <div className="text-right">
            <span className="text-xl font-bold" style={{ color: 'var(--qr-text)' }}>
              ${totalPrice.toFixed(2)}
            </span>
            <p className="text-xs mt-0.5" style={{ color: 'var(--qr-text-muted)' }}>
              L.L. {(totalPrice * 89500).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {placeError && (
          <p
            className="mb-3 rounded-xl px-3 py-2 text-center text-xs"
            style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--qr-text)' }}
          >
            {placeError}
          </p>
        )}

        <motion.button
          onClick={() => { void handlePlaceOrder(); }}
          disabled={placing || (items.length === 0 && bundleItems.length === 0)}
          className="w-full rounded-2xl py-4 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background: 'var(--qr-accent)',
            color: 'var(--qr-bg)',
            boxShadow: '0 4px 24px rgba(var(--qr-accent-rgb), 0.35)',
          }}
          whileTap={{ scale: 0.97 }}
        >
          {placing ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                className="inline-block h-4 w-4 rounded-full border-2"
                style={{ borderColor: 'var(--qr-bg)', borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
              />
              Placing Order...
            </span>
          ) : (
            'Place Order'
          )}
        </motion.button>

        <p className="mt-2 text-center text-xs" style={{ color: 'var(--qr-text-muted)' }}>
          Your waiter will be notified immediately
        </p>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/pages/qr-menu/QRCart.test.tsx`
Expected: PASS — 4 tests (3 existing + 1 new).

- [ ] **Step 5: Add the remaining `QRCart` bundle tests**

Append these `it` blocks inside the same `describe('QRCart', ...)` block:

```tsx
  it('cart with only a bundle line (no regular items) still enables Place Order and calls the RPC with just the bundle-add element', async () => {
    mockRpc.mockResolvedValue({ data: { mode: 'direct', order_id: 'order-bundleonly' }, error: null });
    const bundleItem = {
      cartKey: 'bk-1',
      bundleId: 'bundle-1',
      bundleName: 'Family Feast',
      pricePerGuestUsd: 18,
      partySize: 2,
      courseSelections: [{ bundleCourseId: 'c1', menuItemId: 'mi-2', itemName: 'Fattoush' }],
      totalPrice: 36,
    };
    render(
      <QRCart
        items={[]}
        bundleItems={[bundleItem]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={36}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    const placeButton = screen.getByRole('button', { name: /place order/i });
    expect(placeButton).not.toBeDisabled();
    fireEvent.click(placeButton);
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('qr_place_order', {
        p_table_id: 'tbl-1',
        p_items: [
          { bundle_id: 'bundle-1', party_size: 2, course_selections: [{ bundle_course_id: 'c1', menu_item_id: 'mi-2' }] },
        ],
      });
    });
  });

  it('onRemoveBundleItem is called with the correct cartKey when a bundle cart line is removed', () => {
    const onRemoveBundleItem = vi.fn();
    const bundleItem = {
      cartKey: 'bk-1',
      bundleId: 'bundle-1',
      bundleName: 'Family Feast',
      pricePerGuestUsd: 18,
      partySize: 2,
      courseSelections: [],
      totalPrice: 36,
    };
    render(
      <QRCart
        items={[]}
        bundleItems={[bundleItem]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={36}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={onRemoveBundleItem}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remove Family Feast'));
    expect(onRemoveBundleItem).toHaveBeenCalledWith('bk-1');
  });

  it('a bundle-related RPC error renders the mapped combo-specific message, not the generic fallback', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'item_not_eligible_for_course: item mi-2 not eligible for course c1' } });
    render(
      <QRCart
        items={[cartItem]}
        bundleItems={[]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(screen.getByText(/one of your combo selections/i)).toBeInTheDocument();
    });
  });

  it('a non-bundle RPC error still renders the existing generic message, unchanged', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'no_valid_items' } });
    render(
      <QRCart
        items={[cartItem]}
        bundleItems={[]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/one of your combo selections/i)).not.toBeInTheDocument();
  });
```

- [ ] **Step 6: Run the full test file, verify all pass**

Run: `npx vitest run src/pages/qr-menu/QRCart.test.tsx`
Expected: PASS — 8 tests (3 pre-existing, extended with new props, + 5 new).

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean — this is also where Task 8's two deferred errors (from its Step 3 note) resolve, since `<QRCart>` in `QRMenuPage.tsx` now has a component that actually accepts `bundleItems`/`onRemoveBundleItem`.

- [ ] **Step 8: Full test suite**

Run: `npm run test`
Expected: all pass — 261 pre-existing + 1 (Task 6, `useCart.test.ts`, 5 tests total but this is the file's first commit so it's +5 not +1 relative to baseline) + 7 (Task 5, `BundleOrderModal.test.tsx`) + 6 (Task 7, `QRBundleDetail.test.tsx`) + 7 (Task 4, `MenuManagement.test.tsx`) + 8 (this task, `QRCart.test.tsx`, replacing the pre-existing 3) = baseline 261 − 3 (superseded `QRCart.test.tsx` tests, now folded into the 8) + 5 + 7 + 6 + 7 + 8 = **291 passing**. Run `npm run test` and confirm the actual final count matches this arithmetic; if it doesn't, investigate before committing rather than assuming the plan's arithmetic is authoritative over the actual run.

- [ ] **Step 9: Commit**

```bash
git add src/pages/qr-menu/QRCart.tsx src/pages/qr-menu/QRCart.test.tsx
git commit -m "feat(f&b): extend QRCart for combined regular-item + bundle checkout

handlePlaceOrder now concatenates the existing regular-item payload with a
new bundle-add payload (bundle_id/party_size/course_selections) into one
p_items array for a single qr_place_order call, matching the Backend design's
'single atomic call' choice. New mapPlaceOrderError helper pattern-matches
the RPC's bundle-related exception prefixes into a shared, friendlier cart
message, falling through to the existing generic copy for anything else.
Bundle cart lines render in their own block with no quantity stepper (party
size isn't editable in-cart) - remove is the only control.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage.** Walked every section of `docs/superpowers/specs/2026-07-08-preset-order-bundles-design.md` (main spec + Addendum) against the 9 tasks above:

| Spec section | Task |
|---|---|
| Data Model (3 tables, `bundle_id` column, RLS) | Task 1 |
| `add_bundle_to_order` RPC | Task 1 |
| `deduct_recipe_ingredients`/KDS/`fn_close_restaurant_bill` "no changes" | Verified, not touched anywhere in this plan (confirmed correct by inspection during research) |
| `get_public_menu` extension | Task 1 |
| Admin CRUD (Bundles tab, `BundlesManager`, `BundleFormModal`) | Task 4 |
| Staff ordering (`BundleOrderModal`, `MenuBrowserSheet` pill) | Task 5 |
| Types (`RestaurantBundle` family, `bundle_id` fields) | Task 2 |
| Error Handling table (main spec) | Covered by Task 1's RPC exceptions + Task 4/5's client-side gates (empty-eligible-item guards, `party_size` floors) |
| Testing plan (`BundleOrderModal.test.tsx`, `MenuManagement.test.tsx` Bundles describe, manual RPC smoke tests) | Tasks 5, 4, 1 |
| Addendum: `qr_place_order` full replacement | Task 1 |
| Addendum: `PendingOrderItem.bundle_id` corollary | Task 3 |
| Addendum: QR types (`QRMenuBundle`, `QRMenuBundleCourse`, `QRCartBundleItem`/`QRCartBundleSelection`) | Task 2 |
| Addendum: `useCart.ts` bundle array | Task 6 |
| Addendum: `QRBundleDetail.tsx` | Task 7 |
| Addendum: `QRMenuHome.tsx`/`QRMenuPage.tsx` wiring | Task 8 |
| Addendum: `QRCart.tsx` payload + error mapping | Task 9 |
| Addendum Error Handling table (QR-specific) | Covered by Task 1's whole-transaction-rollback design + Task 9's `mapPlaceOrderError` |
| Addendum Testing plan (`QRBundleDetail.test.tsx`, `QRCart.test.tsx` extension, `useCart.test.ts`) | Tasks 7, 9, 6 |

No gaps found.

**2. Placeholder scan.** Grepped the plan for `TBD`, `[INSERT`, `similar to task`, `add appropriate`, `handle edge cases`, `xxx`, `placeholder` (case-insensitive) — every hit is a legitimate use (HTML `placeholder` attributes on form inputs, `getByPlaceholderText` test queries, or the explicitly-explained "bracketed placeholders" convention in Task 1's manual SQL steps, where the tester substitutes real UUIDs). No vague/deferred instructions found.

**3. Type consistency.** Cross-checked names and shapes across tasks:
- `RestaurantBundle`/`RestaurantBundleCourse`/`RestaurantBundleCourseItem` (Task 2) — field names match the migration's column names (Task 1) and every later task's usage (Tasks 4, 5, 8).
- `QRMenuBundle`/`QRMenuBundleCourse` (Task 2) — match `get_public_menu`'s projected JSON keys (Task 1) and `QRBundleDetail`/`QRMenuHome`/`QRMenuPage` usage (Tasks 7, 8).
- `QRCartBundleItem`/`QRCartBundleSelection` (Task 2) — `cartKey`/`bundleId`/`bundleName`/`pricePerGuestUsd`/`partySize`/`courseSelections`/`totalPrice` used identically in Task 6 (`useCart.ts`), Task 8 (`QRMenuPage.tsx` wiring), and Task 9 (`QRCart.tsx` rendering + test fixtures).
- `BundleOrderModal`'s props (`bundle`, `courses`, `courseItems`, `menuItems`, `defaultPartySize`, `tableOrderId`, `onClose`, `onConfirm`) are identical between Task 5's component definition, its test file, and Task 5's own `WaiterInterface.tsx` call site.
- `QRBundleDetail`'s props (`bundle`, `courses`, `courseItems`, `menuItems`, `lang`, `onClose`, `onAddToCart`) are identical between Task 7's component/test and Task 8's `QRMenuPage.tsx` call site.
- `add_bundle_to_order`'s RPC parameter names (`p_table_order_id`, `p_bundle_id`, `p_party_size`, `p_course_selections`) match between Task 1's SQL and Task 5's `BundleOrderModal` RPC call (both the implementation and its test's `toHaveBeenCalledWith` assertion).
- `qr_place_order`'s bundle-add element shape (`bundle_id`, `party_size`, `course_selections` → `{ bundle_course_id, menu_item_id }`) matches between Task 1's SQL, Task 9's `QRCart.tsx` payload construction, and Task 9's test assertions.

No mismatches found.

## Judgment calls made (not fully spelled out in the spec)

1. **Migration renumbered `000060`, not `000058`** — see "Migration numbering — correction to the spec" in Global Constraints. This worktree branch is currently one commit behind `main` (missing `20260708_000059_fix_close_bill_overload_ambiguity.sql`, which landed on `main` after this branch was created) — a prerequisite merge/rebase is called out before Task 1.
2. **`BundlesManager`/`BundleFormModal` defined inline in `MenuManagement.tsx`**, not as separate files — matches every other tab's components in that exact file (`MenuBuilder`/`ItemFormModal`, `WaiterOrderPanel`, `QRMenuSettings` are all inline; none are split out).
3. **`BundleOrderModal` is a separate file** (`src/components/restaurant/BundleOrderModal.tsx` + co-located test), not inline next to `QuickAddModal` in `WaiterInterface.tsx` — because the spec explicitly requires a standalone `BundleOrderModal.test.tsx`, and this codebase's convention for testable standalone modals wired into `WaiterInterface.tsx` is a separate file (`TableTransferModal.tsx`), while `QuickAddModal` (untested) stays inline. The "structural sibling" language in the spec is read as a UX-convention reference (stepper/pill visuals), not a file-location mandate.
4. **Tasks 8's `QRMenuHome.tsx`/`QRMenuPage.tsx` wiring has no dedicated test file** — the spec's own "Testing (QR-specific additions)" section lists exactly three test surfaces for the Addendum (`QRBundleDetail.test.tsx`, `QRCart.test.tsx` extension, `useCart.test.ts`) and does not list these two files. Treated as a deliberate scope match, not a gap to fill in unilaterally — noted explicitly in Task 8 rather than silently adding tests the spec didn't ask for.
5. **`PendingOrderItem.menu_item_id` widened from `string` to `string | null`** in Task 2 — a necessary consequence of the Addendum's `qr_place_order` queuing a bundle charge line with `'menu_item_id', NULL` into `restaurant_pending_orders.items`; verified safe by checking every current consumer of `PendingOrderItem` (`PendingOrderModal` in `WaiterInterface.tsx` never dereferences `menu_item_id`).
6. **Task 3 (the `confirmPendingOrder` corollary fix) has no dedicated unit test** — neither `useRestaurantOrder.ts` nor `WaiterInterface.tsx` has any existing test file, and adding a first-ever test harness for either was judged out of this feature's scope. Correctness is instead verified via Task 1's manual SQL step 2k, which explicitly checks `bundle_id` survives the pending → confirmed transition.

---

**REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
