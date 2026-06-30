/**
 * Offline write queue — IndexedDB-backed, React-free.
 * Safe to import from AppContext, hooks, or any non-React module.
 *
 * Database : kits-offline-queue
 * Store    : writes
 */

const DB_NAME = 'kits-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'writes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueuedWrite {
  id: string;
  tenantId: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  status: 'pending' | 'syncing' | 'failed';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Opens (or upgrades) the offline-queue database. */
export async function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('tenantId', 'tenantId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// ---------------------------------------------------------------------------
// Core write operations
// ---------------------------------------------------------------------------

/**
 * Add a write to the queue.
 * Returns the generated id so callers can reference or cancel it.
 */
export async function queueMutation(
  params: Omit<QueuedWrite, 'id' | 'createdAt' | 'retries' | 'status'>,
): Promise<string> {
  const db = await openOfflineDB();

  const write: QueuedWrite = {
    ...params,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    retries: 0,
    status: 'pending',
  };

  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(write);
    req.onsuccess = () => resolve(write.id);
    req.onerror = () => reject(req.error);
  });
}

/** Alias used by legacy callers and POS.tsx (Sprint 21-B). */
export const enqueueWrite = queueMutation;

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Return pending writes, optionally scoped to a tenant.
 * Only returns items with status === 'pending' (never 'failed' or 'syncing').
 * Ordered by createdAt ascending so oldest writes replay first.
 */
export async function getPendingActions(tenantId?: string): Promise<QueuedWrite[]> {
  try {
    const db = await openOfflineDB();

    return await new Promise<QueuedWrite[]>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as unknown[]).map((v) => v as QueuedWrite);
        const pending = all
          .filter((w) => w.status === 'pending')
          .filter((w) => (tenantId !== undefined ? w.tenantId === tenantId : true))
          .sort((a, b) => a.createdAt - b.createdAt);
        resolve(pending);
      };

      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Alias for getPendingActions. */
export const getPendingWrites = getPendingActions;

/**
 * Count pending writes for a given tenant.
 * Counts only status === 'pending'.
 */
export async function getPendingCount(tenantId: string): Promise<number> {
  const pending = await getPendingActions(tenantId);
  return pending.length;
}

// ---------------------------------------------------------------------------
// Mutation operations
// ---------------------------------------------------------------------------

/** Remove a write after it has been successfully synced. */
export async function removeQueuedAction(id: string): Promise<void> {
  const db = await openOfflineDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Alias — mark a write as synced (removes it from the queue). */
export const markWriteSynced = removeQueuedAction;

/**
 * Increment the retry counter for a write.
 * If retries reaches 3 or more the write is marked 'failed' and kept for
 * inspection; otherwise it stays 'pending' for the next sync cycle.
 */
export async function incrementRetry(write: QueuedWrite): Promise<void> {
  const updated: QueuedWrite = {
    ...write,
    retries: write.retries + 1,
    status: write.retries + 1 >= 3 ? 'failed' : 'pending',
  };

  const db = await openOfflineDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Alias — mark a write as failed (increments retry, sets status after threshold). */
export const markWriteFailed = incrementRetry;
