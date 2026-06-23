-- Migration: restaurant_events
-- Private event bookings for Lebanese/MENA restaurants:
-- birthdays, engagements, corporate dinners, weddings, etc.

CREATE TABLE IF NOT EXISTS restaurant_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_name        TEXT        NOT NULL,
  event_type        TEXT        NOT NULL DEFAULT 'private'
                    CHECK (event_type IN ('private', 'birthday', 'engagement', 'corporate', 'wedding', 'other')),
  contact_name      TEXT        NOT NULL,
  contact_phone     TEXT,
  contact_email     TEXT,
  event_date        DATE        NOT NULL,
  start_time        TIME        NOT NULL,
  end_time          TIME,
  guest_count       INTEGER     NOT NULL DEFAULT 1,
  room_section      TEXT,        -- 'indoor', 'terrace', 'private_room', 'full_venue'
  menu_package      TEXT,        -- 'standard', 'premium', 'custom'
  min_spend_usd     NUMERIC(10,2),
  deposit_usd       NUMERIC(10,2) DEFAULT 0,
  deposit_paid      BOOLEAN     DEFAULT false,
  deposit_paid_at   TIMESTAMPTZ,
  notes             TEXT,
  status            TEXT        NOT NULL DEFAULT 'inquiry'
                    CHECK (status IN ('inquiry', 'confirmed', 'deposit_paid', 'completed', 'cancelled')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_events" ON restaurant_events
  FOR ALL USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_restaurant_events_date
  ON restaurant_events(tenant_id, event_date DESC);
