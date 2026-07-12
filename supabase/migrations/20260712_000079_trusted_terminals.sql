-- Track: offline-first architecture, offline PIN authentication
-- (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
--
-- Server-side registry of devices an owner/manager/admin has explicitly
-- trusted to hold a local, Argon2id-hashed PIN credential cache and verify
-- logins without a live network connection (src/offlineAuth/*.ts). An
-- unregistered device never builds up a cache at all, regardless of who
-- logs in on it -- registration grants the DEVICE the capability, not any
-- specific employee's credentials (owners never see employee PINs, so
-- nothing here provisions a credential directly; that happens
-- automatically the first time an employee logs in online on an already-
-- registered device, see PinLockScreen.tsx).
--
-- Soft-revoke (revoked_at) rather than DELETE, so an owner has an audit
-- trail of every device that was ever trusted, including ones later
-- revoked (e.g. a lost or stolen terminal).
CREATE TABLE trusted_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_label text NOT NULL,
  registered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, device_id)
);

CREATE INDEX idx_trusted_terminals_tenant_id ON trusted_terminals(tenant_id);

ALTER TABLE trusted_terminals ENABLE ROW LEVEL SECURITY;

-- Any authenticated tenant member can check registration status -- needed
-- by every employee's PIN login flow to decide whether to cache their own
-- credential after a successful online login, not just owner/manager.
CREATE POLICY "tenant members can view trusted terminals"
  ON trusted_terminals FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY "owner/manager/admin can register terminals"
  ON trusted_terminals FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "owner/manager/admin can revoke terminals"
  ON trusted_terminals FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND current_user_role() IN ('owner', 'admin', 'manager')
  );

GRANT SELECT, INSERT, UPDATE ON trusted_terminals TO authenticated;
