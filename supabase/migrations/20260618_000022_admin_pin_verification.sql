-- Migration 000022: Server-side admin PIN verification via pgcrypto.
--
-- Security model:
--   1. pgcrypto enables bcrypt hashing — comparison is always server-side
--   2. The actual PIN hash is stored as a runtime DB setting (app.admin_pin_hash)
--      and MUST be set manually in Supabase SQL Editor — it is never committed to source
--   3. Only the registered admin email can call verify_admin_pin()
--
-- After running this migration, set the hash in Supabase SQL Editor:
--   ALTER DATABASE postgres
--     SET app.admin_pin_hash = crypt('YourChosenPassword', gen_salt('bf'));
--
-- To change the password later, run the same command with the new password.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION verify_admin_pin(attempt TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored TEXT;
BEGIN
  -- Primary guard: only the registered admin email may call this
  IF auth.email() != 'kits.tech.co@gmail.com' THEN
    RETURN FALSE;
  END IF;

  -- Read hash from runtime DB setting (never stored in source)
  stored := current_setting('app.admin_pin_hash', TRUE);

  -- If the hash hasn't been set yet, deny access (misconfiguration safe default)
  IF stored IS NULL OR stored = '' THEN
    RAISE EXCEPTION 'Admin PIN not configured — run the setup SQL in Supabase dashboard';
  END IF;

  RETURN crypt(attempt, stored) = stored;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_admin_pin(TEXT) TO authenticated;
