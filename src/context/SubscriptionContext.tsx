import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  type Feature,
  type RoleAction,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type UserRole,
  PLAN_FEATURES,
  PLAN_LIMITS,
  roleCanPerform,
} from '../types/subscription';
import { supabase } from '../utils/supabaseClient';

interface SubscriptionContextValue {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  role: UserRole;
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
}

function coercePlan(raw: string | undefined | null): SubscriptionPlan {
  if (raw === 'growth' || raw === 'business') return raw;
  return 'starter';
}

function coerceStatus(raw: string | undefined | null): SubscriptionStatus {
  if (raw === 'trialing' || raw === 'past_due' || raw === 'canceled') return raw;
  return 'active';
}

function coerceRole(raw: string | undefined | null): UserRole {
  if (raw === 'manager' || raw === 'cashier' || raw === 'viewer') return raw;
  return 'owner'; // default to owner for tenant creators
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<SubscriptionPlan>('starter');
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [role, setRole] = useState<UserRole>('viewer');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPlan('starter');
        setStatus('active');
        setRole('viewer');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('get_current_user_tenant');

      // If the RPC errors (e.g. no tenant yet), keep starter/viewer — do not crash.
      if (error || !data) {
        setIsLoading(false);
        return;
      }

      // RPC returns an array of rows (one per tenant the user belongs to).
      // We always use the first row — matching the pattern in tenantManager.ts.
      const row: TenantRow | undefined = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setIsLoading(false);
        return;
      }

      setPlan(coercePlan(row.subscription_plan));
      setStatus(coerceStatus(row.subscription_status));
      setRole(coerceRole(row.user_role));
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
    (action: RoleAction): boolean => roleCanPerform(role, action),
    [role],
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

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used inside SubscriptionProvider');
  }
  return ctx;
}
