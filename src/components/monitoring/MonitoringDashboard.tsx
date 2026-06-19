import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  DollarSign,
  Package,
  RefreshCw,
  Server,
  Users,
  Zap,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';

import { supabase } from '../../utils/supabaseClient';
import Layout from '../Layout';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

import HealthCheckDashboard from './HealthCheckDashboard';
import PerformanceDashboard from './PerformanceDashboard';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SummaryStats {
  todayRevenue: number;
  activeAlerts: number;
  avgLatencyMs: number;
  lowStockCount: number;
  activeSessions: number;
  latencyStatus: 'green' | 'yellow' | 'red';
}

interface HourlySalePoint {
  hour: string;
  revenue: number;
  count: number;
}

interface LowStockItem {
  id: string;
  name: string;
  stock_quantity: number;
  category: string | null;
}

interface DbSaleRow {
  created_at: string;
  total_amount: number;
}

interface DbLowStockRow {
  id: string;
  name: string;
  stock_quantity: number;
  category: string | null;
}

interface DbActiveSessionRow {
  employee_id: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function latencyColor(ms: number): 'green' | 'yellow' | 'red' {
  if (ms < 100) return 'green';
  if (ms < 300) return 'yellow';
  return 'red';
}

function latencyTextClass(status: 'green' | 'yellow' | 'red'): string {
  if (status === 'green') return 'text-green-400';
  if (status === 'yellow') return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * Groups sales records into 24 hourly buckets for the velocity chart.
 * Bucket label is "HH:00" in local time.
 */
function groupSalesByHour(rows: DbSaleRow[]): HourlySalePoint[] {
  const buckets = new Map<number, { revenue: number; count: number }>();

  // Pre-fill all 24 hours so the chart always has a full line
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    buckets.set(d.getTime(), { revenue: 0, count: 0 });
  }

  for (const row of rows) {
    const d = new Date(row.created_at);
    d.setMinutes(0, 0, 0);
    const key = d.getTime();
    const existing = buckets.get(key);
    if (existing) {
      existing.revenue += row.total_amount;
      existing.count += 1;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, val]) => ({
      hour: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      revenue: Math.round(val.revenue * 100) / 100,
      count: val.count,
    }));
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState<SummaryStats>({
    todayRevenue: 0,
    activeAlerts: 0,
    avgLatencyMs: 0,
    lowStockCount: 0,
    activeSessions: 0,
    latencyStatus: 'green',
  });
  const [velocityData, setVelocityData] = useState<HourlySalePoint[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const since8h = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      // ── Supabase latency probe ──────────────────────────────────────────────
      const latencyStart = Date.now();
      await supabase.from('products').select('id').limit(1);
      const latencyMs = Date.now() - latencyStart;

      // ── Parallel data fetches ───────────────────────────────────────────────
      const [salesVelocityRes, lowStockRes, activeSessionsRes, todayRevenueRes] = await Promise.all([
        supabase
          .from('sales')
          .select('created_at, total_amount')
          .gte('created_at', since24h)
          .order('created_at', { ascending: true }),

        supabase
          .from('products')
          .select('id, name, stock_quantity, category')
          .lt('stock_quantity', 5)
          .gt('stock_quantity', -1)
          .eq('is_active', true)
          .order('stock_quantity', { ascending: true }),

        supabase
          .from('sales')
          .select('employee_id')
          .gte('created_at', since8h),

        supabase
          .from('sales')
          .select('total_amount')
          .gte('sale_date', todayStart.toISOString()),
      ]);

      // ── Sales velocity chart ────────────────────────────────────────────────
      const salesRows = (salesVelocityRes.data ?? []) as DbSaleRow[];
      const hourlyPoints = groupSalesByHour(salesRows);
      setVelocityData(hourlyPoints);

      // ── Low stock items ─────────────────────────────────────────────────────
      const stockRows = (lowStockRes.data ?? []) as DbLowStockRow[];
      setLowStockItems(stockRows);

      // ── Active sessions (unique employees with sales in last 8h) ───────────
      const sessionRows = (activeSessionsRes.data ?? []) as DbActiveSessionRow[];
      const uniqueEmployees = new Set(
        sessionRows.map((r) => r.employee_id).filter((id): id is string => id !== null),
      );

      // ── Today's revenue ─────────────────────────────────────────────────────
      type RevenueRow = { total_amount: number };
      const revenueRows = (todayRevenueRes.data ?? []) as RevenueRow[];
      const todayRevenue = revenueRows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0);

      const status = latencyColor(latencyMs);

      setSummary({
        todayRevenue,
        activeAlerts: stockRows.length,
        avgLatencyMs: latencyMs,
        lowStockCount: stockRows.length,
        activeSessions: uniqueEmployees.size,
        latencyStatus: status,
      });

      setLastRefreshed(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to load monitoring data', { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => { void loadData(); }, 60_000);
    return () => clearInterval(id);
  }, [loadData]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
              <Activity className="h-8 w-8 text-blue-400" />
              System Monitoring
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Real-time health and application metrics · auto-refreshes every 60s
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Badge variant="outline" className="bg-white/10 text-slate-300 border-white/20 text-xs">
              <Clock className="h-3 w-3 me-1" />
              {lastRefreshed.toLocaleTimeString()}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
              className="bg-white/10 text-slate-200 border-white/20 hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 me-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/10 border border-white/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
              Overview
            </TabsTrigger>
            <TabsTrigger value="health" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
              Health Checks
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-white/20 data-[state=active]:text-slate-100">
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* ── 4-card summary row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Today's Revenue */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-300 text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    Today's Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">
                    {loading ? '—' : `$${summary.todayRevenue.toFixed(2)}`}
                  </div>
                  <p className="text-slate-400 text-xs mt-1">since midnight</p>
                </CardContent>
              </Card>

              {/* Active Alerts */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-300 text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Active Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${summary.activeAlerts > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {loading ? '—' : summary.activeAlerts}
                  </div>
                  <p className="text-slate-400 text-xs mt-1">low-stock products</p>
                </CardContent>
              </Card>

              {/* Avg Latency */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-300 text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-400" />
                    DB Latency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${latencyTextClass(summary.latencyStatus)}`}>
                    {loading ? '—' : `${summary.avgLatencyMs} ms`}
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    {summary.latencyStatus === 'green' ? 'excellent' : summary.latencyStatus === 'yellow' ? 'acceptable' : 'degraded'}
                  </p>
                </CardContent>
              </Card>

              {/* Low Stock Items */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-300 text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-purple-400" />
                    Low Stock Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${summary.lowStockCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {loading ? '—' : summary.lowStockCount}
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    {summary.activeSessions} active {summary.activeSessions === 1 ? 'session' : 'sessions'} (8h)
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── Sales Velocity Chart ── */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-400" />
                  Sales Velocity — Last 24 Hours
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Revenue per hour across the last 24-hour window
                </CardDescription>
              </CardHeader>
              <CardContent>
                {velocityData.length === 0 && !loading ? (
                  <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                    No sales data in the last 24 hours
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={velocityData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        interval={3}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `$${v}`}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                          fontSize: 12,
                        }}
                        formatter={(value: number, name: string) =>
                          name === 'revenue' ? [`$${value.toFixed(2)}`, 'Revenue'] : [value, 'Sales']
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#6366f1' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* ── Low Stock Items List ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    Low Stock Alerts
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Products with fewer than 5 units in stock
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lowStockItems.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-400 text-sm py-4">
                      <CheckCircle className="h-4 w-4" />
                      All products are sufficiently stocked
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {lowStockItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-100">{item.name}</p>
                            {item.category && (
                              <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold border-0 ${
                              item.stock_quantity === 0
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {item.stock_quantity === 0 ? 'OUT' : `${item.stock_quantity} left`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── System Status Panel ── */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-400" />
                    System Status
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Infrastructure connectivity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-100">Supabase PostgreSQL</p>
                        <p className="text-xs text-slate-400">Primary database</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono ${latencyTextClass(summary.latencyStatus)}`}>
                        {loading ? '—' : `${summary.avgLatencyMs}ms`}
                      </span>
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-100">Active Sessions</p>
                        <p className="text-xs text-slate-400">Employees with sales in last 8h</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-purple-300">
                      {loading ? '—' : summary.activeSessions}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-green-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-100">Application</p>
                        <p className="text-xs text-slate-400">React 18 · Vite · Vercel</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                      Operational
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="health">
            <HealthCheckDashboard />
          </TabsContent>

          <TabsContent value="performance">
            <PerformanceDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
