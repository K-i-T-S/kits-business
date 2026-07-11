-- Wire the QR customer menu's "Call Waiter" and "Fa7em" (coal-call) buttons
-- to real backend calls (Tier 0.2, docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
--
-- Confirmed during research: both buttons only ever did local React state +
-- a customer-facing toast ("Waiter on the way!") -- zero Supabase calls,
-- despite prior docs claiming a real-time argile notification flow existed.
-- No staff-facing screen ever learned a customer pressed either button.
--
-- Fa7em: restaurant_argile_events (migration 000036) already has the right
-- shape and ArgileStation.tsx already has a working realtime subscription
-- for INSERTs with event_type = 'fa7em_request' (vibrates + updates state)
-- -- the only missing piece was the INSERT itself. No staff-side changes
-- needed for that half; qr_request_fa7em() below is the only new code.
--
-- Call Waiter: no equivalent table or staff-facing consumer existed at all.
-- restaurant_service_requests is new, minimal, and intentionally scoped to
-- just 'call_waiter' for now -- broader service-request types are Track 2
-- (Role-Native Operational HUBs) scope, not this Tier 0 fix.

CREATE TABLE IF NOT EXISTS restaurant_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES restaurant_tables(id),
  request_type TEXT NOT NULL DEFAULT 'call_waiter' CHECK (request_type IN ('call_waiter')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES employees(id) ON DELETE SET NULL
);

ALTER TABLE restaurant_service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON restaurant_service_requests
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_service_requests_tenant_status
  ON restaurant_service_requests(tenant_id, status, created_at DESC);

-- Anonymous QR customer calls this. Resolves tenant_id server-side from
-- the table (never trusts a client-supplied tenant id), matching the
-- qr_place_order() pattern from migration 000057.
CREATE OR REPLACE FUNCTION qr_call_waiter(p_table_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM restaurant_tables WHERE id = p_table_id;
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'table_not_found');
  END IF;

  INSERT INTO restaurant_service_requests (tenant_id, table_id, request_type)
  VALUES (v_tenant_id, p_table_id, 'call_waiter');

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Anonymous QR customer calls this. Requires an active argile session for
-- the table (a fa7em/coal-refill request only makes sense if the table
-- already has one) -- returns success:false with a specific reason rather
-- than a hard error, so the frontend can show an appropriate message
-- instead of a generic failure.
CREATE OR REPLACE FUNCTION qr_request_fa7em(p_table_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_session_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM restaurant_tables WHERE id = p_table_id;
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'table_not_found');
  END IF;

  SELECT id INTO v_session_id
  FROM restaurant_argile_sessions
  WHERE table_id = p_table_id AND status = 'active'
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_session');
  END IF;

  INSERT INTO restaurant_argile_events (tenant_id, session_id, table_id, event_type)
  VALUES (v_tenant_id, v_session_id, p_table_id, 'fa7em_request');

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION qr_call_waiter(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION qr_request_fa7em(uuid) TO anon, authenticated;
