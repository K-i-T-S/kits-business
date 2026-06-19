-- Fix: set onboarding_completed = true for all existing tenants.
-- The onboarding wizard is only shown right after tenant creation (in-session).
-- For returning users, onboarding_completed = false is always a stale bug.
UPDATE public.tenants
SET onboarding_completed = true
WHERE onboarding_completed IS NOT TRUE;
