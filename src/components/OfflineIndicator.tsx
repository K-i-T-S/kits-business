import { useStatus } from '@powersync/react';
import { WifiOff, RefreshCw, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const SYNC_DONE_DURATION_MS = 3000;

/**
 * Track: offline-first architecture, Phase 1b
 * (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
 *
 * Rewritten to read PowerSync's own connection/upload status instead of
 * the retired utils/offlineQueue.ts IndexedDB queue -- POS.tsx and
 * WaiterInterface.tsx no longer write to that queue, so it would sit
 * permanently empty and this indicator would silently show "0 pending,
 * online" even while PowerSync genuinely has writes syncing in the
 * background. No exact pending-operation count is shown here (PowerSync
 * doesn't surface one directly via useStatus() the way the old raw queue
 * did) -- that's an intentional simplification, not an oversight; showing
 * an approximated count would be worse than not showing one.
 */
export function OfflineIndicator() {
  const status = useStatus();
  const isOnline = status.connected;
  const isSyncing = status.dataFlowStatus?.uploading ?? false;

  // Track "all synced" flash state
  const [showSyncComplete, setShowSyncComplete] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSyncingRef = useRef(isSyncing);

  useEffect(() => {
    const wasSyncing = prevSyncingRef.current;
    prevSyncingRef.current = isSyncing;

    // Transition: was uploading -> no longer uploading -> show "All synced"
    if (wasSyncing && !isSyncing && isOnline) {
      setShowSyncComplete(true);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        setShowSyncComplete(false);
      }, SYNC_DONE_DURATION_MS);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [isSyncing, isOnline]);

  // Nothing to show — online, not syncing, no transient message
  if (isOnline && !isSyncing && !showSyncComplete) {
    return null;
  }

  type IndicatorState = 'offline' | 'syncing' | 'syncComplete';
  const state: IndicatorState = !isOnline ? 'offline' : isSyncing ? 'syncing' : 'syncComplete';

  const config = {
    offline: {
      Icon: WifiOff,
      title: 'Working offline',
      description: 'Changes are saved locally and will sync automatically when reconnected.',
      headerGradient: 'from-amber-600 to-amber-700',
      iconBg: 'bg-amber-600/20 border-amber-600/30',
      iconColor: 'text-amber-400',
    },
    syncing: {
      Icon: RefreshCw,
      title: 'Syncing',
      description: 'Sending queued changes to the server...',
      headerGradient: 'from-indigo-600 to-indigo-700',
      iconBg: 'bg-indigo-600/20 border-indigo-600/30',
      iconColor: 'text-indigo-400',
    },
    syncComplete: {
      Icon: CheckCircle,
      title: 'All synced',
      description: 'All offline changes have been synced successfully.',
      headerGradient: 'from-emerald-600 to-emerald-700',
      iconBg: 'bg-emerald-600/20 border-emerald-600/30',
      iconColor: 'text-emerald-400',
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
          {state !== 'syncComplete' && (
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
                  {isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          )}

          {state === 'offline' && (
            <div className="flex items-center gap-2 p-3 bg-amber-600/10 border border-amber-600/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-400">
                Changes are saved locally and will sync automatically when the connection is
                restored.
              </span>
            </div>
          )}

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

          {state === 'syncComplete' && (
            <div className="flex items-center gap-2 p-3 bg-emerald-600/10 border border-emerald-600/20 rounded-xl">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-400">
                All offline changes synced successfully.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
