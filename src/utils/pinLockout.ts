import { supabase } from '@/utils/supabaseClient';

/**
 * Server-tracked PIN attempt throttling (migration 000081) -- gates only
 * the ONLINE signInWithPassword() path in PinLockScreen.tsx. The offline
 * verification path is deliberately left alone: it has no network to
 * reach these RPCs from, and Argon2id's own cost already imposes a real
 * per-attempt delay there (see src/offlineAuth/crypto.ts). 5 failed
 * attempts locks the employee (tenant-wide, not per-terminal) for 5
 * minutes; a fresh success resets the counter.
 */

export interface PinLockoutStatus {
  isLocked: boolean;
  lockedUntil: string | null;
}

/**
 * Checked before attempting signInWithPassword(). Best-effort by design --
 * callers should treat a thrown error (e.g. genuinely offline) as "unknown,
 * not locked" and proceed to the normal login flow, since this check
 * itself requires network and must never be the thing that blocks a
 * legitimate offline login attempt.
 */
export async function checkPinLockout(employeeId: string): Promise<PinLockoutStatus> {
  const { data, error } = await supabase
    .rpc('check_pin_lockout', { p_employee_id: employeeId })
    .single();
  if (error) throw error;
  const result = data as { is_locked: boolean; locked_until: string | null };
  return { isLocked: result.is_locked, lockedUntil: result.locked_until };
}

/** Called after every online signInWithPassword() result resolves. Best-effort. */
export async function recordPinAttempt(employeeId: string, success: boolean): Promise<PinLockoutStatus> {
  const { data, error } = await supabase
    .rpc('record_pin_attempt', { p_employee_id: employeeId, p_success: success })
    .single();
  if (error) throw error;
  const result = data as { is_locked: boolean; locked_until: string | null };
  return { isLocked: result.is_locked, lockedUntil: result.locked_until };
}

/** "4m 32s" / "45s" style remaining-time label for a lockout message. */
export function formatLockoutRemaining(lockedUntil: string): string {
  const ms = new Date(lockedUntil).getTime() - Date.now();
  if (ms <= 0) return '0s';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
