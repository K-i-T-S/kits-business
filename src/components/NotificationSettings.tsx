import { Bell, BellOff, Settings, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';

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
    if (!isSupported) return { text: 'Not Supported', color: 'bg-gray-500' };
    if (permission === 'granted') return { text: 'Enabled', color: 'bg-green-500' };
    if (permission === 'denied') return { text: 'Blocked', color: 'bg-red-500' };
    return { text: 'Not Requested', color: 'bg-yellow-500' };
  };

  const status = getPermissionStatus();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">Push Notifications</CardTitle>
        </div>
        <CardDescription>
          Stay updated with important business alerts and notifications
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isSupported && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <BellOff className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Push notifications are not supported in this browser
            </span>
          </div>
        )}

        {isSupported && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Status</span>
              </div>
              <Badge className={`${status.color} text-white`}>
                {status.text}
              </Badge>
            </div>

            {permission === 'denied' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  Notifications are blocked in your browser settings.
                  Please enable them in your browser preferences to receive push notifications.
                </p>
              </div>
            )}

            {permission === 'default' && (
              <Button
                onClick={handleEnableNotifications}
                disabled={isLoading}
                className="w-full"
              >
                <Bell className="h-4 w-4 mr-2" />
                {isLoading ? 'Enabling...' : 'Enable Notifications'}
              </Button>
            )}

            {permission === 'granted' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Push Notifications</span>
                  <Switch
                    checked={!!subscription}
                    onCheckedChange={(enabled) => {
                      if (enabled) {
                        subscribe();
                      } else {
                        unsubscribe();
                      }
                    }}
                    disabled={isLoading}
                  />
                </div>

                {subscription && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700">
                      ✓ Push notifications are enabled for this device
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Notification Types:</h4>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Sales Alerts</span>
                      <Switch defaultChecked />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Inventory Updates</span>
                      <Switch defaultChecked />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Customer Messages</span>
                      <Switch />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">System Updates</span>
                      <Switch />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Settings className="h-3 w-3" />
            <span>You can change these settings anytime in your browser preferences</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
