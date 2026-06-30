import { WifiOff, RefreshCw, CheckCircle, AlertTriangle, Database, Clock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

import { useApp } from '@/context/AppContext';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

// ---------------------------------------------------------------------------
// Sync-complete transient state
// ---------------------------------------------------------------------------
const SYNC_DONE_DURATION_MS = 3000;

export function OfflineIndicator() {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id ?? '';

  const { isOnline, pendingCount, isSyncing, syncPending } = useOfflineQueue(tenantId);

  // Track "all synced" flash state
  const [showSyncComplete, setShowSyncComplete] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Previous pending count — used to detect a sync-complete transition
  const prevPendingRef = useRef(pendingCount);
  const prevSyncingRef = useRef(isSyncing);

  useEffect(() => {
    const wassyncing = prevSyncingRef.current;
    const hadPending = prevPendingRef.current;

    prevSyncingRef.current = isSyncing;
    prevPendingRef.current = pendingCount;

    // Transition: was syncing → no longer syncing → nothing left → show "All synced"
    if (wassyncing && !isSyncing && hadPending > 0 && pendingCount === 0 && isOnline) {
      setShowSyncComplete(true);

      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        setShowSyncComplete(false);
      }, SYNC_DONE_DURATION_MS);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [isSyncing, pendingCount, isOnline]);

  // ---------------------------------------------------------------------------
  // Determine which state to show
  // ---------------------------------------------------------------------------
  const isOffline = !isOnline;
  const hasPending = pendingCount > 0;

  // Nothing to show — online, nothing pending, no transient message
  if (isOnline && !hasPending && !isSyncing && !showSyncComplete) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // State-specific content
  // ---------------------------------------------------------------------------
  type IndicatorState = 'offline' | 'syncing' | 'syncComplete' | 'pendingOnline';

  const state: IndicatorState = isOffline
    ? 'offline'
    : isSyncing
      ? 'syncing'
      : showSyncComplete
        ? 'syncComplete'
        : 'pendingOnline';

  const config = {
    offline: {
      color: 'amber' as const,
      Icon: WifiOff,
      title: 'Working offline',
      description: `${pendingCount} operation${pendingCount !== 1 ? 's' : ''} queued`,
      headerGradient: 'from-amber-600 to-amber-700',
      iconBg: 'bg-amber-600/20 border-amber-600/30',
      iconColor: 'text-amber-400',
    },
    syncing: {
      color: 'indigo' as const,
      Icon: RefreshCw,
      title: 'Syncing',
      description: `Syncing ${pendingCount} operation${pendingCount !== 1 ? 's' : ''}...`,
      headerGradient: 'from-indigo-600 to-indigo-700',
      iconBg: 'bg-indigo-600/20 border-indigo-600/30',
      iconColor: 'text-indigo-400',
    },
    syncComplete: {
      color: 'green' as const,
      Icon: CheckCircle,
      title: 'All synced',
      description: 'All operations have been synced successfully.',
      headerGradient: 'from-emerald-600 to-emerald-700',
      iconBg: 'bg-emerald-600/20 border-emerald-600/30',
      iconColor: 'text-emerald-400',
    },
    pendingOnline: {
      color: 'yellow' as const,
      Icon: Database,
      title: 'Sync pending',
      description: `${pendingCount} operation${pendingCount !== 1 ? 's' : ''} waiting to sync`,
      headerGradient: 'from-amber-600 to-amber-700',
      iconBg: 'bg-amber-600/20 border-amber-600/30',
      iconColor: 'text-amber-400',
    },
  }[state];

  const { Icon, title, description, headerGradient, iconBg, iconColor } = config;

  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto md:w-80 z-40 transition-all duration-500 ease-out opacity-100 translate-y-0">
      <Card
        className="backdrop-blur-xl border-white/15 shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(11, 15, 36, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 10px 40px rgba(2, 3, 12, 0.6)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Colour stripe */}
        <div className={`h-1 bg-gradient-to-r ${headerGradient}`} />

        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`relative p-2.5 rounded-2xl border ${iconBg}`}>
              <Icon
                className={`h-5 w-5 ${iconColor} ${state === 'syncing' ? 'animate-spin' : ''}`}
              />
              {state === 'syncing' && (
                <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400 animate-pulse" />
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-semibold text-white">{title}</CardTitle>
              <CardDescription className="text-sm text-white/60">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Pending count + last-sync row */}
          {state !== 'syncComplete' && (
            <div className="grid grid-cols-2 gap-3">
              <div
                className="flex items-center gap-2 p-3 rounded-xl"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                <Database className="h-4 w-4 text-blue-400" />
                <div>
                  <div className="text-xs text-white/60">Queued</div>
                  <div className="text-sm font-medium text-white">{pendingCount}</div>
                </div>
              </div>
              <div
                className="flex items-center gap-2 p-3 rounded-xl"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Clock className="h-4 w-4 text-white/60" />
                <div>
                  <div className="text-xs text-white/60">Status</div>
                  <div className="text-sm font-medium text-white">
                    {isOffline ? 'Offline' : 'Online'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Offline advisory */}
          {state === 'offline' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-amber-600/10 border border-amber-600/20 rounded-xl">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-400">
                  Changes are saved locally and will sync automatically when the connection is
                  restored.
                </span>
              </div>
            </div>
          )}

          {/* Manual sync button — only when online and pending */}
          {state === 'pendingOnline' && (
            <div className="flex items-center justify-between">
              <Badge
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                {pendingCount} item{pendingCount !== 1 ? 's' : ''}
              </Badge>
              <Button
                onClick={() => void syncPending()}
                disabled={isSyncing}
                size="sm"
                className="transition-all duration-200 active:scale-95"
                style={{ backgroundColor: '#6366f1', color: 'white', border: 'none' }}
              >
                <RefreshCw className="h-4 w-4 me-2" />
                Sync Now
              </Button>
            </div>
          )}

          {/* Syncing progress bar */}
          {state === 'syncing' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Sync Progress</span>
                <span>Processing...</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full animate-pulse"
                  style={{ width: '60%' }}
                />
              </div>
            </div>
          )}

          {/* Sync-complete confirmation */}
          {state === 'syncComplete' && (
            <div className="flex items-center gap-2 p-3 bg-emerald-600/10 border border-emerald-600/20 rounded-xl">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-400">
                All queued operations synced successfully.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
