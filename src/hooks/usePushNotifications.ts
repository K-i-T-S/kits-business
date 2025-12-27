import { useState, useEffect, useCallback } from 'react'

interface NotificationOptions {
  title: string
  body?: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  actions?: NotificationAction[]
  requireInteraction?: boolean
  silent?: boolean
}

interface NotificationAction {
  action: string
  title: string
  icon?: string
}

interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'Notification' in window && 
                     'serviceWorker' in navigator && 
                     'PushManager' in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
    }
  }, [])

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Push notifications are not supported')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }, [isSupported])

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!isSupported || permission !== 'granted') {
      console.warn('Notification permission not granted')
      return null
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // @ts-ignore - Type issue with VAPID key
        applicationServerKey: urlBase64ToUint8Array(
          // This should be your VAPID public key
          'BMvFLkYzL7pJ4qm3q2YJjQhQpL4f8q5v6w7x8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5'
        )
      })

      const subscriptionData = {
        endpoint: pushSubscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(pushSubscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(pushSubscription.getKey('auth')!)
        }
      }

      setSubscription(subscriptionData)
      
      // Send subscription to your server
      await sendSubscriptionToServer(subscriptionData)
      
      return subscriptionData
    } catch (error) {
      console.error('Error subscribing to push notifications:', error)
      return null
    }
  }, [isSupported, permission])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!subscription) return true

    try {
      const registration = await navigator.serviceWorker.ready
      const pushSubscription = await registration.pushManager.getSubscription()
      
      if (pushSubscription) {
        await pushSubscription.unsubscribe()
        await removeSubscriptionFromServer(subscription)
        setSubscription(null)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error)
      return false
    }
  }, [subscription])

  // Show local notification
  const showNotification = useCallback(async (options: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.warn('Notification permission not granted')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/logo.png',
        badge: options.badge || '/logo.png',
        tag: options.tag,
        data: options.data,
        // @ts-ignore - actions is supported in some browsers
        actions: options.actions,
        requireInteraction: options.requireInteraction,
        silent: options.silent
      })
    } catch (error) {
      console.error('Error showing notification:', error)
    }
  }, [isSupported, permission])

  // Send push message from server (this would be called from your backend)
  const sendPushNotification = useCallback(async (subscription: PushSubscription, payload: any) => {
    // This is a placeholder for server-side push notification sending
    // In a real implementation, this would be called from your backend
    console.log('Sending push notification:', { subscription, payload })
  }, [])

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    sendPushNotification
  }
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  
  return outputArray
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  
  return window.btoa(binary)
}

// Server communication functions (these would make API calls to your backend)
async function sendSubscriptionToServer(subscription: PushSubscription) {
  try {
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription)
    })
  } catch (error) {
    console.error('Error sending subscription to server:', error)
  }
}

async function removeSubscriptionFromServer(subscription: PushSubscription) {
  try {
    await fetch('/api/notifications/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    })
  } catch (error) {
    console.error('Error removing subscription from server:', error)
  }
}
