-- Track: offline-first architecture, offline PIN authentication
-- (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
--
-- Founder-approved fix (Option A of 4 presented, 2026-07-12) for the PIN
-- brute-force exposure found in the earlier adversarial security review:
-- PinLockScreen.tsx's submitPin() called supabase.auth.signInWithPassword()
-- on every attempt with zero per-account throttling, and the tappable
-- roster shows every PIN-enabled employee regardless of the signed-in
-- user's own privilege level -- letting a low-privilege staff member
-- specifically target a higher-privilege account's PIN. A 4-digit PIN is
-- only 10,000 combinations and the online auth call has near-zero
-- per-attempt cost, so nothing throttled repeated guessing.
--
-- Parameters confirmed with the founder: 5 failed attempts before lockout,
-- 5-minute lockout duration, self-service unlock (expires automatically,
-- no manager-override UI in this v1).
--
-- Deliberately does NOT touch the offline PIN-verification path
-- (PinLockScreen.tsx's tryOfflineLogin()/crypto.ts's verifyPin()) -- that
-- path already has no network to reach these RPCs from, and Argon2id's own
-- cost (19 MiB memory, 2 iterations -- see crypto.ts) imposes a real
-- per-attempt delay client-side that the online signInWithPassword() call
-- doesn't have. The online path is where an attacker can fire attempts at
-- near-zero cost, so that's what this throttles.

ALTER TABLE employees
  ADD COLUMN failed_pin_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN pin_locked_until timestamptz;

-- Called before attempting signInWithPassword() -- skips the auth call
-- entirely (and the generic Supabase Auth rate limit it would otherwise
-- also count against) if this employee is already locked out. Any
-- authenticated tenant member may call this for any employee in their own
-- tenant's roster -- that's inherent to the shared-terminal PIN UX
-- (whoever's at the terminal already has some active session, and is
-- checking lockout status for the employee they just tapped, not
-- themselves). SECURITY DEFINER so it can read employees rows regardless
-- of what row-level SELECT policy exists; tenant match against
-- current_tenant_id() is the actual authorization check, done here rather
-- than relying on RLS.
CREATE OR REPLACE FUNCTION check_pin_lockout(p_employee_id uuid)
RETURNS TABLE(is_locked boolean, locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_locked_until timestamptz;
BEGIN
  SELECT e.tenant_id, e.pin_locked_until INTO v_tenant_id, v_locked_until
  FROM employees e
  WHERE e.id = p_employee_id;

  IF v_tenant_id IS DISTINCT FROM current_tenant_id() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY SELECT (v_locked_until IS NOT NULL AND v_locked_until > now()), v_locked_until;
END;
$$;

-- Called after every online signInWithPassword() result. On success,
-- resets the counter (a fresh run of bad guesses starts from zero next
-- time). On failure, increments the counter and -- once it reaches the
-- threshold -- sets a fresh 5-minute lockout from now(), even if a prior
-- lockout window had already expired (a locked-out employee who keeps
-- failing after their lockout expires re-locks immediately rather than
-- getting unlimited post-expiry guesses).
CREATE OR REPLACE FUNCTION record_pin_attempt(p_employee_id uuid, p_success boolean)
RETURNS TABLE(is_locked boolean, locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id uuid;
  v_locked_until timestamptz;
BEGIN
  SELECT e.tenant_id INTO v_tenant_id FROM employees e WHERE e.id = p_employee_id;

  IF v_tenant_id IS DISTINCT FROM current_tenant_id() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_success THEN
    UPDATE employees
    SET failed_pin_attempts = 0, pin_locked_until = NULL
    WHERE id = p_employee_id;
    RETURN QUERY SELECT false, NULL::timestamptz;
  ELSE
    UPDATE employees
    SET failed_pin_attempts = failed_pin_attempts + 1,
        pin_locked_until = CASE
          WHEN failed_pin_attempts + 1 >= 5 THEN now() + interval '5 minutes'
          ELSE pin_locked_until
        END
    WHERE id = p_employee_id
    RETURNING employees.pin_locked_until INTO v_locked_until;

    RETURN QUERY SELECT (v_locked_until IS NOT NULL AND v_locked_until > now()), v_locked_until;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_pin_lockout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION record_pin_attempt(uuid, boolean) TO authenticated;
