-- ============================================================
-- 20260623_000043_cash_management.sql
-- Cash drawer / till management for restaurant shifts
--
-- Adds:
--   1. payment_currency column on table_orders (tracks USD vs LBP cash)
--   2. restaurant_cash_sessions table with denomination_breakdown JSONB
-- ============================================================

-- 1. Add payment_currency to table_orders so we can distinguish cash_usd from cash_lbp
--    fn_close_restaurant_bill maps both to payment_method = 'cash', so we store the
--    original currency separately.
ALTER TABLE table_orders
  ADD COLUMN IF NOT EXISTS payment_currency TEXT
    CHECK (payment_currency IN ('usd', 'lbp'));

-- 2. Cash drawer sessions for restaurant shifts
CREATE TABLE IF NOT EXISTS restaurant_cash_sessions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opened_by              UUID REFERENCES auth.users(id),
  closed_by              UUID REFERENCES auth.users(id),
  opened_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at              TIMESTAMPTZ,
  opening_float_usd      NUMERIC(10,2) NOT NULL DEFAULT 0,
  opening_float_lbp      BIGINT        NOT NULL DEFAULT 0,
  expected_cash_usd      NUMERIC(10,2),   -- sum of cash_usd orders during session
  expected_cash_lbp      BIGINT,          -- sum of cash_lbp orders during session
  actual_cash_usd        NUMERIC(10,2),   -- counted at till close
  actual_cash_lbp        BIGINT,          -- counted at till close
  over_short_usd         NUMERIC(10,2) GENERATED ALWAYS AS (actual_cash_usd - expected_cash_usd) STORED,
  over_short_lbp         BIGINT        GENERATED ALWAYS AS (actual_cash_lbp - expected_cash_lbp) STORED,
  notes                  TEXT,
  denomination_breakdown JSONB,
  -- { usd: { "100": 2, "50": 1, "20": 0, "10": 0, "5": 0, "1": 0, "0.25": 0, "0.10": 0 },
  --   lbp: { "100000": 5, "50000": 0, "25000": 0, "10000": 0, "5000": 0, "1000": 0, "500": 0, "250": 0 } }
  status                 TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed'))
);

ALTER TABLE restaurant_cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant cash sessions" ON restaurant_cash_sessions
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_cash_sessions_tenant
  ON restaurant_cash_sessions(tenant_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_table_orders_payment_currency
  ON table_orders(tenant_id, payment_currency, paid_at)
  WHERE payment_currency IS NOT NULL;
