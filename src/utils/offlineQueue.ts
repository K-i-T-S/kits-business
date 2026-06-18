/**
 * Offline queue utility — plain functions with no React dependencies.
 * Safe to import from AppContext or any non-React module.
 *
 * Uses IndexedDB (same database as useOfflineSync) so the hook and
 * these utilities share the same queue and can both read pending counts.
 */

const DB_NAME = 'BusinessTerminalDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingActions';

export interface OfflineAction {
  id: string;
  table: 'products' | 'sales' | 'customers' | 'employees' | 'sale_items';
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  matchColumn?: string; // for update/delete: which column to match
  matchValue?: string; // the value to match
  timestamp: number;
  retryCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('cachedData')) {
        const dataStore = db.createObjectStore('cachedData', { keyPath: 'key' });
        dataStore.createIndex('expiry', 'expiry', { unique: false });
      }
    };
  });
}

/** Queue a mutation to be replayed when the app comes back online. */
export async function queueMutation(
  action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>,
): Promise<void> {
  const db = await openDB();
  const full: OfflineAction = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: Date.now(),
    retryCount: 0,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(full);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Fetch all pending actions, ordered by timestamp ascending. */
export async function getPendingActions(): Promise<OfflineAction[]> {
  try {
    const db = await openDB();
    return await new Promise<OfflineAction[]>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result as OfflineAction[];
        all.sort((a, b) => a.timestamp - b.timestamp);
        resolve(all);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Remove a successfully replayed (or permanently failed) action from the queue. */
export async function removeQueuedAction(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Increment the retry count for an action. Remove it after MAX_RETRIES. */
export async function incrementRetry(action: OfflineAction): Promise<void> {
  const MAX_RETRIES = 3;
  const updated: OfflineAction = { ...action, retryCount: action.retryCount + 1 };
  if (updated.retryCount > MAX_RETRIES) {
    await removeQueuedAction(action.id);
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
