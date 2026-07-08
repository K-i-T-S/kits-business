-- Migration: 20260708_000062_preset_order_bundles.sql
-- Preset Order Bundles (Tier 2.1) — schema, staff RPC, QR ordering extension.
-- See docs/superpowers/specs/2026-07-08-preset-order-bundles-design.md for full design.
--
-- Numbered 000062 (not 000058 as an earlier draft of the spec said) because
-- 20260708_000058_security_performance_audit.sql,
-- 20260708_000059_fix_close_bill_overload_ambiguity.sql,
-- 20260708_000060_supabase_deep_clean.sql, and
-- 20260708_000061_fix_tenant_slug_duplicate_column.sql all landed on main
-- after this feature's spec was written. This file must be applied after 000061.

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
