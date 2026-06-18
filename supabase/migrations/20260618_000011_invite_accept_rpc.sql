-- ============================================================
-- Invite Accept RPC
-- Run after 20260618_000008_multi_location.sql
-- ============================================================

-- Add status column to pending_invitations (idempotent)
ALTER TABLE pending_invitations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired'));

-- Back-fill: mark existing accepted invitations
UPDATE pending_invitations
SET status = 'accepted'
WHERE accepted_at IS NOT NULL AND status = 'pending';

-- RPC for an existing Supabase user to accept a pending invitation.
-- Called from the /accept-invite page AFTER the user is authenticated.
-- Uses SECURITY DEFINER so it can read auth.users and write tenant_users
-- without relying on the INSERT trigger (which only fires for brand-new users).
CREATE OR REPLACE FUNCTION accept_pending_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id    UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invitation
  FROM pending_invitations
  WHERE id = p_invitation_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already used';
  END IF;

  IF lower(v_invitation.email) != lower(v_user_email) THEN
    RAISE EXCEPTION 'Invitation is for a different email address';
  END IF;

  -- Link user to tenant directly (bypasses current_user_role() check
  -- that would fail for users with no existing tenant context)
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (v_invitation.tenant_id, v_user_id, v_invitation.role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role       = v_invitation.role,
    is_active  = true,
    updated_at = NOW();

  -- Create employee record if role warrants it
  INSERT INTO employees (
    tenant_id, user_id, name, email, role, commission_rate, is_active, created_at
  )
  VALUES (
    v_invitation.tenant_id,
    v_user_id,
    v_invitation.name,
    v_invitation.email,
    v_invitation.role,
    COALESCE(v_invitation.commission, 0),
    true,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  -- Mark invitation accepted
  UPDATE pending_invitations
  SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW())
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object('success', true, 'tenant_id', v_invitation.tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_pending_invitation(UUID) TO authenticated;
