import { useState, useEffect, useCallback } from 'react'

interface OfflineAction {
  id: string
  type: 'create' | 'update' | 'delete'
  endpoint: string
  data: any
  timestamp: number
  retryCount?: number
}

interface SyncStatus {
  isOnline: boolean
  pendingActions: number
  lastSyncTime: number | null
  isSyncing: boolean
}

export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    pendingActions: 0,
    lastSyncTime: null,
    isSyncing: false
  })

  // Initialize IndexedDB for offline storage
  const initDB = useCallback(async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BusinessTerminalDB', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create object store for pending actions
        if (!db.objectStoreNames.contains('pendingActions')) {
          const actionStore = db.createObjectStore('pendingActions', { keyPath: 'id' })
          actionStore.createIndex('timestamp', 'timestamp', { unique: false })
          actionStore.createIndex('endpoint', 'endpoint', { unique: false })
        }
        
        // Create object store for cached data
        if (!db.objectStoreNames.contains('cachedData')) {
          const dataStore = db.createObjectStore('cachedData', { keyPath: 'key' })
          dataStore.createIndex('expiry', 'expiry', { unique: false })
        }
      }
    })
  }, [])

  // Get pending actions from IndexedDB
  const getPendingActions = useCallback(async (): Promise<OfflineAction[]> => {
    try {
      const db = await initDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['pendingActions'], 'readonly')
        const store = transaction.objectStore('pendingActions')
        const request = store.getAll()
        
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error getting pending actions:', error)
      return []
    }
  }, [initDB])

  // Add action to offline queue
  const queueAction = useCallback(async (action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
    try {
      const db = await initDB()
      const actionWithMeta: OfflineAction = {
        ...action,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0
      }

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['pendingActions'], 'readwrite')
        const store = transaction.objectStore('pendingActions')
        const request = store.add(actionWithMeta)
        
        request.onsuccess = () => {
          setSyncStatus(prev => ({ ...prev, pendingActions: prev.pendingActions + 1 }))
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error queuing action:', error)
      throw error
    }
  }, [initDB])

  // Remove action from queue
  const removeAction = useCallback(async (id: string) => {
    try {
      const db = await initDB()
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['pendingActions'], 'readwrite')
        const store = transaction.objectStore('pendingActions')
        const request = store.delete(id)
        
        request.onsuccess = () => {
          setSyncStatus(prev => ({ ...prev, pendingActions: Math.max(0, prev.pendingActions - 1) }))
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error removing action:', error)
      throw error
    }
  }, [initDB])

  // Sync pending actions
  const syncActions = useCallback(async () => {
    if (!navigator.onLine) return

    setSyncStatus(prev => ({ ...prev, isSyncing: true }))

    try {
      const actions = await getPendingActions()
      const results = await Promise.allSettled(
        actions.map(async (action) => {
          try {
            const response = await fetch(action.endpoint, {
              method: action.type === 'create' ? 'POST' : action.type === 'update' ? 'PUT' : 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: action.type !== 'delete' ? JSON.stringify(action.data) : undefined
            })

            if (response.ok) {
              await removeAction(action.id)
              return { success: true, action }
            } else {
              throw new Error(`HTTP ${response.status}`)
            }
          } catch (error) {
            // Increment retry count
            const db = await initDB()
            const transaction = db.transaction(['pendingActions'], 'readwrite')
            const store = transaction.objectStore('pendingActions')
            
            const updatedAction = { ...action, retryCount: (action.retryCount || 0) + 1 }
            await store.put(updatedAction)
            
            // Remove action if too many retries
            if (updatedAction.retryCount! > 3) {
              await removeAction(action.id)
            }
            
            throw error
          }
        })
      )

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now(),
        pendingActions: prev.pendingActions - successful
      }))

      return { successful, failed }
    } catch (error) {
      console.error('Sync error:', error)
      setSyncStatus(prev => ({ ...prev, isSyncing: false }))
      throw error
    }
  }, [getPendingActions, removeAction, initDB])

  // Cache data for offline use
  const cacheData = useCallback(async (key: string, data: any, expiryMinutes = 30) => {
    try {
      const db = await initDB()
      const cacheEntry = {
        key,
        data,
        expiry: Date.now() + (expiryMinutes * 60 * 1000)
      }

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['cachedData'], 'readwrite')
        const store = transaction.objectStore('cachedData')
        const request = store.put(cacheEntry)
        
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error caching data:', error)
      throw error
    }
  }, [initDB])

  // Get cached data
  const getCachedData = useCallback(async (key: string): Promise<any | null> => {
    try {
      const db = await initDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cachedData'], 'readonly')
        const store = transaction.objectStore('cachedData')
        const request = store.get(key)
        
        request.onsuccess = () => {
          const result = request.result
          if (result && result.expiry > Date.now()) {
            resolve(result.data)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error getting cached data:', error)
      return null
    }
  }, [initDB])

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }))
      syncActions() // Auto-sync when coming back online
    }

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial sync status check
    getPendingActions().then(actions => {
      setSyncStatus(prev => ({ ...prev, pendingActions: actions.length }))
    })

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncActions, getPendingActions])

  return {
    syncStatus,
    queueAction,
    syncActions,
    cacheData,
    getCachedData
  }
}
