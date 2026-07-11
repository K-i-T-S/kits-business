import { Delete, Lock, LogOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useApp } from '@/context/AppContext';
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
  const { employees, currentTenant } = useApp();
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState<PinEmployee | null>(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  const handleDigit = (digit: string) => {
    if (submitting) return;
    setError('');
    setPin((prev) => (prev.length >= 6 ? prev : prev + digit));
  };

  const handleBackspace = () => {
    if (submitting) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleCancel = () => {
    setSelected(null);
    setPin('');
    setError('');
  };

  const submitPin = useCallback(async (employee: PinEmployee, enteredPin: string) => {
    setSubmitting(true);
    setError('');
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: employee.email,
        password: enteredPin,
      });
      if (signInErr) {
        setError('Incorrect PIN');
        setPin('');
        return;
      }
      toast.success(`Welcome, ${employee.name}`);
      setLocked(false);
      setSelected(null);
      setPin('');
      resetInactivityTimer();
    } finally {
      setSubmitting(false);
    }
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (selected && pin.length >= 4) {
      void submitPin(selected, pin);
    }
    // Only re-run when the pin/selected employee actually changes — submitPin
    // itself is stable via useCallback, including it would just be noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, selected]);

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
        </div>
      )}

      <button
        type="button"
        onClick={() => { void supabase.auth.signOut(); }}
        className="mt-10 flex items-center gap-2 text-xs text-white/30 hover:text-white/60"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out completely
      </button>
    </div>
  );
}
