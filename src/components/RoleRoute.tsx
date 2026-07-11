import { Navigate } from 'react-router-dom';

import { useSubscription } from '@/context/SubscriptionContext';
import type { RoleType } from '@/types/subscription';

interface RoleRouteProps {
  allowedRoles: RoleType[];
  children: React.ReactNode;
  /** Where to redirect when the current role isn't allowed. Defaults to /dashboard. */
  redirectTo?: string;
}

/**
 * Route-level role gate. Wrap a route's element to prevent direct URL
 * access to screens the current user's role shouldn't reach — the
 * counterpart to FeatureRoute.tsx (plan-gating) for role-gating.
 *
 * Cloned from FeatureRoute.tsx's pattern (Track 1a,
 * docs/superpowers/specs/2026-07-11-platform-roadmap-design.md) — same
 * loading-guard rationale: while subscription data is still loading we
 * render nothing so we don't redirect prematurely on initial page load.
 *
 * `role` here comes from SubscriptionContext's `coerceRole()`, which as of
 * Tier 0.1 fails closed to 'viewer' for any role it doesn't explicitly
 * recognize — so an unrecognized/new role is correctly excluded by any
 * `allowedRoles` list that doesn't include 'viewer', rather than silently
 * granted access.
 */
export default function RoleRoute({
  allowedRoles,
  children,
  redirectTo = '/dashboard',
}: RoleRouteProps) {
  const { role, isLoading } = useSubscription();

  // While loading, render nothing so we don't redirect prematurely.
  if (isLoading) return null;

  if (!allowedRoles.includes(role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
