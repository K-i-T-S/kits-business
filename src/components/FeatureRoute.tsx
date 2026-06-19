import { Navigate } from 'react-router-dom';

import { useSubscription } from '@/context/SubscriptionContext';
import type { Feature } from '@/types/subscription';

interface FeatureRouteProps {
  feature: Feature;
  children: React.ReactNode;
  /** Where to redirect when the feature is unavailable. Defaults to /dashboard. */
  redirectTo?: string;
}

/**
 * Route-level feature gate. Wrap a route's element to prevent direct URL
 * access to features the current plan does not include.
 *
 * While subscription data is still loading we render nothing (null) to avoid
 * a flash-redirect on initial page load. The brief blank is acceptable — the
 * Suspense fallback from App.tsx covers it.
 */
export default function FeatureRoute({
  feature,
  children,
  redirectTo = '/dashboard',
}: FeatureRouteProps) {
  const { hasFeature, isLoading } = useSubscription();

  // While loading, render nothing so we don't redirect prematurely.
  if (isLoading) return null;

  if (!hasFeature(feature)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
