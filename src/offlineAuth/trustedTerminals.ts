import { supabase } from '@/utils/supabaseClient';

import { getDeviceId } from './deviceId';

/**
 * Track: offline-first architecture, offline PIN authentication
 * (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
 *
 * Registration grants a DEVICE the capability to build up a local
 * credential cache at all -- it does not provision any specific
 * employee's credential (owners never see PINs). See
 * src/offlineAuth/credentialCache.ts for the trust-on-first-use caching
 * that happens after registration.
 */

export interface TrustedTerminal {
  id: string;
  device_id: string;
  device_label: string;
  registered_at: string;
  revoked_at: string | null;
}

/**
 * Checks this device's registration status against the server. Requires
 * network -- there is no offline path here by design: registration status
 * is a security gate, and a device that can't reach the server to prove
 * it's still trusted should not be treated as trusted just because it
 * claims to be. Callers should cache the last-known-good result
 * themselves (see PinLockScreen's use of this) and treat a failure to
 * check as "unknown," not "trusted."
 */
export async function isThisDeviceRegistered(tenantId: string): Promise<boolean> {
  const deviceId = getDeviceId();
  const { data, error } = await supabase
    .from('trusted_terminals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('device_id', deviceId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function registerThisDevice(tenantId: string, deviceLabel: string): Promise<void> {
  const deviceId = getDeviceId();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('trusted_terminals').upsert(
    {
      tenant_id: tenantId,
      device_id: deviceId,
      device_label: deviceLabel,
      registered_by: user?.id ?? null,
      revoked_at: null,
      revoked_by: null,
    },
    { onConflict: 'tenant_id,device_id' },
  );
  if (error) throw error;
}

export async function listTrustedTerminals(tenantId: string): Promise<TrustedTerminal[]> {
  const { data, error } = await supabase
    .from('trusted_terminals')
    .select('id, device_id, device_label, registered_at, revoked_at')
    .eq('tenant_id', tenantId)
    .order('registered_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TrustedTerminal[];
}

export async function revokeTrustedTerminal(terminalId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('trusted_terminals')
    .update({ revoked_at: new Date().toISOString(), revoked_by: user?.id ?? null })
    .eq('id', terminalId);
  if (error) throw error;
}
