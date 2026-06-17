import { Bell, BellOff, Settings, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationSettings() {
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

  const handleDisableNotifications = async () => {
    setIsLoading(true);
    try {
      await unsubscribe();
    } catch (error) {
      console.error('Error disabling notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPermissionStatus = () => {
    if (!isSupported) return { text: 'Not Supported', color: 'bg-white/10 text-white/60' };
    if (permission === 'granted') return { text: 'Enabled', color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' };
    if (permission === 'denied') return { text: 'Blocked', color: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' };
    return { text: 'Not Requested', color: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' };
  };

  const status = getPermissionStatus();

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-5 w-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-white">Push Notifications</h3>
        </div>
        <p className="text-sm text-white/60">
          Stay updated with important business alerts and notifications
        </p>
      </div>

      <div className="space-y-4">
        {!isSupported && (
          <div className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl">
            <BellOff className="h-4 w-4 text-white/40" />
            <span className="text-sm text-white/60">
              Push notifications are not supported in this browser
            </span>
          </div>
        )}

        {isSupported && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-white/40" />
                <span className="text-sm font-medium text-white/80">Status</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>
                {status.text}
              </span>
            </div>

            {permission === 'denied' && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                <p className="text-sm text-rose-300">
                  Notifications are blocked in your browser settings.
                  Please enable them in your browser preferences to receive push notifications.
                </p>
              </div>
            )}

            {permission === 'default' && (
              <button
                onClick={handleEnableNotifications}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Bell className="h-4 w-4" />
                {isLoading ? 'Enabling...' : 'Enable Notifications'}
              </button>
            )}

            {permission === 'granted' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/80">Push Notifications</span>
                  <button
                    onClick={() => subscription ? unsubscribe() : subscribe()}
                    disabled={isLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${subscription ? 'bg-indigo-600' : 'bg-white/20'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${subscription ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {subscription && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <p className="text-sm text-emerald-300">
                      ✓ Push notifications are enabled for this device
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white/80">Notification Types:</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Sales Alerts', defaultOn: true },
                      { label: 'Inventory Updates', defaultOn: true },
                      { label: 'Customer Messages', defaultOn: false },
                      { label: 'System Updates', defaultOn: false },
                    ].map(({ label, defaultOn }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-sm text-white/70">{label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${defaultOn ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 text-white/40'}`}>
                          {defaultOn ? 'On' : 'Off'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Settings className="h-3 w-3" />
            <span>You can change these settings anytime in your browser preferences</span>
          </div>
        </div>
      </div>
    </div>
  );
}
