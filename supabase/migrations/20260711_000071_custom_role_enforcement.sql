-- Custom-role enforcement, part 1 (Track 1b-iv,
-- docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
--
-- Two fixes:
--
-- 1. custom_roles.base_role was constrained to only 3 values
--    (manager/cashier/viewer) -- founder-confirmed a custom role should be
--    able to base off any of the 8 canonical roles (e.g. a custom "Junior
--    Accountant" based on accountant wasn't buildable before this).
--
-- 2. accept_pending_invitation() never propagated custom_role_id onto the
--    tenant_users row it creates, even though pending_invitations.
--    custom_role_id and tenant_users.custom_role_id both already existed
--    as columns -- this is the real fix behind Tier 0.4's stopgap
--    (InviteTeamMemberModal's custom-role picker was hidden because
--    selecting one silently dropped to the base role with none of its
--    custom permission overrides). The companion frontend fix
--    (supabase/functions/send-invitation/index.ts actually reading and
--    persisting customRoleId onto pending_invitations) ships alongside
--    this migration, not in it.

ALTER TABLE public.custom_roles DROP CONSTRAINT custom_roles_base_role_check;
ALTER TABLE public.custom_roles ADD CONSTRAINT custom_roles_base_role_check
  CHECK (base_role = ANY (ARRAY['owner', 'admin', 'manager', 'supervisor', 'cashier', 'accountant', 'stockkeeper', 'viewer']));

CREATE OR REPLACE FUNCTION public.accept_pending_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  -- that would fail for users with no existing tenant context).
  -- custom_role_id now propagates from the invitation, where it
  -- previously got silently dropped.
  INSERT INTO tenant_users (tenant_id, user_id, role, custom_role_id)
  VALUES (v_invitation.tenant_id, v_user_id, v_invitation.role, v_invitation.custom_role_id)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role          = v_invitation.role,
    custom_role_id = v_invitation.custom_role_id,
    is_active     = true,
    updated_at    = NOW();

  INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
  VALUES (v_user_id, v_invitation.tenant_id, now())
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = v_invitation.tenant_id, updated_at = now();

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
