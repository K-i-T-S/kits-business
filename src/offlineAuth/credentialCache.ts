/**
 * Local, per-device cache of employee PIN credentials -- IndexedDB-backed,
 * React-free (matches the pattern the retired utils/offlineQueue.ts used).
 *
 * Trust-on-first-use model: an owner/manager never sees an employee's PIN,
 * so nothing can be "provisioned" here. A cache entry is only ever written
 * automatically, the moment an employee successfully authenticates online
 * on this specific device (see PinLockScreen's submitPin()) -- and only if
 * this device is a registered trusted terminal at that moment. Refreshed
 * on every online login, so a PIN change updates the cache the next time
 * that employee logs in online, same as any password-change-invalidates-
 * cached-hash pattern.
 *
 * Database : kits-offline-auth
 * Store    : credentials (keyPath: employeeId)
 */

const DB_NAME = 'kits-offline-auth';
const DB_VERSION = 1;
const CREDENTIALS_STORE = 'credentials';
const BOOTSTRAP_STORE = 'bootstrap';

export interface CachedCredential {
  employeeId: string;
  tenantId: string;
  /** PHC-format encoded Argon2id hash -- salt and parameters travel with it. */
  encodedHash: string;
  cachedAt: number;
}

function openOfflineAuthDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CREDENTIALS_STORE)) {
        db.createObjectStore(CREDENTIALS_STORE, { keyPath: 'employeeId' });
      }
      if (!db.objectStoreNames.contains(BOOTSTRAP_STORE)) {
        db.createObjectStore(BOOTSTRAP_STORE, { keyPath: 'key' });
      }
    };
  });
}

export async function cacheCredential(entry: Omit<CachedCredential, 'cachedAt'>): Promise<void> {
  const db = await openOfflineAuthDB();
  const record: CachedCredential = { ...entry, cachedAt: Date.now() };
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CREDENTIALS_STORE], 'readwrite');
    const req = tx.objectStore(CREDENTIALS_STORE).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedCredential(employeeId: string): Promise<CachedCredential | null> {
  try {
    const db = await openOfflineAuthDB();
    return await new Promise<CachedCredential | null>((resolve, reject) => {
      const tx = db.transaction([CREDENTIALS_STORE], 'readonly');
      const req = tx.objectStore(CREDENTIALS_STORE).get(employeeId);
      req.onsuccess = () => resolve((req.result as CachedCredential | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Clears every cached credential -- called on full sign-out / device deregistration. */
export async function clearAllCachedCredentials(): Promise<void> {
  const db = await openOfflineAuthDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CREDENTIALS_STORE], 'readwrite');
    const req = tx.objectStore(CREDENTIALS_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Clears the cached tenant/employee bootstrap snapshot -- called alongside clearAllCachedCredentials() on full sign-out. */
export async function clearBootstrapData(): Promise<void> {
  const db = await openOfflineAuthDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([BOOTSTRAP_STORE], 'readwrite');
    const req = tx.objectStore(BOOTSTRAP_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Bootstrap cache -- tenant + PIN-employee roster, needed so the app has
// something to render if it's opened cold while genuinely offline (not
// just "went offline mid-session", where AppContext's in-memory state is
// already populated). Refreshed on every successful online tenant load.
// ---------------------------------------------------------------------------

export interface OfflineBootstrapData {
  // Full Tenant/Employee[] shapes (not a hand-picked subset) -- avoids a
  // second, drifting definition of what a tenant/employee looks like.
  // Cached and read back as plain JSON-serializable objects (both types
  // already are), so no class instances or non-serializable fields.
  tenant: Record<string, unknown>;
  employees: Array<Record<string, unknown>>;
  cachedAt: number;
}

export async function cacheBootstrapData(data: Omit<OfflineBootstrapData, 'cachedAt'>): Promise<void> {
  const db = await openOfflineAuthDB();
  const record: OfflineBootstrapData & { key: string } = {
    key: 'current',
    ...data,
    cachedAt: Date.now(),
  };
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([BOOTSTRAP_STORE], 'readwrite');
    const req = tx.objectStore(BOOTSTRAP_STORE).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedBootstrapData(): Promise<OfflineBootstrapData | null> {
  try {
    const db = await openOfflineAuthDB();
    return await new Promise<OfflineBootstrapData | null>((resolve, reject) => {
      const tx = db.transaction([BOOTSTRAP_STORE], 'readonly');
      const req = tx.objectStore(BOOTSTRAP_STORE).get('current');
      req.onsuccess = () => resolve((req.result as OfflineBootstrapData | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
