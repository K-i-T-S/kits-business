import { sentryService } from '../services/sentryService';

// Performance monitoring utilities for comprehensive performance tracking
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();
  private static observers: PerformanceObserver[] = [];

  // Initialize performance monitoring
  static initialize(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      this.setupWebVitalsMonitoring();
      this.setupResourceMonitoring();
      this.setupLongTaskMonitoring();
    }
  }

  // Monitor Web Vitals
  private static setupWebVitalsMonitoring(): void {
    // Largest Contentful Paint (LCP)
    this.observePerformanceEntry('largest-contentful-paint', (entries) => {
      const lcp = entries[entries.length - 1] as any;
      if (lcp) {
        this.recordMetric('LCP', lcp.startTime);
        sentryService.capturePerformanceMetric('LCP', lcp.startTime, 'ms');
      }
    });

    // First Input Delay (FID)
    this.observePerformanceEntry('first-input', (entries) => {
      const fid = entries[entries.length - 1] as any;
      if (fid && fid.processingStart) {
        this.recordMetric('FID', fid.processingStart - fid.startTime);
        sentryService.capturePerformanceMetric('FID', fid.processingStart - fid.startTime, 'ms');
      }
    });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    this.observePerformanceEntry('layout-shift', (entries) => {
      entries.forEach((entry) => {
        const layoutShift = entry as any;
        if (!layoutShift.hadRecentInput && layoutShift.value) {
          clsValue += layoutShift.value;
        }
      });
      this.recordMetric('CLS', clsValue);
      sentryService.capturePerformanceMetric('CLS', clsValue, 'score');
    });
  }

  // Monitor resource loading
  private static setupResourceMonitoring(): void {
    this.observePerformanceEntry('resource', (entries) => {
      entries.forEach((entry) => {
        const resource = entry as PerformanceResourceTiming;
        const loadTime = resource.responseEnd - resource.startTime;
        
        this.recordMetric(`resource-${resource.name}`, loadTime);
        
        // Alert on slow resources
        if (loadTime > 3000) {
          sentryService.captureMessage(`Slow resource detected: ${resource.name}`, 'warning', {
            loadTime,
            resourceType: resource.initiatorType,
            size: resource.transferSize,
          });
        }
      });
    });
  }

  // Monitor long tasks
  private static setupLongTaskMonitoring(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            const duration = entry.duration;
            this.recordMetric('long-task', duration);
            
            // Alert on very long tasks
            if (duration > 100) {
              sentryService.captureMessage(`Long task detected: ${duration}ms`, 'warning', {
                duration,
                name: entry.name,
                startTime: entry.startTime,
              });
            }
          });
        });
        
        observer.observe({ entryTypes: ['longtask'] });
        this.observers.push(observer);
      } catch (e) {
        console.warn('Long task monitoring not supported');
      }
    }
  }

  // Generic performance observer
  private static observePerformanceEntry(type: string, callback: (entries: PerformanceEntry[]) => void): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          callback(list.getEntries());
        });
        
        observer.observe({ entryTypes: [type] });
        this.observers.push(observer);
      } catch (e) {
        console.warn(`Performance entry type ${type} not supported`);
      }
    }
  }

  // Record a custom metric
  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
    
    // Keep only last 100 values to prevent memory leaks
    const values = this.metrics.get(name)!;
    if (values.length > 100) {
      values.shift();
    }
  }

  // Get metric statistics
  static getMetricStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;
    
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { avg, min, max, count: values.length };
  }

  // Measure function execution time
  static measureFunction<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      sentryService.capturePerformanceMetric(name, duration, 'ms');
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}-error`, duration);
      sentryService.capturePerformanceMetric(`${name}-error`, duration, 'ms');
      sentryService.captureException(error as Error, { operation: name, duration });
      throw error;
    }
  }

  // Measure async function execution time
  static async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      sentryService.capturePerformanceMetric(name, duration, 'ms');
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}-error`, duration);
      sentryService.capturePerformanceMetric(`${name}-error`, duration, 'ms');
      sentryService.captureException(error as Error, { operation: name, duration });
      throw error;
    }
  }

  // Monitor React component render performance
  static measureComponentRender(componentName: string): () => void {
    const start = performance.now();
    sentryService.addBreadcrumb({
      category: 'render',
      message: `${componentName} render started`,
      level: 'info',
    });

    return () => {
      const duration = performance.now() - start;
      this.recordMetric(`render-${componentName}`, duration);
      sentryService.capturePerformanceMetric(`render-${componentName}`, duration, 'ms');
      
      if (duration > 100) {
        sentryService.captureMessage(`Slow render detected: ${componentName}`, 'warning', {
          component: componentName,
          duration,
        });
      }
    };
  }

  // Monitor user interaction performance
  static measureInteraction(interactionName: string): () => void {
    const start = performance.now();
    sentryService.addBreadcrumb({
      category: 'ui',
      message: `${interactionName} interaction started`,
      level: 'info',
    });

    return () => {
      const duration = performance.now() - start;
      this.recordMetric(`interaction-${interactionName}`, duration);
      sentryService.capturePerformanceMetric(`interaction-${interactionName}`, duration, 'ms');
      
      if (duration > 200) {
        sentryService.captureMessage(`Slow interaction detected: ${interactionName}`, 'warning', {
          interaction: interactionName,
          duration,
        });
      }
    };
  }

  // Memory monitoring
  static checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMemory = memory.usedJSHeapSize / 1024 / 1024; // MB
      const totalMemory = memory.totalJSHeapSize / 1024 / 1024; // MB
      
      this.recordMetric('memory-used', usedMemory);
      this.recordMetric('memory-total', totalMemory);
      
      sentryService.capturePerformanceMetric('memory-used', usedMemory, 'MB');
      sentryService.capturePerformanceMetric('memory-total', totalMemory, 'MB');
      
      // Alert on high memory usage
      if (usedMemory > 100) {
        sentryService.captureMessage('High memory usage detected', 'warning', {
          usedMemory,
          totalMemory,
          percentage: (usedMemory / totalMemory) * 100,
        });
      }
    }
  }

  // Network performance monitoring
  static monitorNetworkRequest(url: string, method: string): () => void {
    const start = performance.now();
    sentryService.addBreadcrumb({
      category: 'http',
      message: `${method} ${url} started`,
      level: 'info',
      data: { url, method },
    });

    return (statusCode?: number) => {
      const duration = performance.now() - start;
      this.recordMetric(`network-${method}-${url}`, duration);
      sentryService.captureApiCall(url, method, statusCode || 0, duration);
      
      if (duration > 5000) {
        sentryService.captureMessage(`Slow network request: ${method} ${url}`, 'warning', {
          url,
          method,
          duration,
          statusCode,
        });
      }
    };
  }

  // Get performance report
  static getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    for (const [name, values] of this.metrics.entries()) {
      const stats = this.getMetricStats(name);
      if (stats) {
        report[name] = stats;
      }
    }
    
    return report;
  }

  // Cleanup observers
  static cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  return {
    measureFunction: PerformanceMonitor.measureFunction.bind(PerformanceMonitor),
    measureAsyncFunction: PerformanceMonitor.measureAsyncFunction.bind(PerformanceMonitor),
    measureComponentRender: PerformanceMonitor.measureComponentRender.bind(PerformanceMonitor),
    measureInteraction: PerformanceMonitor.measureInteraction.bind(PerformanceMonitor),
    recordMetric: PerformanceMonitor.recordMetric.bind(PerformanceMonitor),
    getMetricStats: PerformanceMonitor.getMetricStats.bind(PerformanceMonitor),
    checkMemoryUsage: PerformanceMonitor.checkMemoryUsage.bind(PerformanceMonitor),
    monitorNetworkRequest: PerformanceMonitor.monitorNetworkRequest.bind(PerformanceMonitor),
    getPerformanceReport: PerformanceMonitor.getPerformanceReport.bind(PerformanceMonitor),
  };
};

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  PerformanceMonitor.initialize();
  
  // Check memory usage every 30 seconds
  setInterval(() => {
    PerformanceMonitor.checkMemoryUsage();
  }, 30000);
}
