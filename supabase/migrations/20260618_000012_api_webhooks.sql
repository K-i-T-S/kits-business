-- Migration: API Keys + Webhooks tables
-- Run after 20260618_000008_multi_location.sql

-- ─── API Keys ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,    -- SHA-256 of the actual key (never stored plaintext)
  key_prefix    TEXT NOT NULL,           -- First 12 chars of the actual key (for display)
  permissions   TEXT[] NOT NULL DEFAULT ARRAY['read'],
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_access" ON api_keys
  USING (tenant_id = current_tenant_id());

-- ─── Webhooks ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  secret        TEXT NOT NULL,           -- HMAC signing secret
  events        TEXT[] NOT NULL,         -- e.g. ['sale.created', 'product.updated']
  is_active     BOOLEAN NOT NULL DEFAULT true,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_fired_at TIMESTAMPTZ,
  last_status   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_access" ON webhooks
  USING (tenant_id = current_tenant_id());

-- ─── Webhook Delivery Log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id   UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  payload      JSONB NOT NULL,
  status_code  INTEGER,
  success      BOOLEAN,
  duration_ms  INTEGER,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_access" ON webhook_deliveries
  USING (webhook_id IN (SELECT id FROM webhooks WHERE tenant_id = current_tenant_id()));
