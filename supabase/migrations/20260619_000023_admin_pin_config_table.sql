-- Migration 000023: Fix admin PIN storage.
--
-- ALTER DATABASE SET requires superuser — not available in the Supabase SQL Editor.
-- Instead, store the PIN hash in a dedicated table with RLS enabled but no policies,
-- making it inaccessible via PostgREST while still readable by SECURITY DEFINER functions.
--
-- After running this migration, set your admin PIN by running in Supabase SQL Editor.
-- IMPORTANT: pgcrypto lives in the 'extensions' schema in Supabase — use the qualified name:
--
--   UPDATE public.kits_admin_config
--   SET value = extensions.crypt('YourChosenPassword', extensions.gen_salt('bf')),
--       updated_at = NOW()
--   WHERE key = 'admin_pin_hash';
--
-- Plain SQL Editor queries don't include the extensions schema in search_path.
-- The verify_admin_pin function works because it has SET search_path = extensions, public.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.kits_admin_config (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kits_admin_config ENABLE ROW LEVEL SECURITY;
-- No RLS policies = table is fully blocked via PostgREST.
-- SECURITY DEFINER functions bypass RLS and can read directly.

INSERT INTO public.kits_admin_config (key, value)
VALUES ('admin_pin_hash', 'not-configured')
ON CONFLICT (key) DO NOTHING;

-- Drop and recreate verify_admin_pin to read from the config table.
DROP FUNCTION IF EXISTS verify_admin_pin(TEXT);

CREATE OR REPLACE FUNCTION verify_admin_pin(attempt TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  stored TEXT;
BEGIN
  -- Primary guard: only the registered admin email may call this
  IF auth.email() != 'kits.tech.co@gmail.com' THEN
    RETURN FALSE;
  END IF;

  SELECT value INTO stored
  FROM public.kits_admin_config
  WHERE key = 'admin_pin_hash';

  IF stored IS NULL OR stored = 'not-configured' THEN
    RAISE EXCEPTION 'Admin PIN not configured — run the setup UPDATE in Supabase SQL Editor.';
  END IF;

  -- crypt() is in extensions schema (included via SET search_path above)
  RETURN crypt(attempt, stored) = stored;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_admin_pin(TEXT) TO authenticated;
