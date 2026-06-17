-- ============================================================
-- Views, functions, and pending_invitations table
-- Run after 20250617_000000_initial_schema.sql
-- ============================================================

-- Pending invitations: created when an owner invites a new team member.
-- On first login the user's auth trigger applies the invite automatically.
CREATE TABLE IF NOT EXISTS pending_invitations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'cashier'
                    CHECK (role IN ('owner','manager','cashier','viewer')),
    commission  NUMERIC(5,2) NOT NULL DEFAULT 0,
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email)
);

ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- Owners/managers can create and view invitations for their tenant
CREATE POLICY "staff manage invitations" ON pending_invitations
    FOR ALL USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('owner', 'manager')
    );

-- Invitees can read their own pending invitation (needed on first login)
CREATE POLICY "invitee reads own invite" ON pending_invitations
    FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON pending_invitations TO authenticated;

-- View: tenant_user_details
-- Used by TenantSelection page and throughout the app
CREATE OR REPLACE VIEW tenant_user_details AS
SELECT
    t.id           AS tenant_id,
    t.name         AS tenant_name,
    t.slug         AS tenant_slug,
    t.settings,
    t.is_active    AS tenant_active,
    tu.user_id,
    tu.role        AS user_role,
    tu.is_active   AS user_active,
    tu.created_at  AS user_added_at
FROM tenants t
JOIN tenant_users tu ON t.id = tu.tenant_id
WHERE t.is_active = true;

GRANT SELECT ON tenant_user_details TO authenticated;

-- Function: add_user_to_tenant
CREATE OR REPLACE FUNCTION add_user_to_tenant(
    tenant_id_param UUID,
    user_id_param   UUID,
    user_role       TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF current_user_role() NOT IN ('owner', 'manager') THEN
        RAISE EXCEPTION 'Only owners and managers can add users to a tenant';
    END IF;

    INSERT INTO tenant_users (tenant_id, user_id, role)
    VALUES (tenant_id_param, user_id_param, user_role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        role       = user_role,
        updated_at = NOW(),
        is_active  = true;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION add_user_to_tenant TO authenticated;

-- Function: remove_user_from_tenant
CREATE OR REPLACE FUNCTION remove_user_from_tenant(
    tenant_id_param UUID,
    user_id_param   UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF current_user_role() != 'owner' THEN
        RAISE EXCEPTION 'Only owners can remove users from a tenant';
    END IF;

    DELETE FROM tenant_users
    WHERE tenant_id = tenant_id_param
      AND user_id   = user_id_param;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_user_from_tenant TO authenticated;
