import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

import {
  type QueuedWrite,
  queueMutation,
  getPendingActions,
  getPendingCount,
  removeQueuedAction,
  incrementRetry,
} from '@/utils/offlineQueue';
import { supabase } from '@/utils/supabaseClient';

// ---------------------------------------------------------------------------
// Internal replay helper
// ---------------------------------------------------------------------------

/**
 * Attempt to replay a single queued write against Supabase.
 * update/delete operations match on payload.id.
 */
async function replayWrite(write: QueuedWrite): Promise<boolean> {
  try {
    if (write.operation === 'insert') {
      const { error } = await supabase.from(write.table).insert(write.payload);
      if (error) throw error;
    } else if (write.operation === 'update') {
      const rowId = write.payload['id'];
      if (rowId === undefined) {
        throw new Error(`update missing payload.id for table ${write.table}`);
      }
      const { error } = await supabase
        .from(write.table)
        .update(write.payload)
        .eq('id', rowId as string);
      if (error) throw error;
    } else if (write.operation === 'delete') {
      const rowId = write.payload['id'];
      if (rowId === undefined) {
        throw new Error(`delete missing payload.id for table ${write.table}`);
      }
      const { error } = await supabase
        .from(write.table)
        .delete()
        .eq('id', rowId as string);
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.warn(`[useOfflineQueue] replay failed — ${write.operation} on ${write.table}:`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface OfflineQueueState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
}

export function useOfflineQueue(tenantId: string) {
  const [state, setState] = useState<OfflineQueueState>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
  });

  // Prevent concurrent sync runs
  const syncingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Refresh pending count from IndexedDB
  // ---------------------------------------------------------------------------
  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount(tenantId);
      setState(prev => ({ ...prev, pendingCount: count }));
    } catch (err) {
      console.warn('[useOfflineQueue] could not refresh pending count:', err);
    }
  }, [tenantId]);

  // ---------------------------------------------------------------------------
  // Enqueue a write
  // ---------------------------------------------------------------------------
  const enqueue = useCallback(
    async (
      params: Omit<QueuedWrite, 'id' | 'createdAt' | 'retries' | 'status' | 'tenantId'>,
    ): Promise<string> => {
      const id = await queueMutation({ ...params, tenantId });
      setState(prev => ({ ...prev, pendingCount: prev.pendingCount + 1 }));
      return id;
    },
    [tenantId],
  );

  // ---------------------------------------------------------------------------
  // Sync pending writes
  // ---------------------------------------------------------------------------
  const syncPending = useCallback(async (): Promise<void> => {
    if (!navigator.onLine || syncingRef.current) return;

    syncingRef.current = true;
    setState(prev => ({ ...prev, isSyncing: true }));

    let successful = 0;
    let failed = 0;

    try {
      const writes = await getPendingActions(tenantId);

      for (const write of writes) {
        const ok = await replayWrite(write);
        if (ok) {
          await removeQueuedAction(write.id);
          successful++;
        } else {
          await incrementRetry(write);
          failed++;
        }
      }

      if (failed > 0) {
        toast.warning(`${failed} operation${failed > 1 ? 's' : ''} could not sync`, {
          description: 'They will be retried automatically.',
        });
      }
    } catch (err) {
      console.error('[useOfflineQueue] sync error:', err);
    } finally {
      syncingRef.current = false;
      const remaining = await getPendingCount(tenantId);
      setState(prev => ({ ...prev, isSyncing: false, pendingCount: remaining }));

      if (successful > 0 && failed === 0) {
        toast.success(`${successful} operation${successful > 1 ? 's' : ''} synced`);
      }
    }
  }, [tenantId]);

  // ---------------------------------------------------------------------------
  // Network listeners + initial hydration
  // ---------------------------------------------------------------------------
  useEffect(() => {
    void refreshCount();

    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      void syncPending();
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCount, syncPending]);

  return {
    isOnline: state.isOnline,
    pendingCount: state.pendingCount,
    isSyncing: state.isSyncing,
    enqueue,
    syncPending,
  };
}
