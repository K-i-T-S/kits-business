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
  BarChart2,
  ChefHat,
  Clock,
  DollarSign,
  LayoutGrid,
  QrCode,
  RefreshCw,
  Users,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import FloorPlan3D from '@/components/restaurant/FloorPlan3D';
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

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: React.ReactNode;
  color: string;
}

function KpiCard({ label, value, prefix = '', suffix = '', decimals = 0, icon, color }: KpiCardProps) {
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

// ── Analytics placeholder ─────────────────────────────────────────────────────

function AnalyticsPlaceholder() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border"
      style={{
        background: RESTAURANT_COLORS.surface,
        borderColor: RESTAURANT_COLORS.border,
        minHeight: 400,
      }}
    >
      <BarChart2 className="h-12 w-12 opacity-20" style={{ color: RESTAURANT_COLORS.textMuted }} />
      <p className="text-sm" style={{ color: RESTAURANT_COLORS.textMuted }}>
        Analytics Command Center — coming in Task 7
      </p>
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
      navigate(`/restaurant/waiter?table=${tableId}`);
    },
    [navigate],
  );

  // ── Quick actions ─────────────────────────────────────────────────────────

  const handleNewOrder = () => {
    navigate('/restaurant/waiter');
  };

  const handleScanQR = () => {
    navigate('/restaurant/table-management');
  };

  const handleViewKDS = () => {
    navigate('/restaurant/kitchen');
  };

  const handleSlowAlerts = () => {
    navigate('/restaurant/analytics');
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
        {/* Left: name + status */}
        <div className="flex items-center gap-3">
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
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">

        {/* ── Left: Floor plan or Analytics ──────────────────────────────── */}
        <motion.main
          className="flex-1 overflow-hidden"
          style={{ minHeight: 400 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <AnimatePresence mode="wait">
            {viewMode === 'floor' ? (
              <motion.div
                key="floor"
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{ minHeight: 400 }}
              >
                <FloorPlan3D
                  tables={tables}
                  orders={orderInfos}
                  selectedTableId={selectedTableId}
                  onTableSelect={handleTableSelect}
                  isLoading={isLoading}
                />
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
                <AnalyticsPlaceholder />
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
            <h2
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: RESTAURANT_COLORS.textMuted }}
            >
              Live Metrics
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Open Tables"
                value={openTables}
                icon={<LayoutGrid className="h-4 w-4" />}
                color="#6366f1"
              />
              <KpiCard
                label="Covers"
                value={covers}
                icon={<Users className="h-4 w-4" />}
                color="#0ea5e9"
              />
              <KpiCard
                label="Revenue"
                value={revenue}
                prefix="$"
                decimals={2}
                icon={<DollarSign className="h-4 w-4" />}
                color="#10b981"
              />
              <KpiCard
                label="Avg Check"
                value={avgCheck}
                prefix="$"
                decimals={2}
                icon={<Clock className="h-4 w-4" />}
                color="#f59e0b"
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
