import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Download, Smartphone, X, Wifi, Shield, Zap, Star } from 'lucide-react'
import { usePWA } from '@/hooks/usePWA'
import { useState, useEffect } from 'react'

export function PWAInstallPrompt() {
  const { isInstallable, install, requestNotificationPermission } = usePWA()
  const [dismissed, setDismissed] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isInstallable && !dismissed) {
      setIsAnimating(true)
    }
  }, [isInstallable, dismissed])

  if (!isInstallable || dismissed) return null

  const handleInstall = async () => {
    setIsAnimating(false)
    const success = await install()
    if (success) {
      setDismissed(true)
    }
  }

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission()
    setNotificationsEnabled(granted)
  }

  const handleDismiss = () => {
    setIsAnimating(false)
    setTimeout(() => setDismissed(true), 300)
  }

  return (
    <div className={`fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96 z-40 transition-all duration-500 ease-out ${
      isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    }`}>
      <Card className="bg-gray-900/98 backdrop-blur-xl border-gray-700/30 shadow-2xl overflow-hidden">
        {/* Gradient Header */}
        <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 animate-gradient" />
        
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="p-3 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl border border-blue-600/30">
                  <Smartphone className="h-6 w-6 text-blue-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
                  <Star className="h-2 w-2 text-white" />
                </div>
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-white">
                  Install Business Terminal
                </CardTitle>
                <CardDescription className="text-sm text-gray-400">
                  Professional management on your device
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all duration-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-4">
          {/* Feature Highlights */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-2 p-3 bg-gray-800/30 rounded-xl">
              <Wifi className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-gray-300 text-center">Works Offline</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 bg-gray-800/30 rounded-xl">
              <Zap className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-gray-300 text-center">Lightning Fast</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 bg-gray-800/30 rounded-xl">
              <Shield className="h-4 w-4 text-green-400" />
              <span className="text-xs text-gray-300 text-center">Secure</span>
            </div>
          </div>

          {/* Benefits List */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-1 h-1 bg-blue-400 rounded-full" />
              <span>Instant access from your home screen</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-1 h-1 bg-blue-400 rounded-full" />
              <span>Push notifications for important updates</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-1 h-1 bg-blue-400 rounded-full" />
              <span>Offline mode for uninterrupted workflow</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleInstall}
              size="sm"
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg transition-all duration-200 active:scale-95"
            >
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
            {!notificationsEnabled && (
              <Button
                onClick={handleEnableNotifications}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 transition-all duration-200 active:scale-95"
              >
                <Wifi className="h-4 w-4 mr-1" />
                Enable
              </Button>
            )}
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-4 pt-2 border-t border-gray-800/30">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Shield className="h-3 w-3" />
              <span>Trusted</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Star className="h-3 w-3" />
              <span>4.8 Rating</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Download className="h-3 w-3" />
              <span>1K+ Installs</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
