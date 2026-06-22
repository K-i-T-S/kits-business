/**
 * AnalyticsCommandCenter — Premium analytics hub for restaurant managers/owners.
 *
 * Phase 1 foundation:
 * - 4 animated KPI cards (Today's Revenue, Covers, Average Check, Orders)
 * - Placeholder sections for Nivo charts (Phase 2)
 * - Data sourced directly from Supabase (table_orders + restaurant_order_items)
 * - Animated numbers via react-countup CountUp
 * - Framer Motion hover effects
 */

import CountUp from 'react-countup';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Users,
  TrendingUp,
  ShoppingBag,
  BarChart2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { RESTAURANT_COLORS } from '@/constants/restaurantColors';
import { supabase } from '@/utils/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TodayKPIs {
  revenue: number;
  covers: number;
  avgCheck: number;
  orders: number;
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: number;
  prefix?: string;
  icon: LucideIcon;
  /** Hex color used for gradient and icon tint */
  color: string;
  decimals?: number;
}

function KPICard({ label, value, prefix = '', icon: Icon, color, decimals = 0 }: KPICardProps) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 cursor-default select-none"
      style={{
        background: RESTAURANT_COLORS.surface,
        borderColor: RESTAURANT_COLORS.border,
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.2 }}
    >
      {/* Ambient glow blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-20 blur-2xl"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />

      {/* Icon */}
      <div
        className="relative flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${color}44, ${color}22)`,
          border: `1px solid ${color}44`,
        }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>

      {/* Label */}
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: RESTAURANT_COLORS.textMuted }}
      >
        {label}
      </p>

      {/* Animated value */}
      <p
        className="text-3xl font-black tabular-nums leading-none"
        style={{ color: RESTAURANT_COLORS.textPrimary }}
        dir="ltr"
      >
        {prefix}
        <CountUp
          end={value}
          duration={1}
          decimals={decimals}
          preserveValue
          useEasing
        />
      </p>
    </motion.div>
  );
}

// ── Placeholder section ────────────────────────────────────────────────────────

function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-16"
      style={{
        background: RESTAURANT_COLORS.glass,
        borderColor: RESTAURANT_COLORS.border,
      }}
    >
      <BarChart2
        className="h-10 w-10 opacity-15"
        style={{ color: RESTAURANT_COLORS.textMuted }}
      />
      <p
        className="text-sm font-medium"
        style={{ color: RESTAURANT_COLORS.textTertiary }}
      >
        {title}
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalyticsCommandCenter() {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [kpis, setKpis] = useState<TodayKPIs>({
    revenue: 0,
    covers: 0,
    avgCheck: 0,
    orders: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      const todayISO = new Date().toISOString().split('T')[0]!;

      const [ordersRes, itemsRes] = await Promise.all([
        supabase
          .from('table_orders')
          .select('id, status, paid_at, opened_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'paid')
          .gte('paid_at', `${todayISO}T00:00:00`),
        supabase
          .from('restaurant_order_items')
          .select('order_id, unit_price, quantity, sent_at')
          .eq('tenant_id', tenantId)
          .gte('sent_at', `${todayISO}T00:00:00`),
      ]);

      const orders = ordersRes.data ?? [];
      const items = itemsRes.data ?? [];

      const orderCount = orders.length;
      const revenue = items.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0,
      );
      // Covers = number of paid orders today (one "cover" per order)
      const covers = orderCount;
      const avgCheck = orderCount > 0 ? revenue / orderCount : 0;

      setKpis({ revenue, covers, avgCheck, orders: orderCount });
    } catch (err) {
      console.error('[AnalyticsCommandCenter] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  // KPI card definitions
  const kpiCards: KPICardProps[] = [
    {
      label: "Today's Revenue",
      value: kpis.revenue,
      prefix: '$',
      icon: DollarSign,
      color: '#10b981', // emerald
      decimals: 2,
    },
    {
      label: 'Covers',
      value: kpis.covers,
      icon: Users,
      color: '#3b82f6', // blue
      decimals: 0,
    },
    {
      label: 'Average Check',
      value: kpis.avgCheck,
      prefix: '$',
      icon: TrendingUp,
      color: '#f59e0b', // amber
      decimals: 2,
    },
    {
      label: 'Orders',
      value: kpis.orders,
      icon: ShoppingBag,
      color: '#8b5cf6', // violet
      decimals: 0,
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div
            className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#f59e0b', borderTopColor: 'transparent' }}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className="min-h-screen p-4 md:p-8 space-y-8"
        style={{ background: RESTAURANT_COLORS.base }}
      >
        {/* Header */}
        <div className="space-y-1">
          <h1
            className="text-2xl font-black tracking-tight"
            style={{ color: RESTAURANT_COLORS.textPrimary }}
          >
            Analytics Command Center
          </h1>
          <p
            className="text-sm"
            style={{ color: RESTAURANT_COLORS.textMuted }}
          >
            Today's performance at a glance
          </p>
        </div>

        {/* KPI Row */}
        <section>
          <p
            className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: '#f59e0b99' }}
          >
            Today
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCards.map((card) => (
              <KPICard key={card.label} {...card} />
            ))}
          </div>
        </section>

        {/* Placeholder sections — Phase 2 chart implementations */}
        <section className="space-y-6">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: '#f59e0b99' }}
          >
            Analytics (Phase 2)
          </p>
          <p
            className="text-sm text-center py-2"
            style={{ color: RESTAURANT_COLORS.textTertiary }}
          >
            Revenue Calendar, Stream Charts, Menu Matrix, and Forecast coming in Phase 1…
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <ChartPlaceholder title="Revenue Calendar" />
            <ChartPlaceholder title="Revenue Stream Chart" />
            <ChartPlaceholder title="Menu Performance Matrix" />
            <ChartPlaceholder title="7-Day Forecast" />
          </div>
        </section>
      </div>
    </Layout>
  );
}
