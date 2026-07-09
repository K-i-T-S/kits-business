-- ============================================================
-- Migration: Explicit Active-Tenant Selection
--
-- Root cause: current_tenant_id()/current_user_role() (defined in
-- 20250617_000000_initial_schema.sql) resolved a user's tenant via
-- `SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND
-- is_active = true LIMIT 1` — no ORDER BY. For any user belonging to
-- 2+ tenants, which row this resolved to was UNDEFINED. These two
-- functions back ~197 RLS policy references across virtually the
-- whole schema, so any multi-tenant user had an effectively random
-- "which business am I operating on" for every RLS-scoped read/write.
--
-- The platform's own kits.tech.co@gmail.com admin account is
-- auto-added to every tenant on the platform by a trigger in
-- 20260618_000021_roles_and_custom_roles.sql, making it the account
-- most likely to hit this — confirmed as the cause of a real "unable
-- to create a new demo account" failure on 2026-07-09: create_tenant
-- (SECURITY DEFINER, bypasses RLS) succeeded, but OnboardingWizard's
-- subsequent client-side writes (tenants UPDATE, products INSERT)
-- resolved current_tenant_id() to a DIFFERENT, pre-existing tenant —
-- silently dropping the business-profile save, then hard-failing the
-- product insert with a raw RLS error ("new row violates row-level
-- security policy for table products").
--
-- Fix: a dedicated user_active_tenant table (one row per user) makes
-- "which tenant is this user currently on" explicit and deterministic
-- — no ordering, no ties. Every place that puts a user onto a tenant
-- (create_tenant, both invite-acceptance paths, the TenantSelection
-- picker) upserts it. A backfill seeds it for all existing users
-- before the function rewrite below, so the deploy itself does not
-- lock anyone out.
--
-- Full design: docs/superpowers/specs/2026-07-09-active-tenant-selection-design.md
-- ============================================================

-- ── 1. New table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_active_tenant (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_active_tenant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own active tenant" ON user_active_tenant
  FOR SELECT USING (user_id = auth.uid());

GRANT SELECT ON user_active_tenant TO authenticated;
-- Deliberately no INSERT/UPDATE/DELETE grant to authenticated: every
-- write goes through select_active_tenant() / create_tenant() /
-- accept_pending_invitation() / handle_new_user_invite(), all
-- SECURITY DEFINER and all verifying tenant membership server-side
-- before writing. Granting direct table writes here would let a
-- client set their own active tenant to any tenant_id with zero
-- membership check.

-- ── 2. Backfill existing users BEFORE the function rewrite ──────
-- Must happen before step 3 flips current_tenant_id()/current_user_role()
-- over to read from this table, or every existing user (not just
-- multi-tenant ones) is NULL-locked out of every RLS-scoped table the
-- instant this migration finishes.

INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
SELECT DISTINCT ON (user_id) user_id, tenant_id, now()
FROM tenant_users
WHERE is_active = true
ORDER BY user_id, created_at ASC
ON CONFLICT (user_id) DO NOTHING;

-- ── 3. Rewrite the RLS helper functions ──────────────────────────

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT tu.tenant_id
    FROM user_active_tenant uat
    JOIN tenant_users tu
      ON tu.tenant_id = uat.tenant_id
     AND tu.user_id   = uat.user_id
     AND tu.is_active  = true
    WHERE uat.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT tu.role
    FROM user_active_tenant uat
    JOIN tenant_users tu
      ON tu.tenant_id = uat.tenant_id
     AND tu.user_id   = uat.user_id
     AND tu.is_active  = true
    WHERE uat.user_id = auth.uid();
$$;

-- ── 4. New RPC: select_active_tenant ─────────────────────────────
-- Called by the frontend whenever a user picks a tenant from the
-- "Choose Your Business" screen.

CREATE OR REPLACE FUNCTION select_active_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
  VALUES (auth.uid(), p_tenant_id, now())
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = p_tenant_id, updated_at = now();

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION select_active_tenant(uuid) FROM anon;

-- ── 5. create_tenant: activate the tenant the creator just made ──
-- Unchanged signature/behavior except the added upsert at the end —
-- this is what makes OnboardingWizard work immediately after tenant
-- creation with no extra frontend round-trip, regardless of how many
-- other tenants the creator already belongs to.

CREATE OR REPLACE FUNCTION public.create_tenant(tenant_name text, tenant_slug text, owner_user_id uuid, settings jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    new_tenant_id UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM owner_user_id THEN
        RAISE EXCEPTION 'Not authorized: you may only create a tenant naming yourself as owner';
    END IF;
    INSERT INTO tenants (name, slug, settings) VALUES (tenant_name, tenant_slug, settings)
    RETURNING id INTO new_tenant_id;
    INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (new_tenant_id, owner_user_id, 'owner');

    INSERT INTO user_active_tenant (user_id, tenant_id, updated_at)
    VALUES (owner_user_id, new_tenant_id, now())
    ON CONFLICT (user_id) DO UPDATE SET tenant_id = new_tenant_id, updated_at = now();

    RETURN new_tenant_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_tenant(text, text, uuid, jsonb) FROM anon;

-- ── 6. accept_pending_invitation: activate the joined tenant ─────
-- Unchanged signature/return shape except the added upsert. This one
-- is load-bearing, not optional: an invited user who accepts via this
-- RPC never passes through the TenantSelection picker, so without
-- this upsert they would be NULL-locked out of the tenant they just
-- joined on their very next query.

CREATE OR REPLACE FUNCTION accept_pending_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

GRANT EXECUTE ON FUNCTION accept_pending_invitation(UUID) TO authenticated;

-- ── 7. handle_new_user_invite: activate the joined tenant ─────────
-- Fires when a brand-new user signs up with an email that has a
-- pending invitation. Same load-bearing reasoning as step 6 — this
-- path never touches TenantSelection.tsx either.

CREATE OR REPLACE FUNCTION public.handle_new_user_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_invite public.pending_invitations%ROWTYPE;
    v_tenant_id UUID;
BEGIN
    -- Find an unaccepted invitation for this email
    SELECT * INTO v_invite
    FROM public.pending_invitations
    WHERE email = NEW.email
      AND accepted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
        -- No invite — user signed up independently, nothing to do.
        RETURN NEW;
    END IF;

    v_tenant_id := v_invite.tenant_id;

    -- Add the user to the tenant with the invited role
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, NEW.id, v_invite.role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        role       = v_invite.role,
        is_active  = true,
        updated_at = NOW();

    INSERT INTO public.user_active_tenant (user_id, tenant_id, updated_at)
    VALUES (NEW.id, v_tenant_id, now())
    ON CONFLICT (user_id) DO UPDATE SET tenant_id = v_tenant_id, updated_at = now();

    -- Create the employee record for non-owner roles
    IF v_invite.role IN ('manager', 'cashier') THEN
        INSERT INTO public.employees (
            tenant_id, user_id, name, email, role, commission_rate
        )
        VALUES (
            v_tenant_id,
            NEW.id,
            v_invite.name,
            NEW.email,
            v_invite.role,
            COALESCE(v_invite.commission, 0)
        )
        ON CONFLICT DO NOTHING;
    END IF;

    -- Mark invite as accepted
    UPDATE public.pending_invitations
    SET accepted_at = NOW(),
        status      = 'accepted'
    WHERE id = v_invite.id;

    RETURN NEW;
END;
$$;

-- Recreate the trigger (DROP+CREATE to ensure function binding is refreshed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_invite();
