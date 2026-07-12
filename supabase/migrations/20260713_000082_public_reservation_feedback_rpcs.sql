-- Fixes BUG-080 (docs/qa-bug-tracker.md): public reservation booking and table
-- feedback are completely non-functional for real anonymous customers.
--
-- Root causes, independently re-verified live against pg_policies/pg_get_functiondef
-- before writing this migration:
--   1. Both pages queried `tenants.tenant_slug`, a column dropped by migration
--      000061 (only `slug` remains) -- the query itself errors for every visitor.
--   2. `tenants`' only SELECT policy is `id = current_tenant_id()`, which is NULL
--      (false) for an anonymous visitor -- blocked even if the column existed.
--   3. `reservations`' INSERT policy requires `tenant_id = current_tenant_id()`,
--      same problem -- an anonymous booking submission would also fail.
--   4. `reservations`' SELECT policy (used by BookReservation.tsx to compute
--      already-booked time slots) has the same anon-blocking shape.
--   5. `restaurant_table_feedback`'s INSERT policy is the opposite problem --
--      `WITH CHECK (true)`, fully open with zero validation that the submitted
--      tenant_id/table_id correspond to anything real.
--
-- Fix follows this codebase's established public-write pattern (get_public_menu,
-- qr_place_order): SECURITY DEFINER RPCs that resolve the tenant server-side from
-- the slug and validate everything before writing, rather than granting anon
-- direct table access. Slot availability is aggregated to counts server-side
-- (matching how BookReservation.tsx actually uses the data -- capacity-check
-- only, never displayed as a guest list) so no other guest's name/phone/party
-- size is ever exposed to a browsing customer.

-- ---------------------------------------------------------------------------
-- 1. Public tenant lookup by slug (branding + contact fields only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_tenant_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'brand_logo_url', brand_logo_url,
    'brand_primary', brand_primary,
    'country', country,
    'phone', phone
  ) INTO v_result
  FROM tenants
  WHERE slug = p_slug;

  IF v_result IS NULL THEN
    RETURN '{"error":"not_found"}'::jsonb;
  END IF;

  RETURN v_result;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Public reservation slot availability (counts only, no guest data exposed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_reservation_slot_counts(p_tenant_slug text, p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_tenant_slug;
  IF v_tenant_id IS NULL THEN
    RETURN '{"error":"not_found"}'::jsonb;
  END IF;

  -- Bucket into 30-minute slots in Beirut local time (not server/session
  -- timezone, and not the viewing browser's timezone -- a customer checking
  -- their booking from abroad must see the same slots a Beirut-based browser
  -- would), matching BookReservation.tsx's SLOT_START_HOUR=11 .. 25 (1am next
  -- day) generation.
  SELECT COALESCE(jsonb_object_agg(slot, cnt), '{}'::jsonb) INTO v_result
  FROM (
    SELECT
      to_char(date_trunc('hour', local_ts) + (floor(date_part('minute', local_ts) / 30) * interval '30 min'), 'HH24:MI') AS slot,
      count(*) AS cnt
    FROM (
      SELECT (reserved_at AT TIME ZONE 'Asia/Beirut') AS local_ts
      FROM reservations
      WHERE tenant_id = v_tenant_id
        AND status NOT IN ('cancelled', 'no_show')
        AND (reserved_at AT TIME ZONE 'Asia/Beirut')::date = p_date
    ) t
    GROUP BY 1
  ) buckets;

  RETURN v_result;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Public reservation submission (validated, tenant resolved server-side)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_public_reservation(
  p_tenant_slug text,
  p_guest_name text,
  p_guest_phone text,
  p_party_size integer,
  p_reserved_at timestamptz,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_reservation_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_tenant_slug;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;

  IF p_guest_name IS NULL OR btrim(p_guest_name) = '' THEN
    RAISE EXCEPTION 'guest_name_required';
  END IF;

  IF p_guest_phone IS NULL OR btrim(p_guest_phone) = '' THEN
    RAISE EXCEPTION 'guest_phone_required';
  END IF;

  IF p_party_size IS NULL OR p_party_size < 1 OR p_party_size > 20 THEN
    RAISE EXCEPTION 'invalid_party_size: %', p_party_size;
  END IF;

  IF p_reserved_at IS NULL OR p_reserved_at < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'invalid_reserved_at';
  END IF;

  IF p_reserved_at > (now() + interval '90 days') THEN
    RAISE EXCEPTION 'reserved_at_too_far_out';
  END IF;

  INSERT INTO reservations (tenant_id, guest_name, guest_phone, party_size, reserved_at, notes, status)
  VALUES (v_tenant_id, btrim(p_guest_name), btrim(p_guest_phone), p_party_size, p_reserved_at, NULLIF(btrim(p_notes), ''), 'pending')
  RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object('id', v_reservation_id, 'status', 'pending');
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Public table-feedback submission (validated, tenant/table relationship
--    checked server-side -- replaces the previously fully-open INSERT policy)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_public_table_feedback(
  p_tenant_slug text,
  p_table_id uuid,
  p_overall_rating integer,
  p_food_rating integer,
  p_service_rating integer,
  p_comment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_feedback_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = p_tenant_slug;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_not_found';
  END IF;

  IF p_overall_rating IS NULL OR p_overall_rating < 1 OR p_overall_rating > 5 THEN
    RAISE EXCEPTION 'invalid_overall_rating: %', p_overall_rating;
  END IF;

  IF p_food_rating IS NOT NULL AND (p_food_rating < 1 OR p_food_rating > 5) THEN
    RAISE EXCEPTION 'invalid_food_rating: %', p_food_rating;
  END IF;

  IF p_service_rating IS NOT NULL AND (p_service_rating < 1 OR p_service_rating > 5) THEN
    RAISE EXCEPTION 'invalid_service_rating: %', p_service_rating;
  END IF;

  -- If a table was specified, it must actually belong to this tenant --
  -- otherwise silently drop it rather than reject the whole submission
  -- (mirrors qr_place_order's "don't trust client data, degrade gracefully"
  -- style rather than erroring on a forged/stale table id).
  IF p_table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM restaurant_tables WHERE id = p_table_id AND tenant_id = v_tenant_id
  ) THEN
    p_table_id := NULL;
  END IF;

  INSERT INTO restaurant_table_feedback (tenant_id, table_id, overall_rating, food_rating, service_rating, comment)
  VALUES (v_tenant_id, p_table_id, p_overall_rating, p_food_rating, p_service_rating, NULLIF(btrim(p_comment), ''))
  RETURNING id INTO v_feedback_id;

  RETURN jsonb_build_object('id', v_feedback_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Close the previously fully-open anon INSERT policy on
--    restaurant_table_feedback -- all public writes now go exclusively
--    through submit_public_table_feedback() above.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "public_insert_feedback" ON public.restaurant_table_feedback;
