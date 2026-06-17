import { Bug, CheckCircle, AlertTriangle } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface CaughtError {
  id: number;
  message: string;
  source: string;
  timestamp: Date;
}

export default function ErrorTrackingDashboard() {
  const [errors, setErrors] = useState<CaughtError[]>([]);

  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      setErrors(prev => [
        {
          id: Date.now(),
          message: event.message ?? 'Unknown error',
          source: event.filename ? `${event.filename}:${event.lineno}` : 'unknown',
          timestamp: new Date(),
        },
        ...prev.slice(0, 49),
      ]);
    };

    const unhandledHandler = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
      setErrors(prev => [
        {
          id: Date.now(),
          message,
          source: 'unhandled promise rejection',
          timestamp: new Date(),
        },
        ...prev.slice(0, 49),
      ]);
    };

    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', unhandledHandler);
    return () => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', unhandledHandler);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Error Tracking</h2>
        <p className="text-muted-foreground">Runtime errors captured in this browser session</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Session Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${errors.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {errors.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">Browser</div>
            <p className="text-xs text-muted-foreground">window.onerror + unhandledrejection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Active</div>
            <p className="text-xs text-muted-foreground">Listening for runtime errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Error List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Session Error Log
          </CardTitle>
          <CardDescription>
            Errors captured since this page was loaded. Resets on refresh.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="font-medium">No errors captured</p>
              <p className="text-sm text-muted-foreground mt-1">
                The app is running cleanly this session.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {errors.map((error) => (
                <div key={error.id} className="border rounded-lg p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <span className="font-medium text-sm">{error.message}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">{error.source}</p>
                  <p className="text-xs text-muted-foreground ml-6">{error.timestamp.toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-blue-500/30 bg-blue-500/10">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-200">
            <strong>Production monitoring:</strong> For persistent cross-session error tracking, integrate Sentry
            or a similar service. Contact KiTS for implementation support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
