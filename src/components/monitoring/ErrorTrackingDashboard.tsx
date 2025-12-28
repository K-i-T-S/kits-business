import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AlertTriangle, Bug, Clock, Filter, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { sentryService } from '../../services/sentryService';

interface ErrorEvent {
  id: string;
  message: string;
  level: 'error' | 'warning' | 'info';
  timestamp: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  environment: string;
  platform: string;
  tags: Record<string, string>;
  context: Record<string, any>;
}

interface ErrorStats {
  totalErrors: number;
  criticalErrors: number;
  warnings: number;
  info: number;
  errorRate: number;
  trends: {
    errors: number;
    warnings: number;
    info: number;
  };
}

export default function ErrorTrackingDashboard() {
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  const fetchErrors = async () => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would call your monitoring API
      // For now, we'll simulate with mock data
      const mockErrors: ErrorEvent[] = [
        {
          id: '1',
          message: 'Failed to load user data',
          level: 'error',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          count: 3,
          firstSeen: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          lastSeen: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          environment: 'production',
          platform: 'web',
          tags: { component: 'UserProfile', route: '/dashboard' },
          context: { userId: '123', userAgent: 'Mozilla/5.0...' }
        },
        {
          id: '2',
          message: 'API request timeout',
          level: 'warning',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          count: 7,
          firstSeen: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          lastSeen: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          environment: 'production',
          platform: 'web',
          tags: { endpoint: '/api/inventory', method: 'GET' },
          context: { timeout: 5000, retryCount: 2 }
        },
        {
          id: '3',
          message: 'Database connection pool exhausted',
          level: 'error',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          count: 12,
          firstSeen: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          lastSeen: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          environment: 'production',
          platform: 'server',
          tags: { service: 'database', pool: 'primary' },
          context: { activeConnections: 100, maxConnections: 100 }
        }
      ];

      const mockStats: ErrorStats = {
        totalErrors: 22,
        criticalErrors: 15,
        warnings: 7,
        info: 0,
        errorRate: 0.8,
        trends: {
          errors: 5,
          warnings: -2,
          info: 0
        }
      };

      setErrors(mockErrors);
      setStats(mockStats);
      
      sentryService.captureUserAction('Error tracking dashboard viewed', {
        errorCount: mockErrors.length,
        timeRange,
        filterLevel: selectedLevel
      });
    } catch (error) {
      sentryService.captureException(error as Error, { operation: 'fetch-errors' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [selectedLevel, timeRange]);

  const getLevelIcon = (level: ErrorEvent['level']) => {
    switch (level) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Bug className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: ErrorEvent['level']) => {
    const variants = {
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800',
    };

    return (
      <Badge className={variants[level]}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const filteredErrors = errors.filter(error => 
    selectedLevel === 'all' || error.level === selectedLevel
  );

  const exportErrors = () => {
    const csv = [
      ['ID', 'Message', 'Level', 'Count', 'First Seen', 'Last Seen', 'Environment'],
      ...filteredErrors.map(error => [
        error.id,
        error.message,
        error.level,
        error.count,
        error.firstSeen,
        error.lastSeen,
        error.environment
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `errors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    sentryService.captureUserAction('Error data exported', {
      recordCount: filteredErrors.length,
      format: 'csv'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Error Tracking</h2>
          <p className="text-muted-foreground">
            Monitor and analyze application errors
          </p>
        </div>
        
        <Button variant="outline" onClick={exportErrors}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Error Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalErrors}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getTrendIcon(stats.trends.errors)}
                <span className="ml-1">{Math.abs(stats.trends.errors)} from yesterday</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.criticalErrors}</div>
              <div className="text-xs text-muted-foreground">
                {((stats.criticalErrors / stats.totalErrors) * 100).toFixed(1)}% of total
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.warnings}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {getTrendIcon(stats.trends.warnings)}
                <span className="ml-1">{Math.abs(stats.trends.warnings)} from yesterday</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats.errorRate * 100).toFixed(2)}%</div>
              <div className="text-xs text-muted-foreground">
                Last 24 hours
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Level</label>
              <div className="flex space-x-2">
                {(['all', 'error', 'warning', 'info'] as const).map(level => (
                  <Button
                    key={level}
                    variant={selectedLevel === level ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLevel(level)}
                  >
                    {level.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Time Range</label>
              <div className="flex space-x-2">
                {(['1h', '24h', '7d', '30d'] as const).map(range => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
          <CardDescription>
            Showing {filteredErrors.length} of {errors.length} errors
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading errors...</p>
            </div>
          ) : filteredErrors.length === 0 ? (
            <div className="text-center py-8">
              <Bug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No errors found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredErrors.map(error => (
                <div key={error.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getLevelIcon(error.level)}
                      <span className="font-medium">{error.message}</span>
                      {getLevelBadge(error.level)}
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{new Date(error.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Count:</span> {error.count}
                    </div>
                    <div>
                      <span className="font-medium">Environment:</span> {error.environment}
                    </div>
                    <div>
                      <span className="font-medium">Platform:</span> {error.platform}
                    </div>
                    <div>
                      <span className="font-medium">First Seen:</span> {new Date(error.firstSeen).toLocaleDateString()}
                    </div>
                  </div>

                  {error.tags && Object.keys(error.tags).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(error.tags).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
