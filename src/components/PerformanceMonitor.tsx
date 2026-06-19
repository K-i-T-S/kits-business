import { AlertTriangle, TrendingUp, Clock, Cpu } from 'lucide-react';
import React, { useEffect, useRef, useState, type ReactNode } from 'react';

import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface PerformanceMetrics {
  renderTime: number;
  componentCount: number;
  reRenderCount: number;
  memoryUsage: number;
  lastUpdate: Date;
}

interface PerformanceMonitorProps {
  children: ReactNode;
  componentName?: string;
  enabled?: boolean;
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
}

export function PerformanceMonitor({
  children,
  componentName = 'Unknown',
  enabled = process.env.NODE_ENV === 'development',
  onMetricsUpdate,
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    componentCount: 0,
    reRenderCount: 0,
    memoryUsage: 0,
    lastUpdate: new Date(),
  });

  const renderStartTime = useRef<number>(0);
  const renderCount = useRef(0);
  const observerRef = useRef<PerformanceObserver | null>(null);

  useEffect(() => {
    if (!enabled) return;

    renderStartTime.current = performance.now();
    renderCount.current += 1;

    // Measure render time
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;

    // Get memory usage if available
    const memoryInfo = (performance as any).memory;
    const memoryUsage = memoryInfo ? memoryInfo.usedJSHeapSize : 0;

    // Count child components (rough estimate)
    const componentCount = React.Children.count(children);

    const newMetrics: PerformanceMetrics = {
      renderTime,
      componentCount,
      reRenderCount: renderCount.current,
      memoryUsage,
      lastUpdate: new Date(),
    };

    setMetrics(newMetrics);
    onMetricsUpdate?.(newMetrics);

    // Set up performance observer for long tasks
    if ('PerformanceObserver' in window) {
      observerRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.duration > 50) { // Log tasks taking longer than 50ms
            console.warn(`Long task detected in ${componentName}:`, {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            });
          }
        });
      });

      try {
        observerRef.current.observe({ entryTypes: ['longtask'] });
      } catch (_e) {
        // longtask might not be supported in all browsers
        console.debug('Long task observation not supported');
      }
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [children, componentName, enabled, onMetricsUpdate]);

  if (!enabled) return <>{children}</>;

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="w-80 shadow-lg border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Monitor
              <Badge variant="outline" className="text-xs">
                {componentName}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Render Time
              </div>
              <span className={`font-mono ${
                metrics.renderTime > 16 ? 'text-red-600' :
                  metrics.renderTime > 8 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {metrics.renderTime.toFixed(2)}ms
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <Cpu className="h-3 w-3" />
                Re-renders
              </div>
              <span className="font-mono">{metrics.reRenderCount}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>Components</div>
              <span className="font-mono">{metrics.componentCount}</span>
            </div>

            {metrics.memoryUsage > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div>Memory</div>
                <span className="font-mono">
                  {(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
                </span>
              </div>
            )}

            {metrics.renderTime > 16 && (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                Slow render detected
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Hook for performance monitoring
export function usePerformanceMonitor(componentName?: string) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const updateMetrics = React.useCallback((newMetrics: PerformanceMetrics) => {
    setMetrics(newMetrics);
  }, []);

  return { metrics, updateMetrics, componentName };
}

// Higher-order component for automatic performance monitoring
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string,
) {
  const WrappedComponent = (props: P) => (
    <PerformanceMonitor componentName={componentName || Component.name}>
      <Component {...props} />
    </PerformanceMonitor>
  );

  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
