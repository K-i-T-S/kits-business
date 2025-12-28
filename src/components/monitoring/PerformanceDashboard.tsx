import {
  Activity,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Monitor,
  Globe,
  Database,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { sentryService } from '../../services/sentryService';
import { usePerformanceMonitor } from '../../utils/performanceMonitor';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
  trend: number;
  history: number[];
}

interface WebVitals {
  lcp: PerformanceMetric;
  fid: PerformanceMetric;
  cls: PerformanceMetric;
  fcp: PerformanceMetric;
  ttfb: PerformanceMetric;
}

interface ResourceMetrics {
  apiResponseTime: PerformanceMetric;
  databaseQueryTime: PerformanceMetric;
  assetLoadTime: PerformanceMetric;
  bundleSize: PerformanceMetric;
}

export default function PerformanceDashboard() {
  const [webVitals, setWebVitals] = useState<WebVitals | null>(null);
  const [resourceMetrics, setResourceMetrics] = useState<ResourceMetrics | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const { getPerformanceReport } = usePerformanceMonitor();

  const fetchPerformanceData = async () => {
    try {
      setIsLoading(true);

      // Get performance report from our monitor
      const performanceReport = getPerformanceReport();

      // Mock Web Vitals data (in production, this would come from real monitoring)
      const mockWebVitals: WebVitals = {
        lcp: {
          name: 'Largest Contentful Paint',
          value: 2.1,
          unit: 's',
          threshold: 2.5,
          status: 'good',
          trend: -0.2,
          history: [2.3, 2.5, 2.2, 2.1],
        },
        fid: {
          name: 'First Input Delay',
          value: 85,
          unit: 'ms',
          threshold: 100,
          status: 'good',
          trend: -15,
          history: [100, 95, 90, 85],
        },
        cls: {
          name: 'Cumulative Layout Shift',
          value: 0.08,
          unit: 'score',
          threshold: 0.1,
          status: 'good',
          trend: -0.02,
          history: [0.1, 0.09, 0.085, 0.08],
        },
        fcp: {
          name: 'First Contentful Paint',
          value: 1.2,
          unit: 's',
          threshold: 1.8,
          status: 'good',
          trend: -0.3,
          history: [1.5, 1.4, 1.3, 1.2],
        },
        ttfb: {
          name: 'Time to First Byte',
          value: 180,
          unit: 'ms',
          threshold: 600,
          status: 'good',
          trend: -20,
          history: [200, 190, 185, 180],
        },
      };

      // Mock Resource Metrics
      const mockResourceMetrics: ResourceMetrics = {
        apiResponseTime: {
          name: 'API Response Time',
          value: 245,
          unit: 'ms',
          threshold: 500,
          status: 'good',
          trend: -55,
          history: [300, 280, 260, 245],
        },
        databaseQueryTime: {
          name: 'Database Query Time',
          value: 120,
          unit: 'ms',
          threshold: 200,
          status: 'good',
          trend: -30,
          history: [150, 140, 130, 120],
        },
        assetLoadTime: {
          name: 'Asset Load Time',
          value: 850,
          unit: 'ms',
          threshold: 1000,
          status: 'good',
          trend: -150,
          history: [1000, 950, 900, 850],
        },
        bundleSize: {
          name: 'JavaScript Bundle Size',
          value: 245,
          unit: 'KB',
          threshold: 500,
          status: 'good',
          trend: 5,
          history: [240, 242, 243, 245],
        },
      };

      // Mock System Metrics
      const mockSystemMetrics: PerformanceMetric[] = [
        {
          name: 'CPU Usage',
          value: 35,
          unit: '%',
          threshold: 80,
          status: 'good',
          trend: 5,
          history: [30, 32, 33, 35],
        },
        {
          name: 'Memory Usage',
          value: 68,
          unit: '%',
          threshold: 85,
          status: 'good',
          trend: 8,
          history: [60, 62, 65, 68],
        },
        {
          name: 'Network Latency',
          value: 45,
          unit: 'ms',
          threshold: 100,
          status: 'good',
          trend: -5,
          history: [50, 48, 47, 45],
        },
        {
          name: 'Error Rate',
          value: 0.2,
          unit: '%',
          threshold: 1,
          status: 'good',
          trend: -0.1,
          history: [0.3, 0.25, 0.22, 0.2],
        },
      ];

      setWebVitals(mockWebVitals);
      setResourceMetrics(mockResourceMetrics);
      setSystemMetrics(mockSystemMetrics);

      sentryService.captureUserAction('Performance dashboard viewed', {
        timeRange,
        metricsCount: Object.keys(mockWebVitals).length + Object.keys(mockResourceMetrics).length + mockSystemMetrics.length,
      });
    } catch (error) {
      sentryService.captureException(error as Error, { operation: 'fetch-performance-data' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, [timeRange]);

  const getStatusColor = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
    }
  };

  const getStatusBadge = (status: PerformanceMetric['status']) => {
    const variants = {
      good: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
  };

  const formatValue = (metric: PerformanceMetric) => {
    return `${metric.value}${metric.unit}`;
  };

  const exportPerformanceData = () => {
    const data = [
      ['Metric', 'Value', 'Unit', 'Status', 'Threshold', 'Trend'],
      ...(webVitals ? Object.values(webVitals).map(vital => [
        vital.name,
        vital.value,
        vital.unit,
        vital.status,
        vital.threshold,
        vital.trend,
      ]) : []),
      ...(resourceMetrics ? Object.values(resourceMetrics).map(resource => [
        resource.name,
        resource.value,
        resource.unit,
        resource.status,
        resource.threshold,
        resource.trend,
      ]) : []),
      ...systemMetrics.map(metric => [
        metric.name,
        metric.value,
        metric.unit,
        metric.status,
        metric.threshold,
        metric.trend,
      ]),
    ];

    const csv = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    sentryService.captureUserAction('Performance data exported', {
      recordCount: data.length - 1,
      format: 'csv',
    });
  };

  const MetricCard = ({ metric, icon }: { metric: PerformanceMetric; icon: React.ReactNode }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            {icon}
            <span>{metric.name}</span>
          </div>
          {getStatusBadge(metric.status)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
            {formatValue(metric)}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Threshold: {metric.threshold}{metric.unit}</span>
            <div className="flex items-center space-x-1">
              {getTrendIcon(metric.trend)}
              <span>{Math.abs(metric.trend)}{metric.unit}</span>
            </div>
          </div>
          {metric.history && metric.history.length > 1 && (
            <div className="text-xs text-muted-foreground">
              Min: {Math.min(...metric.history)}{metric.unit} |
              Max: {Math.max(...metric.history)}{metric.unit}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Monitoring</h2>
          <p className="text-muted-foreground">
            Track application performance and user experience metrics
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPerformanceData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" onClick={exportPerformanceData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Time Range</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading performance data...</p>
        </div>
      ) : (
        <>
          {/* Web Vitals */}
          {webVitals && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <Monitor className="h-5 w-5" />
                <span>Core Web Vitals</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard metric={webVitals.lcp} icon={<Zap className="h-4 w-4" />} />
                <MetricCard metric={webVitals.fid} icon={<Clock className="h-4 w-4" />} />
                <MetricCard metric={webVitals.cls} icon={<Activity className="h-4 w-4" />} />
                <MetricCard metric={webVitals.fcp} icon={<Globe className="h-4 w-4" />} />
                <MetricCard metric={webVitals.ttfb} icon={<Database className="h-4 w-4" />} />
              </div>
            </div>
          )}

          {/* Resource Metrics */}
          {resourceMetrics && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Resource Performance</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard metric={resourceMetrics.apiResponseTime} icon={<Globe className="h-4 w-4" />} />
                <MetricCard metric={resourceMetrics.databaseQueryTime} icon={<Database className="h-4 w-4" />} />
                <MetricCard metric={resourceMetrics.assetLoadTime} icon={<Zap className="h-4 w-4" />} />
                <MetricCard metric={resourceMetrics.bundleSize} icon={<Activity className="h-4 w-4" />} />
              </div>
            </div>
          )}

          {/* System Metrics */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
              <Monitor className="h-5 w-5" />
              <span>System Metrics</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {systemMetrics.map((metric, index) => (
                <MetricCard
                  key={metric.name}
                  metric={metric}
                  icon={
                    index === 0 ? <Activity className="h-4 w-4" /> :
                      index === 1 ? <Monitor className="h-4 w-4" /> :
                        index === 2 ? <Globe className="h-4 w-4" /> :
                          <Zap className="h-4 w-4" />
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
