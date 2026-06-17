import { Activity, Clock, Zap, Monitor, Globe, Database, RefreshCw } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface WebVital {
  name: string;
  value: number | null;
  unit: string;
  threshold: number;
  description: string;
}

function getStatus(value: number | null, threshold: number): 'good' | 'warning' | 'unknown' {
  if (value === null) return 'unknown';
  return value <= threshold ? 'good' : 'warning';
}

const STATUS_BADGE: Record<'good' | 'warning' | 'unknown', string> = {
  good: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  unknown: 'bg-slate-200 text-slate-600',
};

export default function PerformanceDashboard() {
  const [vitals, setVitals] = useState<WebVital[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const collectVitals = useCallback(() => {
    setIsLoading(true);

    const collected: WebVital[] = [
      {
        name: 'Largest Contentful Paint',
        value: null,
        unit: 's',
        threshold: 2.5,
        description: 'Time until the largest visible element renders. Target: < 2.5s.',
      },
      {
        name: 'First Contentful Paint',
        value: null,
        unit: 's',
        threshold: 1.8,
        description: 'Time until first content is painted. Target: < 1.8s.',
      },
      {
        name: 'Cumulative Layout Shift',
        value: null,
        unit: '',
        threshold: 0.1,
        description: 'Visual stability score. Target: < 0.1.',
      },
      {
        name: 'Time to First Byte',
        value: null,
        unit: 'ms',
        threshold: 600,
        description: 'Server response time. Target: < 600ms.',
      },
    ];

    // Try to read from browser Performance API
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (navEntry) {
        // TTFB
        const ttfbIdx = collected.findIndex(v => v.name === 'Time to First Byte');
        if (ttfbIdx >= 0) collected[ttfbIdx]!.value = Math.round(navEntry.responseStart - navEntry.requestStart);

        // FCP from paint entries
        const paintEntries = performance.getEntriesByName('first-contentful-paint');
        if (paintEntries.length > 0) {
          const fcpIdx = collected.findIndex(v => v.name === 'First Contentful Paint');
          if (fcpIdx >= 0) collected[fcpIdx]!.value = parseFloat((paintEntries[0]!.startTime / 1000).toFixed(2));
        }
      }

      // LCP from PerformanceObserver — read buffered if available
      try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          const last = lcpEntries[lcpEntries.length - 1] as PerformanceEntry & { startTime: number };
          const lcpIdx = collected.findIndex(v => v.name === 'Largest Contentful Paint');
          if (lcpIdx >= 0) collected[lcpIdx]!.value = parseFloat((last.startTime / 1000).toFixed(2));
        }
      } catch {
        // Not available in this browser
      }

      // CLS from layout-shift entries
      try {
        let cls = 0;
        performance.getEntriesByType('layout-shift').forEach((entry) => {
          const ls = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!ls.hadRecentInput) cls += ls.value;
        });
        if (cls > 0) {
          const clsIdx = collected.findIndex(v => v.name === 'Cumulative Layout Shift');
          if (clsIdx >= 0) collected[clsIdx]!.value = parseFloat(cls.toFixed(4));
        }
      } catch {
        // Not available
      }
    }

    setVitals(collected);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    collectVitals();
  }, [collectVitals]);

  const icons: Record<string, React.ReactNode> = {
    'Largest Contentful Paint': <Zap className="h-4 w-4" />,
    'First Contentful Paint': <Globe className="h-4 w-4" />,
    'Cumulative Layout Shift': <Activity className="h-4 w-4" />,
    'Time to First Byte': <Database className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Monitoring</h2>
          <p className="text-muted-foreground">Real browser Web Vitals for this session</p>
        </div>
        <Button variant="outline" size="sm" onClick={collectVitals} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Web Vitals */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Monitor className="h-5 w-5" />
          <span>Core Web Vitals</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vitals.map((vital) => {
            const status = getStatus(vital.value, vital.threshold);
            return (
              <Card key={vital.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      {icons[vital.name] ?? <Clock className="h-4 w-4" />}
                      <span>{vital.name}</span>
                    </div>
                    <Badge className={STATUS_BADGE[status]}>
                      {status === 'unknown' ? 'N/A' : status.toUpperCase()}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-100">
                    {vital.value !== null ? `${vital.value}${vital.unit}` : '—'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{vital.description}</p>
                  {vital.value === null && (
                    <p className="text-xs text-muted-foreground mt-1 italic">Not yet available for this session</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Infrastructure note */}
      <Card className="border-blue-500/30 bg-blue-500/10">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-200">
            <strong>Note:</strong> Infrastructure metrics (CPU, memory, server response times) are not available in a client-side SPA.
            For server-level monitoring, integrate with Supabase's built-in observability tools or a service like Datadog.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
