import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import {
  type QueuedWrite,
  getPendingActions,
  removeQueuedAction,
  incrementRetry,
  queueMutation as queueMutationUtil,
} from '@/utils/offlineQueue';
import { supabase } from '@/utils/supabaseClient';

// Re-export for consumers that import from this hook file
export { queueMutation } from '@/utils/offlineQueue';
export type { QueuedWrite } from '@/utils/offlineQueue';

interface SyncStatus {
  isOnline: boolean;
  pendingActions: number;
  lastSyncTime: number | null;
  isSyncing: boolean;
}

/**
 * Replay a single queued write against Supabase.
 * For update/delete operations the primary key is read from payload.id.
 * Returns true on success, false on failure.
 */
async function replayWrite(write: QueuedWrite): Promise<boolean> {
  try {
    if (write.operation === 'insert') {
      const { error } = await supabase.from(write.table).insert(write.payload);
      if (error) throw error;
    } else if (write.operation === 'update') {
      const rowId = write.payload['id'];
      if (rowId === undefined) {
        throw new Error(`update write is missing payload.id for table ${write.table}`);
      }
      const { error } = await supabase
        .from(write.table)
        .update(write.payload)
        .eq('id', String(rowId));
      if (error) throw error;
    } else if (write.operation === 'delete') {
      const rowId = write.payload['id'];
      if (rowId === undefined) {
        throw new Error(`delete write is missing payload.id for table ${write.table}`);
      }
      const { error } = await supabase
        .from(write.table)
        .delete()
        .eq('id', String(rowId));
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.warn(`[OfflineSync] Failed to replay ${write.operation} on ${write.table}:`, err);
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

  /** Sync all pending queued writes against Supabase in createdAt order. */
  const syncActions = useCallback(async (): Promise<{ successful: number; failed: number }> => {
    if (!navigator.onLine) return { successful: 0, failed: 0 };

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));

    let successful = 0;
    let failed = 0;

    try {
      const writes = await getPendingActions();

      for (const write of writes) {
        const ok = await replayWrite(write);
        if (ok) {
          await removeQueuedAction(write.id);
          successful++;
        } else {
          await incrementRetry(write);
          failed++;
          toast.warning('Sync conflict', {
            description: `Could not sync a queued ${write.operation} on ${write.table}. It will retry automatically.`,
          });
        }
      }

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

  /** Add a write to the IndexedDB queue (delegates to shared utility). */
  const queueAction = useCallback(
    async (
      action: Omit<QueuedWrite, 'id' | 'createdAt' | 'retries' | 'status'>,
    ): Promise<string> => {
      const id = await queueMutationUtil(action);
      setSyncStatus(prev => ({ ...prev, pendingActions: prev.pendingActions + 1 }));
      return id;
    },
    [],
  );

  // Network event listeners + initial pending count
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      void syncActions(); // auto-sync on reconnection
    };
    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Hydrate count from IndexedDB on mount
    getPendingActions()
      .then(writes => {
        setSyncStatus(prev => ({ ...prev, pendingActions: writes.length }));
      })
      .catch(err => {
        console.warn('[OfflineSync] Could not read pending writes:', err);
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
