import {
  Bell,
  BellOff,
  DollarSign,
  Package,
  Settings,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useNotifications,
  type NotificationCategory,
} from '@/context/NotificationContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'inventory': return <Package className="h-4 w-4" />;
    case 'sales': return <ShoppingCart className="h-4 w-4" />;
    case 'employees': return <Users className="h-4 w-4" />;
    case 'finance': return <DollarSign className="h-4 w-4" />;
    case 'system': return <Settings className="h-4 w-4" />;
    case 'ai': return <Sparkles className="h-4 w-4" />;
  }
}

const CATEGORY_ORDER: NotificationCategory[] = [
  'inventory', 'sales', 'finance', 'employees', 'system', 'ai',
];

export function NotificationSettings() {
  const { t } = useTranslation();
  const { prefs, updatePref } = useNotifications();
  const {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const [isLoading, setIsLoading] = useState(false);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        await subscribe();
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPermissionStatus = () => {
    if (!isSupported) return { text: t('notifications.push.notSupported'), color: 'bg-white/10 text-white/60' };
    if (permission === 'granted') return { text: t('notifications.push.enabled'), color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' };
    if (permission === 'denied') return { text: t('notifications.push.blocked'), color: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' };
    return { text: t('notifications.push.notRequested'), color: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' };
  };

  const status = getPermissionStatus();

  const categoryLabels: Record<NotificationCategory, string> = {
    inventory: t('notifications.category.inventory'),
    sales: t('notifications.category.sales'),
    employees: t('notifications.category.employees'),
    finance: t('notifications.category.finance'),
    system: t('notifications.category.system'),
    ai: t('notifications.category.ai'),
  };

  return (
    <div className="space-y-6">

      {/* In-app notification categories */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="h-5 w-5 text-indigo-400" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-white">{t('notifications.title')}</h3>
          </div>
          <p className="text-sm text-white/60">{t('notifications.preferencesDesc')}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORY_ORDER.map(cat => (
            <button
              key={cat}
              onClick={() => updatePref(cat, !prefs[cat])}
              aria-pressed={prefs[cat]}
              className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                prefs[cat]
                  ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-white/40'
              }`}
            >
              <span aria-hidden="true">{getCategoryIcon(cat)}</span>
              {categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Push notifications */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="h-5 w-5 text-indigo-400" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-white">{t('notifications.push.title')}</h3>
          </div>
          <p className="text-sm text-white/60">{t('notifications.push.desc')}</p>
        </div>

        <div className="space-y-4">
          {!isSupported && (
            <div className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl">
              <BellOff className="h-4 w-4 text-white/40" aria-hidden="true" />
              <span className="text-sm text-white/60">{t('notifications.push.notSupportedDesc')}</span>
            </div>
          )}

          {isSupported && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-white/40" aria-hidden="true" />
                  <span className="text-sm font-medium text-white/80">{t('notifications.push.status')}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                  {status.text}
                </span>
              </div>

              {permission === 'denied' && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                  <p className="text-sm text-rose-300">{t('notifications.push.deniedDesc')}</p>
                </div>
              )}

              {permission === 'default' && (
                <button
                  onClick={() => { void handleEnableNotifications(); }}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {isLoading ? t('notifications.push.enabling') : t('notifications.push.enable')}
                </button>
              )}

              {permission === 'granted' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">{t('notifications.push.title')}</span>
                    <button
                      onClick={() => { void (subscription ? unsubscribe() : subscribe()); }}
                      disabled={isLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${subscription ? 'bg-indigo-600' : 'bg-white/20'}`}
                      role="switch"
                      aria-checked={!!subscription}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${subscription ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {subscription && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                      <p className="text-sm text-emerald-300">{t('notifications.push.activeDesc')}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
