import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Activity, Database, Globe, Server } from 'lucide-react';
import { sentryService } from '../../services/sentryService';

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

interface ServiceHealth {
  api: HealthStatus;
  database: HealthStatus;
  auth: HealthStatus;
  storage: HealthStatus;
  cdn: HealthStatus;
}

export default function HealthCheckDashboard() {
  const [healthData, setHealthData] = useState<ServiceHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const checkHealth = async () => {
    try {
      setIsLoading(true);
      
      // Check API health
      const apiHealth = await checkApiHealth();
      
      // Check database health
      const dbHealth = await checkDatabaseHealth();
      
      // Check auth service health
      const authHealth = await checkAuthHealth();
      
      // Check storage health
      const storageHealth = await checkStorageHealth();
      
      // Check CDN health
      const cdnHealth = await checkCdnHealth();

      setHealthData({
        api: apiHealth,
        database: dbHealth,
        auth: authHealth,
        storage: storageHealth,
        cdn: cdnHealth,
      });
      
      setLastCheck(new Date());
      
      sentryService.captureUserAction('Health check performed', {
        timestamp: new Date().toISOString(),
        results: {
          api: apiHealth.status,
          database: dbHealth.status,
          auth: authHealth.status,
          storage: storageHealth.status,
          cdn: cdnHealth.status,
        }
      });
    } catch (error) {
      sentryService.captureException(error as Error, { operation: 'health-check' });
    } finally {
      setIsLoading(false);
    }
  };

  const checkApiHealth = async (): Promise<HealthStatus> => {
    const start = performance.now();
    
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      const duration = performance.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: duration < 1000 ? 'healthy' : 'warning',
          message: `API responding (${Math.round(duration)}ms)`,
          timestamp: new Date().toISOString(),
          details: { responseTime: duration, ...data }
        };
      } else {
        return {
          status: 'critical',
          message: `API returned ${response.status}`,
          timestamp: new Date().toISOString(),
          details: { statusCode: response.status, responseTime: duration }
        };
      }
    } catch (error) {
      return {
        status: 'critical',
        message: 'API unreachable',
        timestamp: new Date().toISOString(),
        details: { error: (error as Error).message }
      };
    }
  };

  const checkDatabaseHealth = async (): Promise<HealthStatus> => {
    const start = performance.now();
    
    try {
      // Simple database connectivity check
      const response = await fetch('/api/health/database', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      
      const duration = performance.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: data.responseTime < 500 ? 'healthy' : 'warning',
          message: `Database connected (${Math.round(data.responseTime)}ms)`,
          timestamp: new Date().toISOString(),
          details: data
        };
      } else {
        return {
          status: 'critical',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
          details: { statusCode: response.status }
        };
      }
    } catch (error) {
      return {
        status: 'critical',
        message: 'Database unreachable',
        timestamp: new Date().toISOString(),
        details: { error: (error as Error).message }
      };
    }
  };

  const checkAuthHealth = async (): Promise<HealthStatus> => {
    const start = performance.now();
    
    try {
      // Check auth service by attempting to get current session
      const response = await fetch('/api/health/auth', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      
      const duration = performance.now() - start;
      
      if (response.ok) {
        return {
          status: duration < 800 ? 'healthy' : 'warning',
          message: `Auth service active (${Math.round(duration)}ms)`,
          timestamp: new Date().toISOString(),
          details: { responseTime: duration }
        };
      } else {
        return {
          status: 'warning',
          message: 'Auth service degraded',
          timestamp: new Date().toISOString(),
          details: { statusCode: response.status }
        };
      }
    } catch (error) {
      return {
        status: 'critical',
        message: 'Auth service down',
        timestamp: new Date().toISOString(),
        details: { error: (error as Error).message }
      };
    }
  };

  const checkStorageHealth = async (): Promise<HealthStatus> => {
    const start = performance.now();
    
    try {
      const response = await fetch('/api/health/storage', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      const duration = performance.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: duration < 2000 ? 'healthy' : 'warning',
          message: `Storage operational (${Math.round(duration)}ms)`,
          timestamp: new Date().toISOString(),
          details: { responseTime: duration, ...data }
        };
      } else {
        return {
          status: 'critical',
          message: 'Storage service error',
          timestamp: new Date().toISOString(),
          details: { statusCode: response.status }
        };
      }
    } catch (error) {
      return {
        status: 'warning',
        message: 'Storage service unreachable',
        timestamp: new Date().toISOString(),
        details: { error: (error as Error).message }
      };
    }
  };

  const checkCdnHealth = async (): Promise<HealthStatus> => {
    const start = performance.now();
    
    try {
      // Check CDN by loading a small static asset
      const response = await fetch('/static/health-check.json', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      
      const duration = performance.now() - start;
      
      if (response.ok) {
        return {
          status: duration < 500 ? 'healthy' : 'warning',
          message: `CDN active (${Math.round(duration)}ms)`,
          timestamp: new Date().toISOString(),
          details: { responseTime: duration }
        };
      } else {
        return {
          status: 'warning',
          message: 'CDN degraded',
          timestamp: new Date().toISOString(),
          details: { statusCode: response.status }
        };
      }
    } catch (error) {
      return {
        status: 'warning',
        message: 'CDN unreachable',
        timestamp: new Date().toISOString(),
        details: { error: (error as Error).message }
      };
    }
  };

  useEffect(() => {
    checkHealth();
    
    if (isAutoRefresh) {
      const interval = setInterval(checkHealth, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isAutoRefresh]);

  const getStatusIcon = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: HealthStatus['status']) => {
    const variants = {
      healthy: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getServiceIcon = (service: keyof ServiceHealth) => {
    const icons = {
      api: <Server className="h-5 w-5" />,
      database: <Database className="h-5 w-5" />,
      auth: <Activity className="h-5 w-5" />,
      storage: <Database className="h-5 w-5" />,
      cdn: <Globe className="h-5 w-5" />,
    };

    return icons[service];
  };

  const getOverallStatus = () => {
    if (!healthData) return 'warning';
    
    const statuses = Object.values(healthData).map(s => s.status);
    
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Health</h2>
          <p className="text-muted-foreground">
            Last checked: {lastCheck.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
          >
            <Clock className="h-4 w-4 mr-2" />
            Auto-refresh: {isAutoRefresh ? 'On' : 'Off'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={checkHealth}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {getStatusIcon(getOverallStatus())}
            <span>Overall System Status</span>
            {getStatusBadge(getOverallStatus())}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {getOverallStatus() === 'healthy' && 'All systems are operating normally.'}
            {getOverallStatus() === 'warning' && 'Some systems are experiencing issues.'}
            {getOverallStatus() === 'critical' && 'Critical systems are down.'}
          </p>
        </CardContent>
      </Card>

      {/* Service Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthData && Object.entries(healthData).map(([service, health]) => (
          <Card key={service}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center space-x-2">
                  {getServiceIcon(service as keyof ServiceHealth)}
                  <span className="capitalize">{service}</span>
                </div>
                {getStatusBadge(health.status)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(health.status)}
                  <span className="text-sm">{health.message}</span>
                </div>
                
                {health.details && (
                  <div className="text-xs text-muted-foreground">
                    {Object.entries(health.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key}:</span>
                        <span>
                          {typeof value === 'number' && key.includes('time') 
                            ? `${Math.round(Number(value))}ms`
                            : String(value)
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Checking system health...</p>
        </div>
      )}
    </div>
  );
}
