import { Navigate, useLocation } from 'react-router-dom';

import { useApp } from '@/context/AppContext';

const PROVISIONAL_ALLOWED_PATHS = new Set(['/pos']);

/**
 * Restricts navigation to the core-POS scope while authMode === 'provisional'
 * (offline PIN login -- see PinLockScreen.tsx). A provisional session has no
 * real Supabase session; its data comes entirely from the last cached
 * bootstrap snapshot plus PowerSync's local store, both scoped to core POS
 * (sales/products/table orders -- see migration 000076's publication). Any
 * other route would either query tables PowerSync never synced (silently
 * empty/broken) or write through a direct supabase.from() call with no
 * network to reach -- so provisional sessions are hard-redirected back to
 * /pos, the same landing page PinLockScreen itself sends a fresh offline
 * login to, rather than left to fail soft page-by-page.
 *
 * Mounted once alongside PinLockScreen so it applies regardless of how the
 * route was reached (direct URL, back button, a stale bookmark) and can't
 * be bypassed by navigating around any single Route element's own guard.
 */
export function ProvisionalModeGate() {
  const { authMode } = useApp();
  const location = useLocation();

  if (authMode === 'provisional' && !PROVISIONAL_ALLOWED_PATHS.has(location.pathname)) {
    return <Navigate to="/pos" replace />;
  }

  return null;
}
