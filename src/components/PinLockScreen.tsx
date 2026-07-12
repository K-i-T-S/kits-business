import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { Check, Delete, Lock, LogOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { useApp } from '@/context/AppContext';
import type { Employee, Tenant } from '@/context/AppContext';
import { hashPin, verifyPin } from '@/offlineAuth/crypto';
import {
  cacheCredential,
  getCachedBootstrapData,
  getCachedCredential,
} from '@/offlineAuth/credentialCache';
import { isThisDeviceRegistered } from '@/offlineAuth/trustedTerminals';
import { toLocalDateString } from '@/utils/formatting';
import { resolveRoleHomeRoute } from '@/utils/postLoginRoute';
import { supabase } from '@/utils/supabaseClient';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const PIN_SUFFIX = '@pin.kits.internal';
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

interface PinEmployee {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Track 1c (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * shared-terminal lock screen for PIN-based staff login. Locks after
 * inactivity or a manual "Switch User" trigger; unlocking taps an
 * employee tile then enters their PIN, which is their real Supabase Auth
 * password (Option B — genuine session swap via signInWithPassword(),
 * not client-side-only attribution). Only employees created via the
 * create-pin-employee edge function appear in the roster — identified by
 * the synthetic @pin.kits.internal email suffix that function assigns;
 * legacy employees without PIN accounts (no such email) can't be tapped.
 *
 * Mounted once near the top of App.tsx's provider tree so it has access
 * to AppContext/SubscriptionContext and renders as a fixed overlay on
 * top of whatever page is active — not per-page, so it can't be
 * bypassed by navigating to a different route.
 */
export function PinLockScreen({ isAuthenticated }: { isAuthenticated: boolean }) {
  const navigate = useNavigate();
  const { employees, currentTenant, authMode, establishProvisionalSession } = useApp();
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState<PinEmployee | null>(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Held in memory only, never persisted -- lets the background
  // reconnect-retry below promote a provisional session to a real one
  // without asking the employee to re-enter their PIN the moment
  // connectivity returns. Cleared the instant it's no longer needed
  // (real session lands, or the employee explicitly signs out/switches).
  const pendingProvisionalRef = useRef<{ employee: PinEmployee; pin: string } | null>(null);
  const [error, setError] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pinEmployees: PinEmployee[] = employees
    .filter((e) => e.email?.endsWith(PIN_SUFFIX))
    .map((e) => ({ id: e.id, name: e.name, email: e.email, role: e.role }));

  const resetInactivityTimer = useCallback(() => {
    if (!isAuthenticated) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setLocked(true), INACTIVITY_TIMEOUT_MS);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    resetInactivityTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetInactivityTimer));
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetInactivityTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isAuthenticated, resetInactivityTimer]);

  // Listen for the manual "Switch User" trigger, dispatched as a custom
  // event so any component (e.g. a Layout header button) can lock the
  // terminal without needing a shared context just for this one action.
  useEffect(() => {
    const handler = () => setLocked(true);
    window.addEventListener('kits:lock-terminal', handler);
    return () => window.removeEventListener('kits:lock-terminal', handler);
  }, []);

  // Promotes a provisional (offline-verified) session to a real one the
  // moment connectivity returns, replaying the same PIN that was already
  // verified locally -- without asking the employee to re-enter it. The
  // browser's 'online' event is only a trigger to attempt this, not proof
  // it will succeed; signInWithPassword() either succeeds (the existing
  // onAuthStateChange handler in AppContext then takes over normally and
  // resets authMode to 'online') or fails, in which case the employee is
  // forced back to a fresh PIN entry -- fail closed, never silently stay
  // in provisional mode indefinitely once the network is actually back.
  useEffect(() => {
    if (authMode !== 'provisional') return;
    const attemptPromotion = () => {
      const pending = pendingProvisionalRef.current;
      if (!pending) return;
      void supabase.auth.signInWithPassword({
        email: pending.employee.email,
        password: pending.pin,
      }).then(({ error }) => {
        if (!error) {
          pendingProvisionalRef.current = null;
        }
        // On error, leave pendingProvisionalRef set -- the next 'online'
        // event (or the employee explicitly re-entering their PIN) tries
        // again. A still-offline retry fails the same way it did before,
        // which is expected, not an error state to surface.
      });
    };
    window.addEventListener('online', attemptPromotion);
    // Also try once immediately in case connectivity returned between the
    // offline verification and this effect mounting.
    attemptPromotion();
    return () => window.removeEventListener('online', attemptPromotion);
  }, [authMode]);

  const handleDigit = useCallback((digit: string) => {
    if (submitting) return;
    setError('');
    setPin((prev) => (prev.length >= 6 ? prev : prev + digit));
  }, [submitting]);

  const handleBackspace = useCallback(() => {
    if (submitting) return;
    setPin((prev) => prev.slice(0, -1));
  }, [submitting]);

  const handleCancel = () => {
    setSelected(null);
    setPin('');
    setError('');
  };

  // Clocks the employee into today's scheduled shift, if one exists and
  // they haven't already clocked in — silently no-ops otherwise (no shift
  // scheduled today, already clocked in, or a non-restaurant tenant with
  // no restaurant_shifts data at all). PIN login always succeeds
  // regardless of whether a shift match is found; clock-in is a bonus
  // side effect of unlocking, never a blocker. Mirrors the exact update
  // ShiftManager.tsx's own "clock in" button already performs.
  const clockInIfScheduled = useCallback(async (employeeId: string, tenantId: string) => {
    try {
      const today = toLocalDateString(new Date());
      const { data: todaysShifts } = await supabase
        .from('restaurant_shifts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('shift_date', today);
      const shiftIds = (todaysShifts ?? []).map((s: { id: string }) => s.id);
      if (shiftIds.length === 0) return;

      const { data: assignments } = await supabase
        .from('restaurant_shift_assignments')
        .select('id')
        .eq('employee_id', employeeId)
        .in('shift_id', shiftIds)
        .is('clocked_in_at', null)
        .limit(1);
      const assignment = assignments?.[0] as { id: string } | undefined;
      if (!assignment) return;

      await supabase
        .from('restaurant_shift_assignments')
        .update({ clocked_in_at: new Date().toISOString() })
        .eq('id', assignment.id);
    } catch {
      // Clock-in is best-effort — never block or error out a PIN login over it.
    }
  }, []);

  // Best-effort audit log write — activity_log (migration 000006) already
  // exists platform-wide and is exactly the right shape for this (tenant_id,
  // user_id, action, entity_type, entity_id, metadata). Reused rather than
  // building a parallel table. 'employee_' prefix matches ActivityLog.tsx's
  // existing getCategoryFromAction() convention so these entries surface
  // under the "employee" category automatically, no display-code changes
  // needed. Never blocks or errors out the login/logout flow it's attached to.
  const logActivity = useCallback(async (
    tenantId: string,
    userId: string,
    action: 'employee_pin_login' | 'employee_pin_logout',
    employeeId: string,
    employeeName: string,
  ) => {
    try {
      await supabase.from('activity_log').insert({
        tenant_id: tenantId,
        user_id: userId,
        action,
        entity_type: 'employee',
        entity_id: employeeId,
        metadata: { name: employeeName },
      });
    } catch {
      // Audit logging is best-effort — never block PIN login/logout over it.
    }
  }, []);

  // Called right after a successful ONLINE login. Trust-on-first-use: an
  // owner/manager never sees an employee's PIN, so a local credential
  // cache can only ever be built this way, automatically, the moment an
  // employee proves their PIN is correct on a device the owner has
  // separately registered as trusted. Best-effort -- never blocks or
  // errors out a successful login over a caching failure.
  const maybeCacheCredentialForOfflineUse = useCallback(async (employee: PinEmployee, enteredPin: string, tenantId: string) => {
    try {
      const registered = await isThisDeviceRegistered(tenantId);
      if (!registered) return;
      const encodedHash = await hashPin(enteredPin);
      await cacheCredential({ employeeId: employee.id, tenantId, encodedHash });
    } catch {
      // Never block a successful online login over a caching failure --
      // worst case, offline login simply isn't available for this
      // employee/device until the next successful online login.
    }
  }, []);

  // Verifies a PIN locally against the cached Argon2id hash (no network
  // involved) and, on success, establishes a provisional identity from the
  // last cached tenant/employee snapshot -- see AppContext's
  // establishProvisionalSession(). Returns false (not an error) whenever
  // offline login genuinely isn't available for this employee/device, so
  // the caller can show one honest, fail-closed message rather than a
  // misleading "incorrect PIN."
  const tryOfflineLogin = useCallback(async (employee: PinEmployee, enteredPin: string): Promise<'ok' | 'wrong-pin' | 'unavailable'> => {
    const bootstrap = await getCachedBootstrapData();
    if (!bootstrap) return 'unavailable';
    const cached = await getCachedCredential(employee.id);
    if (!cached || cached.tenantId !== (bootstrap.tenant as { id?: string }).id) return 'unavailable';

    const valid = await verifyPin(enteredPin, cached.encodedHash);
    if (!valid) return 'wrong-pin';

    const tenant = bootstrap.tenant as unknown as Tenant;
    const employeeRoster = bootstrap.employees as unknown as Employee[];
    const signedInEmployee = employeeRoster.find((e) => e.id === employee.id);
    if (!signedInEmployee) return 'unavailable';

    establishProvisionalSession(tenant, employeeRoster, signedInEmployee);
    pendingProvisionalRef.current = { employee, pin: enteredPin };
    return 'ok';
  }, [establishProvisionalSession]);

  const submitPin = useCallback(async (employee: PinEmployee, enteredPin: string) => {
    setSubmitting(true);
    setError('');
    try {
      // Log the outgoing PIN employee's logout (if any) before the session
      // swap replaces their auth context — after signInWithPassword succeeds
      // there's no way to write an activity_log row "as" them anymore.
      // Wrapped defensively: getUser() is itself a network call, and if it
      // throws while offline it must not abort the whole function before
      // the offline fallback below ever gets a chance to run.
      if (currentTenant) {
        try {
          const { data: { user: outgoing } } = await supabase.auth.getUser();
          if (outgoing?.email?.endsWith(PIN_SUFFIX)) {
            const outgoingEmployee = employees.find((e) => e.email === outgoing.email);
            if (outgoingEmployee) {
              await logActivity(currentTenant.id, outgoing.id, 'employee_pin_logout', outgoingEmployee.id, outgoingEmployee.name);
            }
          }
        } catch {
          // Best-effort, and specifically must not block offline login.
        }
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: employee.email,
        password: enteredPin,
      });

      if (signInErr) {
        if (isAuthRetryableFetchError(signInErr)) {
          const result = await tryOfflineLogin(employee, enteredPin);
          if (result === 'ok') {
            // No network for resolveRoleHomeRoute() (or clock-in/audit-log,
            // both outside PowerSync's offline scope) -- /pos is the one
            // core-POS screen every PIN-enabled role can reach regardless
            // of job function, so it's the safe universal offline landing
            // page. Less tailored than the online per-role resolver, but
            // never wrong or unreachable.
            void navigate('/pos');
            toast.success(`Welcome, ${employee.name} (offline)`);
            setLocked(false);
            setSelected(null);
            setPin('');
            resetInactivityTimer();
            return;
          }
          setError(
            result === 'wrong-pin'
              ? 'Incorrect PIN'
              : 'No connection, and this device or employee isn\'t set up for offline login',
          );
          setPin('');
          return;
        }
        setError('Incorrect PIN');
        setPin('');
        return;
      }

      // Real session succeeded -- cache the credential for future offline
      // use if this device is registered. Best-effort, never awaited
      // against the rest of the login flow.
      void maybeCacheCredentialForOfflineUse(employee, enteredPin, currentTenant?.id ?? '');

      // Track 2: resolve and navigate to the role-native screen (Waiter/
      // Kitchen/Argile/POS/Operations/etc.) BEFORE dropping the lock
      // overlay. The overlay is a fixed z-[100] full-screen cover, so
      // navigating while it's still up means the new page is already
      // mounted underneath by the time it's revealed — no flash of
      // whatever page happened to be showing when the terminal locked.
      const homeRoute = await resolveRoleHomeRoute();
      if (homeRoute) void navigate(homeRoute);

      toast.success(`Welcome, ${employee.name}`);
      setLocked(false);
      setSelected(null);
      setPin('');
      resetInactivityTimer();
      pendingProvisionalRef.current = null;
      if (currentTenant) {
        void clockInIfScheduled(employee.id, currentTenant.id);
        const { data: { user: incoming } } = await supabase.auth.getUser();
        if (incoming) void logActivity(currentTenant.id, incoming.id, 'employee_pin_login', employee.id, employee.name);
      }
    } finally {
      setSubmitting(false);
    }
  }, [resetInactivityTimer, clockInIfScheduled, currentTenant, employees, logActivity, navigate, tryOfflineLogin, maybeCacheCredentialForOfflineUse]);

  // Deliberately no auto-submit-at-N-digits: PINs are 4-6 digits
  // (CreatePinEmployeeModal.tsx) and length is never persisted anywhere, so
  // there's no reliable count to auto-submit at — auto-submitting at a fixed
  // 4 silently mis-submitted the first 4 digits of every 6-digit PIN
  // (BUG-001, docs/qa-bug-tracker.md). Submission is always an explicit
  // action: tap/press Enter, or the on-screen Enter button below.
  const handleSubmit = useCallback(() => {
    if (!selected || submitting) return;
    if (pin.length < 4) {
      setError('Enter at least 4 digits');
      return;
    }
    void submitPin(selected, pin);
  }, [selected, submitting, pin, submitPin]);

  // Physical keyboard support alongside the on-screen keypad — previously
  // PIN entry only worked via mouse/touch on the rendered buttons.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (submitting) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, submitting, pin, handleSubmit, handleDigit, handleBackspace]);

  if (!isAuthenticated || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/98 backdrop-blur-sm p-6">
      <div className="flex items-center gap-2 text-white/60 mb-8">
        <Lock className="h-4 w-4" />
        <span className="text-sm">{currentTenant?.name ?? 'KiTS'} — Terminal Locked</span>
      </div>

      {!selected ? (
        <div className="w-full max-w-2xl">
          <p className="mb-6 text-center text-white/80 text-lg">Who's working?</p>
          {pinEmployees.length === 0 ? (
            <p className="text-center text-white/40 text-sm">
              No PIN-enabled staff yet. An owner or manager can add one from Employees.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {pinEmployees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelected(emp)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 text-xl font-bold text-white">
                    {emp.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-white font-medium">{emp.name}</span>
                  <span className="text-xs text-white/40 capitalize">{emp.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 text-xl font-bold text-white">
              {selected.name.slice(0, 1).toUpperCase()}
            </div>
            <p className="text-white font-medium">{selected.name}</p>
          </div>

          <div className="flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full border border-white/30 ${i < pin.length ? 'bg-white' : 'bg-transparent'}`}
              />
            ))}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                disabled={submitting}
                onClick={() => handleDigit(d)}
                className="h-16 w-16 rounded-2xl border border-white/10 bg-white/5 text-xl font-semibold text-white hover:bg-white/10 disabled:opacity-40"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="h-16 w-16 rounded-2xl border border-white/10 bg-white/5 text-sm font-medium text-white/60 hover:bg-white/10 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleDigit('0')}
              className="h-16 w-16 rounded-2xl border border-white/10 bg-white/5 text-xl font-semibold text-white hover:bg-white/10 disabled:opacity-40"
            >
              0
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleBackspace}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-40"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || pin.length < 4}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Check className="h-4 w-4" />
            Enter
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          void (async () => {
            if (currentTenant) {
              const { data: { user: outgoing } } = await supabase.auth.getUser();
              if (outgoing?.email?.endsWith(PIN_SUFFIX)) {
                const outgoingEmployee = employees.find((e) => e.email === outgoing.email);
                if (outgoingEmployee) {
                  await logActivity(currentTenant.id, outgoing.id, 'employee_pin_logout', outgoingEmployee.id, outgoingEmployee.name);
                }
              }
            }
            await supabase.auth.signOut();
          })();
        }}
        className="mt-10 flex items-center gap-2 text-xs text-white/30 hover:text-white/60"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out completely
      </button>
    </div>
  );
}
