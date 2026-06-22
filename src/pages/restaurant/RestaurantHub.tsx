/**
 * RestaurantHub — Default entry point for restaurant operations.
 *
 * Layout: 65% 3D floor plan (left) + 35% metrics sidebar (right) on desktop.
 *         Full-screen floor on mobile (sidebar collapses below).
 *
 * Features:
 * - Live table status via FloorPlan3D
 * - KPI sidebar with animated counters (open tables, covers, revenue, avg check)
 * - Quick action buttons (New Order, Scan QR, KDS, Slow Alerts)
 * - Toggle between Floor view and Analytics Command Center (placeholder → Task 7)
 * - Offline banner when navigator.onLine is false
 * - Real-time updates via useRestaurantRealtime
 */

import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  ChefHat,
  Clock,
  DollarSign,
  LayoutGrid,
  MessageSquare,
  QrCode,
  RefreshCw,
  Star,
  Users,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Component, lazy, Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const FloorPlan3D = lazy(() => import('@/components/restaurant/FloorPlan3D'));
import type { OrderInfo } from '@/components/restaurant/FloorPlan3D';
import { useApp } from '@/context/AppContext';
import { useCountUp } from '@/hooks/useCountUp';
import {
  useRestaurantRealtime,
  useOfflineStatus,
} from '@/hooks/useRestaurantRealtime';
import type {
  RestaurantTable,
  TableOrder,
  RestaurantOrderItem,
} from '@/types/restaurant';
import { RESTAURANT_COLORS } from '@/constants/restaurantColors';
import { supabase } from '@/utils/supabaseClient';

// ── View mode ─────────────────────────────────────────────────────────────────

type ViewMode = 'floor' | 'analytics';

// ── WebGL error boundary — catches Three.js/r3f init failures ────────────────

interface WebGLBoundaryState { hasError: boolean; }

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, WebGLBoundaryState> {
  state: WebGLBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WebGLBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[FloorPlan3D] WebGL render failed, using 2D fallback:', error.message, info.componentStack);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// ── Sparkline (5 tiny bars) ───────────────────────────────────────────────────

function Sparkline({ history, color }: { history: number[]; color: string }) {
  const max = Math.max(...history, 1);
  return (
    <div className="flex items-end gap-[2px] h-5">
      {history.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm transition-all duration-300"
          style={{
            height: `${Math.max(4, Math.round((v / max) * 20))}px`,
            background: i === history.length - 1 ? color : color + '55',
          }}
        />
      ))}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: React.ReactNode;
  color: string;
  history?: number[];
}

function KpiCard({ label, value, prefix = '', suffix = '', decimals = 0, icon, color, history }: KpiCardProps) {
  const animated = useCountUp(value);
  const display = decimals > 0
    ? animated.toFixed(decimals)
    : Math.round(animated).toString();

  return (
    <motion.div
      className="rounded-2xl border p-4 flex flex-col gap-2 cursor-default select-none"
      style={{
        background: RESTAURANT_COLORS.surface,
        borderColor: RESTAURANT_COLORS.border,
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, borderColor: color + '66' }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: RESTAURANT_COLORS.textMuted }}>
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: RESTAURANT_COLORS.textPrimary }}>
        {prefix}{display}{suffix}
      </p>
      {history && history.length > 0 && (
        <Sparkline history={history} color={color} />
      )}
    </motion.div>
  );
}

// ── Quick action button ───────────────────────────────────────────────────────

interface QuickActionProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  accent?: string;
}

function QuickAction({ label, icon, onClick, accent = '#6366f1' }: QuickActionProps) {
  return (
    <motion.button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium w-full"
      style={{
        background: accent + '18',
        borderColor: accent + '44',
        color: accent,
      }}
      whileHover={{ scale: 1.02, background: accent + '28' }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </motion.button>
  );
}

// ── Offline banner ────────────────────────────────────────────────────────────

function OfflineBanner() {
  return (
    <motion.div
      className="flex items-center gap-2 rounded-lg bg-red-500/15 border border-red-500/40 px-4 py-2.5 text-sm text-red-400"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You are offline — changes will sync when connection is restored.</span>
    </motion.div>
  );
}

// ── Analytics panel types ─────────────────────────────────────────────────────

interface SlowAlertRow {
  table_id: string;
  created_at: string;
  alert_type: string;
}

interface FeedbackRow {
  id: string;
  overall_rating: number | null;
  comment: string | null;
  submitted_at: string;
}

interface AnalyticsData {
  todayRevenue: number | null;
  slowAlerts: SlowAlertRow[];
  qrPendingCount: number;
  recentFeedback: FeedbackRow[];
}

// ── Analytics Command Center ─────────────────────────────────────────────────

interface AnalyticsCommandCenterProps {
  tenantId: string;
  tables: RestaurantTable[];
}

function AnalyticsCommandCenter({ tenantId, tables }: AnalyticsCommandCenterProps) {
  const [data, setData] = useState<AnalyticsData>({
    todayRevenue: null,
    slowAlerts: [],
    qrPendingCount: 0,
    recentFeedback: [],
  });
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Today's midnight in Beirut (UTC+3 / UTC+2 DST — use UTC+3 as Lebanon time)
      const now = new Date();
      const beirutOffset = 3 * 60; // minutes
      const localMidnight = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
        ) - beirutOffset * 60 * 1000,
      );
      const todayISO = localMidnight.toISOString();

      const [revenueRes, slowRes, qrRes, feedbackRes] = await Promise.all([
        supabase
          .from('table_orders')
          .select('total_amount')
          .eq('tenant_id', tenantId)
          .eq('status', 'paid')
          .gte('paid_at', todayISO),
        supabase
          .from('restaurant_slow_alerts')
          .select('table_id, created_at, alert_type')
          .eq('tenant_id', tenantId)
          .is('resolved_at', null)
          .order('created_at'),
        supabase
          .from('restaurant_pending_orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending'),
        supabase
          .from('restaurant_table_feedback')
          .select('id, overall_rating, comment, submitted_at')
          .eq('tenant_id', tenantId)
          .order('submitted_at', { ascending: false })
          .limit(5),
      ]);

      // Revenue: sum total_amount if column exists, otherwise null
      let todayRevenue: number | null = null;
      if (revenueRes.data && revenueRes.data.length > 0) {
        const rows = revenueRes.data as Array<Record<string, unknown>>;
        const amounts = rows.map((r) => {
          const v = r['total_amount'];
          return typeof v === 'number' ? v : 0;
        });
        todayRevenue = amounts.reduce((a, b) => a + b, 0);
      } else if (revenueRes.data) {
        todayRevenue = 0;
      }

      setData({
        todayRevenue,
        slowAlerts: (slowRes.data ?? []) as SlowAlertRow[],
        qrPendingCount: qrRes.count ?? 0,
        recentFeedback: (feedbackRes.data ?? []) as FeedbackRow[],
      });
    } catch (err) {
      console.error('[AnalyticsCommandCenter] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  // Table status counts
  const available = tables.filter((t) => t.status === 'available').length;
  const occupied = tables.filter((t) => t.status === 'occupied').length;
  const cleaning = tables.filter((t) => t.status === 'cleaning').length;

  // Average feedback rating
  const ratingsWithValues = data.recentFeedback.filter((f) => f.overall_rating !== null);
  const avgRating =
    ratingsWithValues.length > 0
      ? ratingsWithValues.reduce((s, f) => s + (f.overall_rating ?? 0), 0) / ratingsWithValues.length
      : null;

  function minutesSinceISO(iso: string): number {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  }

  return (
    <div
      className="flex h-full flex-col gap-0 overflow-y-auto rounded-2xl border"
      style={{
        background: RESTAURANT_COLORS.surface,
        borderColor: RESTAURANT_COLORS.border,
        minHeight: 400,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: RESTAURANT_COLORS.border }}
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4" style={{ color: '#6366f1' }} />
          <span className="text-sm font-semibold" style={{ color: RESTAURANT_COLORS.textPrimary }}>
            Analytics Command Center
          </span>
        </div>
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-indigo-400" />
        )}
      </div>

      {/* 1. Today's Revenue */}
      <div
        className="border-b px-5 py-4"
        style={{ borderColor: RESTAURANT_COLORS.border }}
      >
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-3.5 w-3.5" style={{ color: '#10b981' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: RESTAURANT_COLORS.textMuted }}>
            Today's Revenue
          </span>
        </div>
        <p className="text-2xl font-black" style={{ color: RESTAURANT_COLORS.textPrimary }}>
          {data.todayRevenue === null ? '—' : `$${data.todayRevenue.toFixed(2)}`}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: RESTAURANT_COLORS.textMuted }}>
          Paid orders since midnight Beirut
        </p>
      </div>

      {/* 2. Table Status Summary */}
      <div
        className="border-b px-5 py-4"
        style={{ borderColor: RESTAURANT_COLORS.border }}
      >
        <div className="flex items-center gap-2 mb-3">
          <LayoutGrid className="h-3.5 w-3.5" style={{ color: '#6366f1' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: RESTAURANT_COLORS.textMuted }}>
            Tables Status
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {available} available
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {occupied} occupied
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-slate-500/15 border border-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            {cleaning} cleaning
          </span>
        </div>
      </div>

      {/* 3. Slow Table Alerts */}
      <div
        className="border-b px-5 py-4"
        style={{ borderColor: RESTAURANT_COLORS.border }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: RESTAURANT_COLORS.textMuted }}>
              Slow Alerts
            </span>
          </div>
          {data.slowAlerts.length > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
              {data.slowAlerts.length}
            </span>
          )}
        </div>
        {data.slowAlerts.length === 0 ? (
          <p className="text-xs" style={{ color: RESTAURANT_COLORS.textMuted }}>No active alerts</p>
        ) : (
          <div className="space-y-2">
            {data.slowAlerts.map((alert, idx) => {
              const table = tables.find((t) => t.id === alert.table_id);
              const mins = minutesSinceISO(alert.created_at);
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-bold text-red-300">
                      Table {table?.number ?? '?'}
                    </span>
                    <p className="text-[10px] text-red-400/70 capitalize">
                      {alert.alert_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
                    <Clock className="h-3 w-3" />
                    {mins}m
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. QR Pending Count */}
      <div
        className="border-b px-5 py-4"
        style={{ borderColor: RESTAURANT_COLORS.border }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-3.5 w-3.5" style={{ color: '#0ea5e9' }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: RESTAURANT_COLORS.textMuted }}>
              QR Pending
            </span>
          </div>
          {data.qrPendingCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-white">
              {data.qrPendingCount}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm" style={{ color: RESTAURANT_COLORS.textSecondary }}>
          {data.qrPendingCount === 0
            ? 'No QR orders waiting'
            : `${data.qrPendingCount} guest${data.qrPendingCount > 1 ? 's' : ''} waiting for order confirmation`}
        </p>
      </div>

      {/* 5. Recent Feedback */}
      <div className="px-5 py-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: RESTAURANT_COLORS.textMuted }}>
              Recent Feedback
            </span>
          </div>
          {avgRating !== null && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-400">
              <Star className="h-3 w-3 fill-amber-400" />
              {avgRating.toFixed(1)}
            </span>
          )}
        </div>
        {data.recentFeedback.length === 0 ? (
          <p className="text-xs" style={{ color: RESTAURANT_COLORS.textMuted }}>No recent feedback</p>
        ) : (
          <div className="space-y-2">
            {data.recentFeedback.map((fb) => (
              <div
                key={fb.id}
                className="rounded-xl border border-white/5 bg-white/3 px-3 py-2"
              >
                {fb.overall_rating !== null && (
                  <div className="flex items-center gap-0.5 mb-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className="h-3 w-3"
                        style={{
                          color: i < (fb.overall_rating ?? 0) ? '#f59e0b' : 'rgba(255,255,255,0.15)',
                          fill: i < (fb.overall_rating ?? 0) ? '#f59e0b' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                )}
                {fb.comment && (
                  <p className="text-xs leading-relaxed" style={{ color: RESTAURANT_COLORS.textTertiary }}>
                    &ldquo;{fb.comment}&rdquo;
                  </p>
                )}
                <p className="text-[10px] mt-1" style={{ color: RESTAURANT_COLORS.textMuted }}>
                  {new Date(fb.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RestaurantHub() {
  const { currentTenant } = useApp();
  const navigate = useNavigate();
  const { isOffline } = useOfflineStatus();

  const tenantId = currentTenant?.id ?? '';
  const restaurantName = currentTenant?.name ?? 'Restaurant';

  // ── View mode toggle ──────────────────────────────────────────────────────

  const [viewMode, setViewMode] = useState<ViewMode>('floor');

  // ── Restaurant data state ─────────────────────────────────────────────────

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [orderItems, setOrderItems] = useState<RestaurantOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Rolling history for sparklines — last 5 snapshots per KPI
  const [kpiHistory, setKpiHistory] = useState<{
    openTables: number[];
    covers: number[];
    revenue: number[];
    avgCheck: number[];
  }>({ openTables: [], covers: [], revenue: [], avgCheck: [] });

  // Stable ref to avoid stale closures in real-time callbacks
  const tablesRef = useRef(tables);
  tablesRef.current = tables;

  // ── Data loader ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [tablesRes, ordersRes, itemsRes] = await Promise.all([
        supabase.from('restaurant_tables').select('*'),
        supabase.from('table_orders').select('*').in('status', ['open', 'sent', 'served']),
        supabase.from('restaurant_order_items').select('*'),
      ]);

      if (tablesRes.data) setTables(tablesRes.data as RestaurantTable[]);
      if (ordersRes.data) setOrders(ordersRes.data as TableOrder[]);
      if (itemsRes.data) setOrderItems(itemsRes.data as RestaurantOrderItem[]);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('[RestaurantHub] loadData error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Real-time updates ─────────────────────────────────────────────────────

  const handleTableChange = useCallback(() => {
    void loadData();
  }, [loadData]);

  const handleOrderChange = useCallback(() => {
    void loadData();
  }, [loadData]);

  useRestaurantRealtime(tenantId, {
    onTableChange: handleTableChange,
    onOrderChange: handleOrderChange,
  });

  // ── Derived KPI data ──────────────────────────────────────────────────────

  const openTables = tables.filter((t) => t.status === 'occupied').length;
  const totalTables = tables.length;

  // Total covers: sum of seats for occupied tables
  const covers = tables
    .filter((t) => t.status === 'occupied')
    .reduce((sum, t) => sum + t.seats, 0);

  // Revenue: sum of all open order items
  const revenue = orderItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  // Average check per occupied table
  const avgCheck = openTables > 0 ? revenue / openTables : 0;

  // Rolling sparkline history — append new snapshot when KPIs change
  useEffect(() => {
    if (isLoading) return;
    setKpiHistory((prev) => ({
      openTables: [...prev.openTables, openTables].slice(-5),
      covers: [...prev.covers, covers].slice(-5),
      revenue: [...prev.revenue, revenue].slice(-5),
      avgCheck: [...prev.avgCheck, avgCheck].slice(-5),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefreshed]);

  // Human-readable "last refreshed" string
  const lastRefreshedLabel = useMemo(() => {
    if (!lastRefreshed) return null;
    const now = new Date();
    const diffMs = now.getTime() - lastRefreshed.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    return `${Math.floor(diffSec / 60)}m ago`;
  }, [lastRefreshed]);

  // Re-compute label every 10 seconds without triggering a data reload
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // Build OrderInfo array for FloorPlan3D
  const orderInfos: OrderInfo[] = orders
    .filter((o) => o.table_id !== null)
    .map((o) => {
      const tableItems = orderItems.filter((i) => i.order_id === o.id);
      const total = tableItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const table = tables.find((t) => t.id === o.table_id);
      const covers = table?.seats ?? 0;
      const minutesSince = o.opened_at
        ? Math.floor((Date.now() - new Date(o.opened_at).getTime()) / 60_000)
        : 0;
      return {
        table_id: o.table_id as string,
        total,
        covers,
        minutesSince,
      };
    });

  // ── Table selection → navigate to waiter interface ────────────────────────

  const handleTableSelect = useCallback(
    (tableId: string) => {
      setSelectedTableId(tableId);
      void navigate(`/restaurant/waiter?table=${tableId}`);
    },
    [navigate],
  );

  // ── Quick actions ─────────────────────────────────────────────────────────

  const handleNewOrder = () => {
    void navigate('/restaurant/waiter');
  };

  const handleScanQR = () => {
    void navigate('/restaurant/tables');
  };

  const handleViewKDS = () => {
    void navigate('/restaurant/kds');
  };

  const handleSlowAlerts = () => {
    void navigate('/restaurant/analytics');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: RESTAURANT_COLORS.base }}
    >
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <motion.header
        className="flex items-center justify-between border-b px-4 py-3 md:px-6"
        style={{ borderColor: RESTAURANT_COLORS.border, background: RESTAURANT_COLORS.surface }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Left: back button + name + status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { void navigate('/dashboard'); }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <UtensilsCrossed className="h-5 w-5" style={{ color: '#6366f1' }} />
          <div>
            <h1 className="text-base font-semibold leading-tight" style={{ color: RESTAURANT_COLORS.textPrimary }}>
              {restaurantName}
            </h1>
            <p className="text-xs" style={{ color: RESTAURANT_COLORS.textMuted }}>
              {openTables} of {totalTables} tables occupied
            </p>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {/* Offline indicator */}
          {isOffline ? (
            <WifiOff className="h-4 w-4 text-red-400" />
          ) : (
            <Wifi className="h-4 w-4 opacity-30" style={{ color: RESTAURANT_COLORS.textMuted }} />
          )}

          {/* Floor / Analytics toggle */}
          <div
            className="flex rounded-xl border p-0.5"
            style={{ borderColor: RESTAURANT_COLORS.border, background: RESTAURANT_COLORS.glass }}
          >
            {(['floor', 'analytics'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all duration-200"
                style={{
                  background: viewMode === mode ? '#6366f1' : 'transparent',
                  color: viewMode === mode ? '#ffffff' : RESTAURANT_COLORS.textMuted,
                }}
              >
                {mode === 'floor' ? 'Floor' : 'Analytics'}
              </button>
            ))}
          </div>

          {/* Kitchen Display shortcut */}
          <button
            onClick={handleViewKDS}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              borderColor: RESTAURANT_COLORS.border,
              color: RESTAURANT_COLORS.textSecondary,
              background: 'transparent',
            }}
          >
            <ChefHat className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kitchen</span>
          </button>

          {/* Waiter interface shortcut */}
          <button
            onClick={handleNewOrder}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              borderColor: '#6366f155',
              color: '#818cf8',
              background: '#6366f112',
            }}
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Waiter</span>
          </button>

          {/* Manual refresh */}
          <button
            onClick={() => void loadData()}
            className="rounded-xl border p-1.5 transition-colors"
            style={{ borderColor: RESTAURANT_COLORS.border, color: RESTAURANT_COLORS.textMuted }}
            title="Refresh data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.header>

      {/* ── Offline banner ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOffline && (
          <div className="px-4 pt-3 md:px-6">
            <OfflineBanner />
          </div>
        )}
      </AnimatePresence>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">

        {/* ── Left: Floor plan or Analytics ──────────────────────────────── */}
        <motion.main
          className="md:flex-1 md:overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <AnimatePresence mode="wait">
            {viewMode === 'floor' ? (
              <motion.div
                key="floor"
                className="flex flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ height: 'clamp(360px, 56dvh, 100%)' }}
              >
                <WebGLErrorBoundary
                  fallback={
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#0a0f1e] p-6">
                      <div className="grid grid-cols-3 gap-3">
                        {tables.slice(0, 9).map(t => (
                          <button
                            key={t.id}
                            onClick={() => handleTableSelect(t.id)}
                            className={`rounded-xl border p-3 text-left transition-all ${
                              t.status === 'occupied' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' :
                                t.status === 'reserved' ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' :
                                  'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                          >
                            <div className="text-xs font-bold">T{t.number}</div>
                            <div className="text-[10px] capitalize opacity-70">{t.status}</div>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-white/30">2D fallback — 3D floor plan unavailable</p>
                    </div>
                  }
                >
                  <Suspense fallback={
                    <div className="flex h-full w-full items-center justify-center bg-[#0a0f1e]">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-amber-400" />
                    </div>
                  }>
                    <FloorPlan3D
                      tables={tables}
                      orders={orderInfos}
                      selectedTableId={selectedTableId}
                      onTableSelect={handleTableSelect}
                      isLoading={isLoading}
                    />
                  </Suspense>
                </WebGLErrorBoundary>

                {/* Compact status legend beneath the 3D canvas */}
                <div
                  className="flex items-center justify-center gap-5 py-2 px-4 border-t"
                  style={{ borderColor: RESTAURANT_COLORS.border }}
                >
                  {(
                    [
                      { key: 'available', label: 'Available' },
                      { key: 'occupied', label: 'Occupied' },
                      { key: 'reserved', label: 'Reserved' },
                      { key: 'cleaning', label: 'Cleaning' },
                      { key: 'alert', label: '>15 min' },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        // eslint-disable-next-line security/detect-object-injection
                        style={{ background: RESTAURANT_COLORS[key].fill }}
                      />
                      <span className="text-[10px]" style={{ color: RESTAURANT_COLORS.textMuted }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="analytics"
                className="h-full p-4 md:p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <AnalyticsCommandCenter tenantId={tenantId} tables={tables} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.main>

        {/* ── Right: Metrics sidebar ──────────────────────────────────────── */}
        <motion.aside
          className="flex flex-col gap-4 border-t p-4 md:w-80 md:shrink-0 md:border-t-0 md:border-l md:p-5 lg:w-96"
          style={{ borderColor: RESTAURANT_COLORS.border, background: RESTAURANT_COLORS.surface }}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          {/* KPI grid */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: RESTAURANT_COLORS.textMuted }}
              >
                Live Metrics
              </h2>
              {lastRefreshedLabel && (
                <span className="text-[10px]" style={{ color: RESTAURANT_COLORS.textMuted }}>
                  {lastRefreshedLabel}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Open Tables"
                value={openTables}
                icon={<LayoutGrid className="h-4 w-4" />}
                color="#6366f1"
                history={kpiHistory.openTables}
              />
              <KpiCard
                label="Covers"
                value={covers}
                icon={<Users className="h-4 w-4" />}
                color="#0ea5e9"
                history={kpiHistory.covers}
              />
              <KpiCard
                label="Revenue"
                value={revenue}
                prefix="$"
                decimals={2}
                icon={<DollarSign className="h-4 w-4" />}
                color="#10b981"
                history={kpiHistory.revenue}
              />
              <KpiCard
                label="Avg Check"
                value={avgCheck}
                prefix="$"
                decimals={2}
                icon={<Clock className="h-4 w-4" />}
                color="#f59e0b"
                history={kpiHistory.avgCheck}
              />
            </div>
          </section>

          {/* Quick actions */}
          <section>
            <h2
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: RESTAURANT_COLORS.textMuted }}
            >
              Quick Actions
            </h2>
            <div className="flex flex-col gap-2">
              <QuickAction
                label="New Table Order"
                icon={<UtensilsCrossed className="h-4 w-4" />}
                onClick={handleNewOrder}
                accent="#6366f1"
              />
              <QuickAction
                label="Scan QR / Manage Tables"
                icon={<QrCode className="h-4 w-4" />}
                onClick={handleScanQR}
                accent="#0ea5e9"
              />
              <QuickAction
                label="View Kitchen Display"
                icon={<ChefHat className="h-4 w-4" />}
                onClick={handleViewKDS}
                accent="#f59e0b"
              />
              <QuickAction
                label="Slow Service Alerts"
                icon={<Clock className="h-4 w-4" />}
                onClick={handleSlowAlerts}
                accent="#ef4444"
              />
            </div>
          </section>

          {/* Table status legend */}
          <section className="mt-auto">
            <h2
              className="mb-2 text-xs font-semibold uppercase tracking-widest"
              style={{ color: RESTAURANT_COLORS.textMuted }}
            >
              Status Legend
            </h2>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  { key: 'available', label: 'Available' },
                  { key: 'occupied', label: 'Occupied' },
                  { key: 'reserved', label: 'Reserved' },
                  { key: 'cleaning', label: 'Cleaning' },
                  { key: 'alert', label: 'Alert (>15 min)' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    // eslint-disable-next-line security/detect-object-injection
                    style={{ background: RESTAURANT_COLORS[key].fill }}
                  />
                  <span className="text-xs" style={{ color: RESTAURANT_COLORS.textTertiary }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </motion.aside>
      </div>
    </div>
  );
}
