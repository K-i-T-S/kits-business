-- ============================================================
-- Auth triggers
-- Run after 20250617_000001_views_and_functions.sql
-- ============================================================

-- When an invited user logs in for the first time, apply their pending invitation:
-- add them to the tenant with the correct role and mark the invite accepted.
CREATE OR REPLACE FUNCTION handle_new_user_invite()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_invite pending_invitations%ROWTYPE;
    v_tenant_id UUID;
BEGIN
    -- Find an unaccepted invitation for this email
    SELECT * INTO v_invite
    FROM pending_invitations
    WHERE email = NEW.email
      AND accepted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
        -- No invite — user signed up independently, nothing to do.
        RETURN NEW;
    END IF;

    v_tenant_id := v_invite.tenant_id;

    -- Add the user to the tenant with the invited role
    INSERT INTO tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, NEW.id, v_invite.role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        role      = v_invite.role,
        is_active = true,
        updated_at = NOW();

    -- Create the employee record if the role has one
    IF v_invite.role IN ('manager', 'cashier') THEN
        INSERT INTO employees (
            tenant_id, user_id, name, email, role, commission_rate
        )
        VALUES (
            v_tenant_id,
            NEW.id,
            v_invite.name,
            NEW.email,
            v_invite.role,
            v_invite.commission
        )
        ON CONFLICT DO NOTHING;
    END IF;

    -- Mark invite as accepted
    UPDATE pending_invitations
    SET accepted_at = NOW()
    WHERE id = v_invite.id;

    RETURN NEW;
END;
$$;

-- Trigger fires after a new auth user is confirmed/created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_invite();
