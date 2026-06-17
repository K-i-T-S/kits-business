-- Add subscription tracking to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'starter'
    CHECK (subscription_plan IN ('starter', 'growth', 'business'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
