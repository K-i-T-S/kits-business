import { useEffect, useState } from 'react';

import { log } from '../utils/logger';

interface ServiceWorkerStatus {
  supported: boolean
  registered: boolean
  activated: boolean
  controlling: boolean
}

export function useServiceWorker() {
  const [status, setStatus] = useState<ServiceWorkerStatus>({
    supported: false,
    registered: false,
    activated: false,
    controlling: false,
  });

  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
      setStatus(prev => ({ ...prev, supported: true }));

      // Register service worker
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          log.info('Service Worker registered', { registration });
          setStatus(prev => ({ ...prev, registered: true }));

          // Check if there's an active service worker
          if (registration.active) {
            setStatus(prev => ({ ...prev, activated: true }));
          }

          // Check if service worker is controlling the page
          if (navigator.serviceWorker.controller) {
            setStatus(prev => ({ ...prev, controlling: true }));
            setOfflineReady(true);
          }

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  setStatus(prev => ({ ...prev, activated: true }));
                  setOfflineReady(true);
                }
              });
            }
          });
        })
        .catch(error => {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          log.error('Service Worker registration failed', errorObj);
        });

      // Listen for controlling service worker changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setStatus(prev => ({ ...prev, controlling: true }));
        setOfflineReady(true);
        // Reload the page to ensure the new service worker takes control
        window.location.reload();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_UPDATED') {
          log.info('Cache updated', { payload: event.data.payload });
        }
      });
    }
  }, []);

  const updateServiceWorker = async () => {
    if (!status.supported) return false;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.waiting) {
        // Send message to waiting service worker to skip waiting
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      log.error('Failed to update service worker', errorObj);
    }
    return false;
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        log.error('Notification permission request failed', errorObj);
        return false;
      }
    }
    return false;
  };

  const showNotification = async (title: string, options?: NotificationOptions) => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && Notification.permission === 'granted') {
          return registration.showNotification(title, options);
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        log.error('Failed to show notification', errorObj);
      }
    }
    return null;
  };

  return {
    status,
    offlineReady,
    updateServiceWorker,
    requestNotificationPermission,
    showNotification,
  };
}

// Hook for offline detection
export function useOfflineDetection() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineActions, setOfflineActions] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger background sync if supported
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          if ('sync' in registration) {
            (registration as any).sync.register('background-sync');
          }
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor offline actions queue
  useEffect(() => {
    const checkOfflineActions = async () => {
      if ('indexedDB' in window) {
        try {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('OfflineActions', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = () => {
              const db = request.result;
              db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
            };
          });

          const transaction = (db as IDBDatabase).transaction(['actions'], 'readonly');
          const store = transaction.objectStore('actions');
          const count = await new Promise<number>((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          setOfflineActions(count);
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          log.error('Failed to check offline actions', errorObj);
        }
      }
    };

    checkOfflineActions();
    const interval = setInterval(checkOfflineActions, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    isOnline,
    offlineActions,
    hasPendingActions: offlineActions > 0,
  };
}
