import { Wifi, WifiOff, RefreshCw, AlertTriangle, Database, Clock, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

import { useOfflineSync } from '@/hooks/useOfflineSync';

export function OfflineIndicator() {
  const { syncStatus, syncActions } = useOfflineSync();
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  useEffect(() => {
    if (syncStatus.isOnline && syncStatus.pendingActions === 0) {
      setLastSyncTime(new Date().toLocaleTimeString());
    }
  }, [syncStatus.isOnline, syncStatus.pendingActions]);

  useEffect(() => {
    if (!syncStatus.isOnline || syncStatus.pendingActions > 0) {
      setIsAnimating(true);
    }
  }, [syncStatus.isOnline, syncStatus.pendingActions]);

  if (syncStatus.isOnline && syncStatus.pendingActions === 0) {
    return null;
  }

  const handleSync = async () => {
    await syncActions();
  };

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return 'orange';
    if (syncStatus.isSyncing) return 'indigo';
    if (syncStatus.pendingActions > 0) return 'yellow';
    return 'green';
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) return WifiOff;
    if (syncStatus.isSyncing) return RefreshCw;
    return Wifi;
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return 'Offline Mode';
    if (syncStatus.isSyncing) return 'Syncing Data';
    return 'Syncing Pending';
  };

  const getStatusDescription = () => {
    if (!syncStatus.isOnline) {
      return 'Working offline. Changes will sync when connection is restored.';
    }
    if (syncStatus.isSyncing) {
      return `Syncing ${syncStatus.pendingActions} actions to server...`;
    }
    return `${syncStatus.pendingActions} actions pending sync`;
  };

  const Icon = getStatusIcon();
  const statusColor = getStatusColor();

  return (
    <div className={`fixed top-4 right-4 left-4 md:left-auto md:w-80 z-40 transition-all duration-500 ease-out ${
      isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
    }`}>
      <Card className="backdrop-blur-xl border-white/15 shadow-2xl overflow-hidden" style={{
        backgroundColor: 'rgba(11, 15, 36, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 10px 40px rgba(2, 3, 12, 0.6)',
        backdropFilter: 'blur(12px)'
      }}>
        {/* Status Header */}
        <div className={`h-1 bg-gradient-to-r ${
          statusColor === 'green' ? 'from-emerald-600 to-emerald-700' :
            statusColor === 'indigo' ? 'from-indigo-600 to-indigo-700' :
              statusColor === 'yellow' ? 'from-amber-600 to-amber-700' :
                'from-orange-600 to-orange-700'
        }`} />

        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`relative p-2.5 rounded-2xl border ${
              statusColor === 'green' ? 'bg-emerald-600/20 border-emerald-600/30' :
                statusColor === 'indigo' ? 'bg-indigo-600/20 border-indigo-600/30' :
                  statusColor === 'yellow' ? 'bg-amber-600/20 border-amber-600/30' :
                    'bg-orange-600/20 border-orange-600/30'
            }`}>
              <Icon className={`h-5 w-5 ${
                statusColor === 'green' ? 'text-emerald-400' :
                  statusColor === 'indigo' ? 'text-indigo-400' :
                    statusColor === 'yellow' ? 'text-amber-400' :
                      'text-orange-400'
              }`} />
              {syncStatus.isSyncing && (
                <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400 animate-pulse" />
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-semibold text-white">
                {getStatusText()}
              </CardTitle>
              <CardDescription className="text-sm text-white/60">
                {getStatusDescription()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Status Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <Database className="h-4 w-4 text-blue-400" />
              <div>
                <div className="text-xs text-white/60">Pending</div>
                <div className="text-sm font-medium text-white">{syncStatus.pendingActions}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Clock className="h-4 w-4 text-white/60" />
              <div>
                <div className="text-xs text-white/60">Last Sync</div>
                <div className="text-sm font-medium text-white">{lastSyncTime || 'Never'}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {(syncStatus.isOnline && syncStatus.pendingActions > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs" style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}>
                    {syncStatus.pendingActions} items
                  </Badge>
                  {syncStatus.isSyncing && (
                    <div className="flex items-center gap-1 text-xs text-indigo-400">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Syncing...</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleSync}
                  disabled={syncStatus.isSyncing}
                  size="sm"
                  className="transition-all duration-200 active:scale-95"
                  style={{
                    backgroundColor: '#6366f1',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  {syncStatus.isSyncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 me-2 animate-spin" />
                      Syncing
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 me-2" />
                      Sync Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {!syncStatus.isOnline && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-orange-600/10 border border-orange-600/20 rounded-xl">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-orange-400">
                  All changes are saved locally and will sync automatically when connection is restored
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span>Local storage active</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Database className="h-3 w-3 text-blue-400" />
                  <span>Data preserved offline</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Clock className="h-3 w-3 text-white/40" />
                  <span>Auto-sync on reconnection</span>
                </div>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {syncStatus.isSyncing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Sync Progress</span>
                <span>Processing...</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div className="bg-indigo-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
