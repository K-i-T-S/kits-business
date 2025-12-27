const CACHE_NAME = 'business-terminal-v1'
const STATIC_CACHE_NAME = 'static-v1'
const API_CACHE_NAME = 'api-v1'

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/assets/',
  // Add other static assets as needed
]

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/products',
  '/api/customers', 
  '/api/employees',
  '/api/sales'
]

// Cache strategies
const cacheStrategies = {
  // Cache first for static assets
  static: async (request) => {
    const cache = await caches.open(STATIC_CACHE_NAME)
    const cached = await cache.match(request)
    
    if (cached) {
      return cached
    }
    
    try {
      const response = await fetch(request)
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    } catch (error) {
      // Return cached version if available, otherwise offline page
      const cachedResponse = await cache.match('/offline.html')
      return cachedResponse || new Response('Offline', { status: 503 })
    }
  },

  // Network first for API calls with cache fallback
  api: async (request) => {
    const cache = await caches.open(API_CACHE_NAME)
    
    try {
      const response = await fetch(request)
      
      // Only cache successful GET requests
      if (response.ok && request.method === 'GET') {
        cache.put(request, response.clone())
      }
      
      return response
    } catch (error) {
      // Try to get from cache
      const cached = await cache.match(request)
      if (cached) {
        return cached
      }
      
      // Return offline response for API calls
      return new Response(
        JSON.stringify({
          error: 'Offline',
          message: 'No network connection and cached data not available'
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  },

  // Stale while revalidate for frequently accessed data
  staleWhileRevalidate: async (request) => {
    const cache = await caches.open(API_CACHE_NAME)
    const cached = await cache.match(request)
    
    // Always try to fetch in background
    const fetchPromise = fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    }).catch(() => null)
    
    // Return cached version immediately if available
    if (cached) {
      // Trigger background fetch
      fetchPromise
      return cached
    }
    
    // If no cache, wait for network
    try {
      return await fetchPromise || await fetch(request)
    } catch (error) {
      return new Response('Offline', { status: 503 })
    }
  }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then(cache => {
        return cache.addAll(STATIC_ASSETS)
      }),

      // Pre-cache critical API endpoints
      caches.open(API_CACHE_NAME).then(cache => {
        return Promise.all(
          API_ENDPOINTS.map(endpoint =>
            fetch(endpoint).then(response => {
              if (response.ok) {
                cache.put(endpoint, response)
              }
            }).catch(() => null)
          )
        )
      })
    ])
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name =>
            name !== STATIC_CACHE_NAME &&
            name !== API_CACHE_NAME &&
            name !== CACHE_NAME
          )
          .map(name => caches.delete(name))
      )
    })
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    return
  }

  // Handle different types of requests
  if (url.origin === self.location.origin) {
    // Static assets from same origin
    if (url.pathname.includes('/assets/') ||
        url.pathname.includes('/static/') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico')) {

      event.respondWith(cacheStrategies.static(request))
      return
    }
  }

  // API calls
  if (url.pathname.startsWith('/api/')) {
    // Use stale-while-revalidate for critical data
    if (API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
      event.respondWith(cacheStrategies.staleWhileRevalidate(request))
    } else {
      event.respondWith(cacheStrategies.api(request))
    }
    return
  }

  // External resources (CDN, etc.)
  if (url.origin !== self.location.origin) {
    event.respondWith(cacheStrategies.static(request))
    return
  }
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  // Get all pending actions from IndexedDB
  const pendingActions = await getPendingActions()

  for (const action of pendingActions) {
    try {
      // Retry the failed request
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body
      })

      if (response.ok) {
        // Remove from pending actions
        await removePendingAction(action.id)
      }
    } catch (error) {
      console.error('Background sync failed for action:', action, error)
    }
  }
}

// Push notifications for offline status
self.addEventListener('push', (event) => {
  const options = {
    body: 'You have pending actions that will sync when you\'re back online.',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'offline-sync',
    renotify: true,
    actions: [
      {
        action: 'sync-now',
        title: 'Sync Now'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification('Offline Actions Pending', options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'sync-now') {
    event.waitUntil(doBackgroundSync())
  }

  // Open the app
  event.waitUntil(
    clients.openWindow('/')
  )
})

// IndexedDB helpers for offline queue
async function getPendingActions() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineActions', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction(['actions'], 'readonly')
      const store = transaction.objectStore('actions')
      const getAll = store.getAll()

      getAll.onsuccess = () => resolve(getAll.result)
      getAll.onerror = () => reject(getAll.error)
    }

    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true })
    }
  })
}

async function removePendingAction(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineActions', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction(['actions'], 'readwrite')
      const store = transaction.objectStore('actions')
      const deleteRequest = store.delete(id)

      deleteRequest.onsuccess = () => resolve()
      deleteRequest.onerror = () => reject(deleteRequest.error)
    }
  })
}
