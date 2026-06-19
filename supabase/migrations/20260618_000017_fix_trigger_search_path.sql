-- ============================================================
-- Fix: handle_new_user_invite trigger function fails on signup.
--
-- Root cause: Supabase auth service uses supabase_auth_admin role
-- with a restricted search_path that does NOT include 'public'.
-- Without SET search_path = 'public', any reference to public
-- schema tables (pending_invitations, tenant_users, employees)
-- raises "relation does not exist", causing ALL signups to fail
-- with "Database error saving new user" (HTTP 500).
--
-- Fix: recreate the function with SET search_path = 'public' and
-- fully schema-qualified table names as defense in depth.
-- ============================================================

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
