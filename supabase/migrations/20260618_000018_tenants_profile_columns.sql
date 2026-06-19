-- ============================================================
-- Add business profile columns to tenants.
-- Required by OnboardingWizard step 1 (Tell us about your business).
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS country  TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS phone    TEXT;
