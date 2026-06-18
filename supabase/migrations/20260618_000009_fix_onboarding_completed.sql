-- Fix: the 000004_onboarding migration added onboarding_completed with DEFAULT false,
-- which retroactively marked all existing tenants as needing onboarding.
-- Mark every tenant that existed before this migration as already complete.
-- New tenants created after this migration will correctly start as false.

UPDATE tenants
SET onboarding_completed = true
WHERE onboarding_completed = false;

-- Going forward, the correct default is false (new tenants see onboarding).
-- No column change needed — the default stays false.
-- The OnboardingWizard marks onboarding_completed = true when the wizard finishes.
