import { AlertCircle, CheckCircle, Clock, RefreshCw, Activity, Database, Server } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { supabase } from '../../utils/supabaseClient';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type HealthStatus = 'healthy' | 'warning' | 'critical';

interface ServiceHealth {
  status: HealthStatus;
  message: string;
  responseTime?: number;
}

interface AllHealth {
  database: ServiceHealth;
  auth: ServiceHealth;
  app: ServiceHealth;
}

const statusIcon = (status: HealthStatus) => {
  if (status === 'healthy') return <CheckCircle className="h-5 w-5 text-green-500" />;
  if (status === 'warning') return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  return <AlertCircle className="h-5 w-5 text-red-500" />;
};

const statusBadge = (status: HealthStatus) => {
  const cls: Record<HealthStatus, string> = {
    healthy: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  };
  return <Badge className={cls[status]}>{status.toUpperCase()}</Badge>;
};

export default function HealthCheckDashboard() {
  const [healthData, setHealthData] = useState<AllHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      // Database health — do a cheap query
      const dbStart = performance.now();
      const { error: dbError } = await supabase.from('products').select('id').limit(1);
      const dbTime = Math.round(performance.now() - dbStart);

      const dbHealth: ServiceHealth = dbError
        ? { status: 'critical', message: 'Database unreachable', responseTime: dbTime }
        : { status: dbTime < 1000 ? 'healthy' : 'warning', message: `Responding (${dbTime}ms)`, responseTime: dbTime };

      // Auth health — check session
      const authStart = performance.now();
      const { error: authError } = await supabase.auth.getSession();
      const authTime = Math.round(performance.now() - authStart);

      const authHealth: ServiceHealth = authError
        ? { status: 'warning', message: 'Auth service degraded', responseTime: authTime }
        : { status: authTime < 800 ? 'healthy' : 'warning', message: `Active (${authTime}ms)`, responseTime: authTime };

      // App health — always healthy if we're running
      const appHealth: ServiceHealth = {
        status: 'healthy',
        message: 'React SPA running normally',
      };

      setHealthData({ database: dbHealth, auth: authHealth, app: appHealth });
      setLastCheck(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    if (isAutoRefresh) {
      const interval = setInterval(checkHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [checkHealth, isAutoRefresh]);

  const getOverallStatus = (): HealthStatus => {
    if (!healthData) return 'warning';
    const statuses = Object.values(healthData).map(s => s.status);
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  };

  const services: { key: keyof AllHealth; label: string; icon: React.ReactNode }[] = [
    { key: 'database', label: 'Database (Supabase)', icon: <Database className="h-5 w-5" /> },
    { key: 'auth', label: 'Auth Service', icon: <Activity className="h-5 w-5" /> },
    { key: 'app', label: 'Application', icon: <Server className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Health</h2>
          <p className="text-muted-foreground">Last checked: {lastCheck.toLocaleTimeString()}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setIsAutoRefresh(!isAutoRefresh)}>
            <Clock className="h-4 w-4 me-2" />
            Auto-refresh: {isAutoRefresh ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={checkHealth} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 me-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {statusIcon(getOverallStatus())}
            <span>Overall System Status</span>
            {statusBadge(getOverallStatus())}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {getOverallStatus() === 'healthy' && 'All systems are operating normally.'}
            {getOverallStatus() === 'warning' && 'Some systems are experiencing issues.'}
            {getOverallStatus() === 'critical' && 'Critical systems require attention.'}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {services.map(({ key, label, icon }) => {
          const health = healthData?.[key];
          return (
            <Card key={key}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center space-x-2">
                    {icon}
                    <span>{label}</span>
                  </div>
                  {health ? statusBadge(health.status) : <Badge className="bg-slate-200 text-slate-600">CHECKING</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {health ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {statusIcon(health.status)}
                      <span className="text-sm">{health.message}</span>
                    </div>
                    {health.responseTime !== undefined && (
                      <p className="text-xs text-muted-foreground">Response time: {health.responseTime}ms</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Checking...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isLoading && !healthData && (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Checking system health...</p>
        </div>
      )}
    </div>
  );
}
