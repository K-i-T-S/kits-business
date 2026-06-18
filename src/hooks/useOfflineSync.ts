import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/utils/supabaseClient';
import {
  type OfflineAction,
  getPendingActions,
  removeQueuedAction,
  incrementRetry,
  queueMutation as queueMutationUtil,
} from '@/utils/offlineQueue';

// Re-export for consumers that import from this hook file
export { queueMutation } from '@/utils/offlineQueue';
export type { OfflineAction } from '@/utils/offlineQueue';

interface SyncStatus {
  isOnline: boolean;
  pendingActions: number;
  lastSyncTime: number | null;
  isSyncing: boolean;
}

/**
 * Replay a single queued action against Supabase.
 * Returns true on success, false on failure.
 */
async function replayAction(action: OfflineAction): Promise<boolean> {
  try {
    if (action.operation === 'insert') {
      const { error } = await supabase.from(action.table).insert(action.payload);
      if (error) throw error;
    } else if (action.operation === 'update') {
      if (!action.matchColumn || action.matchValue === undefined) {
        throw new Error(`update action missing matchColumn/matchValue for table ${action.table}`);
      }
      const { error } = await supabase
        .from(action.table)
        .update(action.payload)
        .eq(action.matchColumn, action.matchValue);
      if (error) throw error;
    } else if (action.operation === 'delete') {
      if (!action.matchColumn || action.matchValue === undefined) {
        throw new Error(`delete action missing matchColumn/matchValue for table ${action.table}`);
      }
      const { error } = await supabase
        .from(action.table)
        .delete()
        .eq(action.matchColumn, action.matchValue);
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.warn(`[OfflineSync] Failed to replay ${action.operation} on ${action.table}:`, err);
    return false;
  }
}

export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    pendingActions: 0,
    lastSyncTime: null,
    isSyncing: false,
  });

  /** Sync all pending queued actions against Supabase in timestamp order. */
  const syncActions = useCallback(async (): Promise<{ successful: number; failed: number }> => {
    if (!navigator.onLine) return { successful: 0, failed: 0 };

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));

    let successful = 0;
    let failed = 0;

    try {
      const actions = await getPendingActions();

      for (const action of actions) {
        const ok = await replayAction(action);
        if (ok) {
          await removeQueuedAction(action.id);
          successful++;
        } else {
          await incrementRetry(action);
          failed++;
          // Show a conflict toast so the user knows about it
          toast.warning('Sync conflict', {
            description: `Could not sync a queued ${action.operation} on ${action.table}. It will retry automatically.`,
          });
        }
      }

      // Refresh pending count after sync
      const remaining = await getPendingActions();
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now(),
        pendingActions: remaining.length,
      }));
    } catch (err) {
      console.error('[OfflineSync] Sync error:', err);
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }

    return { successful, failed };
  }, []);

  /** Add an action to the IndexedDB queue (delegate to shared utility). */
  const queueAction = useCallback(
    async (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> => {
      await queueMutationUtil(action);
      setSyncStatus(prev => ({ ...prev, pendingActions: prev.pendingActions + 1 }));
    },
    [],
  );

  // Network event listeners + initial pending count
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      syncActions(); // auto-sync on reconnection
    };
    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Hydrate count from IndexedDB on mount
    getPendingActions().then(actions => {
      setSyncStatus(prev => ({ ...prev, pendingActions: actions.length }));
    }).catch(err => {
      console.warn('[OfflineSync] Could not read pending actions:', err);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncActions]);

  return {
    syncStatus,
    queueAction,
    syncActions,
  };
}
