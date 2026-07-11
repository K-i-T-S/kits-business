import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  type Feature,
  type RoleAction,
  type RoleType,
  type SubscriptionPlan,
  type SubscriptionStatus,
  PLAN_FEATURES,
  PLAN_LIMITS,
  roleCanPerform,
} from '../types/subscription';
import { supabase } from '../utils/supabaseClient';

interface SubscriptionContextValue {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  role: RoleType;
  hasFeature: (feature: Feature) => boolean;
  isWithinLimit: (
    resource: 'products' | 'customers' | 'employees',
    currentCount: number,
  ) => boolean;
  canPerform: (action: RoleAction) => boolean;
  isLoading: boolean;
  /** Call after tenant selection or tenant switch to re-sync plan + role. */
  reloadSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

interface TenantRow {
  subscription_plan: string;
  subscription_status: string;
  user_role: string;
  custom_role_permissions?: Partial<Record<RoleAction, boolean>> | null;
}

function coercePlan(raw: string | undefined | null): SubscriptionPlan {
  if (raw === 'growth' || raw === 'business') return raw;
  return 'starter';
}

function coerceStatus(raw: string | undefined | null): SubscriptionStatus {
  if (raw === 'trialing' || raw === 'past_due' || raw === 'canceled') return raw;
  return 'active';
}

const VALID_ROLES: readonly RoleType[] = [
  'owner', 'admin', 'manager', 'supervisor', 'cashier', 'accountant', 'stockkeeper', 'viewer',
];

// Track 1b-i (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
// returns the real, distinct role instead of collapsing to a 4-value
// legacy set. 'admin' is no longer aliased to 'owner' here — ROLE_PERMISSIONS
// already grants admin the identical permission set to owner, so canPerform()
// behavior is unchanged, but the UI can now legitimately distinguish a
// KiTS platform-admin from an actual business owner for display purposes
// (ROLE_LABELS already has separate 'Admin'/'Owner' labels). Still fails
// closed to 'viewer' for anything not a real, valid role — the Tier 0.1
// security property (never silently grant owner-level access to an
// unrecognized value) is preserved, it just no longer needs to also
// swallow supervisor/accountant/stockkeeper, which are real roles now.
function coerceRole(raw: string | undefined | null): RoleType {
  if (raw && (VALID_ROLES as readonly string[]).includes(raw)) {
    return raw as RoleType;
  }
  return 'viewer';
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<SubscriptionPlan>('starter');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [role, setRole] = useState<RoleType>('viewer');
  // Track 1b-iv (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
  // per-action overrides from the user's custom role, if any. null when the
  // user has no custom role (the common case) — canPerform() falls back to
  // the base role's ROLE_PERMISSIONS whenever this is null or lacks an
  // explicit entry for the action being checked.
  const [customRolePermissions, setCustomRolePermissions] =
    useState<Partial<Record<RoleAction, boolean>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPlan('starter');
        setStatus('active');
        setRole('viewer');
        setCustomRolePermissions(null);
        setIsLoading(false);
        return;
      }

      const rpcResult = await supabase.rpc('get_current_user_tenant');

      // If the RPC errors (e.g. no tenant yet), keep starter/viewer — do not crash.
      if (rpcResult.error || !rpcResult.data) {
        setIsLoading(false);
        return;
      }

      // RPC returns an array of rows (one per tenant the user belongs to).
      // We always use the first row — matching the pattern in tenantManager.ts.
      const rawData = rpcResult.data as TenantRow[] | TenantRow;
      const row: TenantRow | undefined = Array.isArray(rawData) ? rawData[0] : rawData;
      if (!row) {
        setIsLoading(false);
        return;
      }

      setPlan(coercePlan(row.subscription_plan));
      setStatus(coerceStatus(row.subscription_status));
      setRole(coerceRole(row.user_role));
      setCustomRolePermissions(row.custom_role_permissions ?? null);
    } catch {
      // fail-safe: stay on starter/viewer so the app never breaks
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Re-fetch on every auth state change (login, token refresh, etc.)
        void load();
      } else {
        setPlan('starter');
        setStatus('active');
        setRole('viewer');
        setCustomRolePermissions(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [load]);

  const hasFeature = useCallback(
    (feature: Feature): boolean => PLAN_FEATURES[plan].includes(feature),
    [plan],
  );

  const isWithinLimit = useCallback(
    (resource: 'products' | 'customers' | 'employees', currentCount: number): boolean => {
      const limits = PLAN_LIMITS[plan];
      const limit =
        resource === 'products'
          ? limits.maxProducts
          : resource === 'customers'
            ? limits.maxCustomers
            : limits.maxEmployees;
      return limit === null || currentCount < limit;
    },
    [plan],
  );

  const canPerform = useCallback(
    (action: RoleAction): boolean => {
      // An explicit custom-role override (true or false) always wins —
      // that's the whole point of a custom role. No entry for this
      // specific action falls back to the base role's fixed permissions.
      if (customRolePermissions && action in customRolePermissions) {
        return customRolePermissions[action] === true;
      }
      return roleCanPerform(role, action);
    },
    [role, customRolePermissions],
  );

  return (
    <SubscriptionContext.Provider
      value={{
        plan,
        status,
        role,
        hasFeature,
        isWithinLimit,
        canPerform,
        isLoading,
        reloadSubscription: load,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used inside SubscriptionProvider');
  }
  return ctx;
}
