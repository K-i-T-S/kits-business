import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export type NotificationCategory = 'inventory' | 'sales' | 'employees' | 'finance' | 'system' | 'ai';
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href?: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationPrefs {
  inventory: boolean;
  sales: boolean;
  employees: boolean;
  finance: boolean;
  system: boolean;
  ai: boolean;
}

const STORAGE_KEY = 'kits_notifications';
const PREFS_KEY = 'kits_notification_prefs';

const DEFAULT_PREFS: NotificationPrefs = {
  inventory: true,
  sales: true,
  employees: true,
  finance: true,
  system: true,
  ai: true,
};

function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

interface NotificationContextValue {
  notifications: AppNotification[];
  visibleNotifications: AppNotification[];
  unreadCount: number;
  prefs: NotificationPrefs;
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  updatePref: (category: NotificationCategory, value: boolean) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications);
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const visibleNotifications = notifications.filter(n => prefs[n.category]);
  const unreadCount = visibleNotifications.filter(n => !n.read).length;

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => {
      const dedupKey = `${n.category}::${n.title}`;
      const oneHourAgo = Date.now() - 3_600_000;
      if (prev.some(p => `${p.category}::${p.title}` === dedupKey && p.timestamp > oneHourAgo)) return prev;
      const newN: AppNotification = {
        ...n,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        read: false,
      };
      return [newN, ...prev].slice(0, 50);
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const updatePref = useCallback((category: NotificationCategory, value: boolean) => {
    setPrefs(prev => ({ ...prev, [category]: value }));
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      visibleNotifications,
      unreadCount,
      prefs,
      addNotification,
      markRead,
      markAllRead,
      dismiss,
      clearAll,
      updatePref,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
