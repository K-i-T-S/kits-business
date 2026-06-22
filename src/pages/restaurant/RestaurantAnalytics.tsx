import {
  BarChart2, Users, Clock, TrendingUp, AlertCircle, Flame,
  Brain, Zap, ChevronDown, RefreshCw, Star,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Area, ReferenceLine, LineChart,
} from 'recharts';

import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type { WaiterPerformanceStats, TableFeedback } from '@/types/restaurant';
import {
  generateForecast,
  analyzeWeeklyPattern,
  computeItemVelocity,
  generateInsights,
  holtSmoothing,
  isRamadan,
} from '@/utils/restaurantML';
import type {
  DailyRevenue,
  ForecastPoint,
  WeeklyPattern,
  ItemVelocity,
  MLInsight,
} from '@/utils/restaurantML';
import { rankWaiters } from '@/utils/restaurantScoring';
import { supabase } from '@/utils/supabaseClient';
import { useDemandForecast } from '@/hooks/useDemandForecast';

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d';
type AnalyticsTab = 'overview' | 'forecast' | 'matrix';

interface LiveOps {
  tablesOccupied: number;
  totalTables: number;
  activeOrders: number;
  slowAlerts: number;
  argileSessions: number;
}

interface TodayKPI {
  revenue: number;
  covers: number;
  avgCheck: number;
  argileRevenue: number;
  topDish: string;
  avgRating: number;
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function AmberTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-amber-500/20 bg-slate-950/95 backdrop-blur-xl p-3 shadow-2xl text-xs">
      <p className="mb-1.5 font-semibold text-white/70">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color ?? '#f59e0b' }}>{p.name}</span>
          <span className="font-bold text-white">${typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Insight card ──────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: MLInsight }) {
  const bg = insight.severity === 'warning'
    ? 'border-amber-500/30 bg-amber-500/8'
    : insight.severity === 'opportunity'
      ? 'border-emerald-500/30 bg-emerald-500/8'
      : 'border-white/10 bg-white/5';
  const textColor = insight.severity === 'warning'
    ? 'text-amber-300'
    : insight.severity === 'opportunity'
      ? 'text-emerald-300'
      : 'text-sky-300';

  return (
    <div className={`rounded-2xl border backdrop-blur-md p-4 space-y-1.5 ${bg}`}>
      <p className={`text-xs font-bold ${textColor}`}>
        {insight.icon} {insight.title}
      </p>
      <p className="text-xs text-white/60 leading-relaxed">{insight.body}</p>
      {insight.action && (
        <span className="inline-block mt-1 rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/50">
          {insight.action} →
        </span>
      )}
    </div>
  );
}

// ── Forecast tab ──────────────────────────────────────────────────────────────

interface ForecastTabProps {
  tenantId?: string;
}

function ForecastTab({ tenantId }: ForecastTabProps) {
  const { forecasts, loading: forecastLoading } = useDemandForecast(tenantId);

  if (forecastLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-xl p-8 text-center text-white/40 text-sm">
        No forecast data yet. Check back after the nightly AI forecast job runs.
      </div>
    );
  }

  // Tomorrow's prediction card (first item)
  const tomorrow = forecasts[0]!;
  const confidenceColor = tomorrow.confidence >= 0.8
    ? 'text-emerald-400'
    : tomorrow.confidence >= 0.65
      ? 'text-amber-400'
      : 'text-red-400';

  // 7-day chart data
  const chartData = forecasts.map((f) => ({
    date: new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    covers: f.predicted_covers,
    revenue: Math.round(f.predicted_revenue * 100) / 100,
    confidence: Math.round(f.confidence * 100),
  }));

  return (
    <div className="space-y-6">
      {/* Tomorrow's prediction card */}
      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3">
          Tomorrow's Prediction
        </h3>
        <div className="backdrop-blur-md bg-gradient-to-br from-indigo-500/15 to-sky-500/10 border border-indigo-500/30 rounded-2xl shadow-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Covers */}
            <div className="space-y-1.5">
              <p className="text-xs text-white/40">Predicted Covers</p>
              <p className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
                {tomorrow.predicted_covers}
              </p>
            </div>
            {/* Revenue */}
            <div className="space-y-1.5">
              <p className="text-xs text-white/40">Predicted Revenue</p>
              <p className="text-3xl font-black text-emerald-400">
                ${tomorrow.predicted_revenue.toFixed(2)}
              </p>
            </div>
            {/* Confidence */}
            <div className="space-y-1.5">
              <p className="text-xs text-white/40">Confidence Level</p>
              <p className={`text-3xl font-black ${confidenceColor}`}>
                {Math.round(tomorrow.confidence * 100)}%
              </p>
              <p className="text-[9px] text-white/30 mt-1">
                {tomorrow.confidence >= 0.8
                  ? '✓ High confidence'
                  : tomorrow.confidence >= 0.65
                    ? '◐ Moderate confidence'
                    : '⚠ Low confidence'}
              </p>
            </div>
          </div>

          {/* Staffing Recommendation */}
          {tomorrow.staff_recommendation && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs font-bold text-white/70 mb-2">Staffing Recommendation</p>
              <div className="bg-white/5 rounded-lg px-3 py-2">
                <p className="text-xs text-white/60">
                  {typeof tomorrow.staff_recommendation === 'object'
                    ? JSON.stringify(tomorrow.staff_recommendation).slice(0, 100) + '...'
                    : String(tomorrow.staff_recommendation)}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 7-day forecast chart */}
      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3">
          7-Day Demand Forecast
        </h3>
        <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-xl border border-indigo-500/20 bg-slate-950/95 backdrop-blur-xl p-3 shadow-2xl text-xs">
                      <p className="mb-1.5 font-semibold text-white/70">{label}</p>
                      {payload.map((p, i) => (
                        <p key={i} className="flex items-center justify-between gap-4">
                          <span style={{ color: p.color }}>{p.name}</span>
                          <span className="font-bold text-white">
                            {p.name === 'Predicted Covers' ? p.value : `$${p.value}`}
                          </span>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Line dataKey="covers" stroke="#818cf8" strokeWidth={2} dot={false} name="Predicted Covers" connectNulls />
              <Line
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Predicted Revenue ($)"
                connectNulls
                yAxisId="right"
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Forecast factors and prep */}
      {forecasts.map((f) => (
        (f.factors || f.prep_recommendations) ? (
          <section key={f.id}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3">
              {new Date(f.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} Insights
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {f.factors && (
                <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-xl shadow-xl p-4">
                  <p className="text-xs font-bold text-white/70 mb-2">Demand Factors</p>
                  <p className="text-xs text-white/50">
                    {typeof f.factors === 'object' ? JSON.stringify(f.factors).slice(0, 120) + '...' : String(f.factors)}
                  </p>
                </div>
              )}
              {f.prep_recommendations && (
                <div className="backdrop-blur-md bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30 rounded-xl shadow-xl p-4">
                  <p className="text-xs font-bold text-emerald-300 mb-2">Prep Recommendations</p>
                  <p className="text-xs text-white/60">
                    {typeof f.prep_recommendations === 'object'
                      ? JSON.stringify(f.prep_recommendations).slice(0, 120) + '...'
                      : String(f.prep_recommendations)}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : null
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RestaurantAnalytics() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [range, setRange] = useState<Range>('30d');
  const [tab, setTab] = useState<AnalyticsTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Live ops (real-time)
  const [live, setLive] = useState<LiveOps>({ tablesOccupied: 0, totalTables: 0, activeOrders: 0, slowAlerts: 0, argileSessions: 0 });
  // Today KPIs
  const [today, setToday] = useState<TodayKPI>({ revenue: 0, covers: 0, avgCheck: 0, argileRevenue: 0, topDish: '—', avgRating: 0 });
  // ML outputs
  const [history, setHistory] = useState<DailyRevenue[]>([]);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyPattern[]>([]);
  const [velocities, setVelocities] = useState<ItemVelocity[]>([]);
  const [insights, setInsights] = useState<MLInsight[]>([]);
  // Waiter leaderboard + feedback
  const [waiters, setWaiters] = useState<WaiterPerformanceStats[]>([]);
  const [feedback, setFeedback] = useState<TableFeedback[]>([]);

  const load = useCallback(async (showRefresh = false) => {
    if (!tenantId) return;
    if (showRefresh) setRefreshing(true); else setLoading(true);

    try {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceISO = since.toISOString();
      const todayISO = new Date().toISOString().split('T')[0]!;

      const [tablesRes, ordersRes, argileRes, itemsRes, feedbackRes, slowRes] = await Promise.all([
        supabase.from('restaurant_tables').select('id, status').eq('tenant_id', tenantId),
        supabase.from('table_orders').select('id, status, opened_at, closed_at, paid_at, waiter_id, tip_amount_usd, discount_pct, service_charge_pct, vat_pct').eq('tenant_id', tenantId).gte('opened_at', sinceISO),
        supabase.from('restaurant_argile_sessions').select('id, base_price_usd, refill_price_usd, refill_count:tobacco_refill_count, opened_at').eq('tenant_id', tenantId).gte('opened_at', sinceISO),
        supabase.from('restaurant_order_items').select('order_id, product_name, unit_price, quantity, sent_at').eq('tenant_id', tenantId).gte('sent_at', sinceISO).not('sent_at', 'is', null),
        supabase.from('restaurant_table_feedback').select('*').eq('tenant_id', tenantId).gte('submitted_at', `${todayISO}T00:00:00`).order('submitted_at', { ascending: false }).limit(10),
        supabase.from('restaurant_slow_alerts').select('id').eq('tenant_id', tenantId).is('resolved_at', null),
      ]);

      const tables = tablesRes.data ?? [];
      const orders = ordersRes.data ?? [];
      const argileSessions = argileRes.data ?? [];
      const orderItems = itemsRes.data ?? [];
      const fb = feedbackRes.data ?? [];

      // ── Live ops ────────────────────────────────────────────────────────
      setLive({
        tablesOccupied: tables.filter((tb) => tb.status === 'occupied').length,
        totalTables: tables.length,
        activeOrders: orders.filter((o) => o.status === 'open').length,
        slowAlerts: slowRes.data?.length ?? 0,
        argileSessions: argileSessions.filter((a) => {
          const opened = new Date(a.opened_at);
          return opened.toISOString().startsWith(todayISO);
        }).length,
      });

      // ── Today KPIs ──────────────────────────────────────────────────────
      const todayOrders = orders.filter((o) => o.status === 'paid' && o.paid_at?.startsWith(todayISO));
      const todayItems = orderItems.filter((i) => i.sent_at?.startsWith(todayISO));
      const todayRevenue = todayItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const todayArgile = argileSessions
        .filter((a) => a.opened_at.startsWith(todayISO))
        .reduce((s, a) => s + (a.base_price_usd ?? 0) + (a.refill_price_usd ?? 0) * (a.refill_count ?? 0), 0);
      const avgCheck = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;

      // Top dish by quantity
      const dishQty = new Map<string, number>();
      for (const item of todayItems) {
        dishQty.set(item.product_name, (dishQty.get(item.product_name) ?? 0) + item.quantity);
      }
      const topDish = [...dishQty.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      const avgRating = fb.length > 0
        ? fb.reduce((s: number, f: TableFeedback) => s + ((f as { overall_rating?: number }).overall_rating ?? 0), 0) / fb.length
        : 0;

      setToday({ revenue: todayRevenue, covers: todayOrders.length, avgCheck, argileRevenue: todayArgile, topDish, avgRating });
      setFeedback(fb as TableFeedback[]);

      // ── Build daily revenue history for ML ──────────────────────────────
      const dailyMap = new Map<string, { usd: number; orders: number }>();
      for (const order of orders.filter((o) => o.status === 'paid' && o.paid_at)) {
        const day = order.paid_at!.slice(0, 10);
        const dayItems = orderItems.filter((i) => i.order_id === order.id);
        const rev = dayItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const prev = dailyMap.get(day) ?? { usd: 0, orders: 0 };
        dailyMap.set(day, { usd: prev.usd + rev, orders: prev.orders + 1 });
      }

      const dailyHistory: DailyRevenue[] = [...dailyMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { usd, orders: cnt }]) => ({
          date,
          dayOfWeek: new Date(date).getDay(),
          totalUsd: usd,
          orderCount: cnt,
          avgCheck: cnt > 0 ? usd / cnt : 0,
        }));

      setHistory(dailyHistory);

      // ── ML computations ─────────────────────────────────────────────────
      const fc = generateForecast(dailyHistory, 7);
      setForecast(fc);
      setWeeklyPattern(analyzeWeeklyPattern(dailyHistory));

      // Item velocity
      const itemVelInput = orderItems.map((i) => ({
        name: i.product_name,
        date: i.sent_at ?? new Date().toISOString(),
        qty: i.quantity,
      }));
      const vels = computeItemVelocity(itemVelInput);
      setVelocities(vels);

      // Argile revenue %
      const totalRevenue = dailyHistory.reduce((s, d) => s + d.totalUsd, 0);
      const totalArgileRev = argileSessions.reduce((s, a) => s + (a.base_price_usd ?? 0) + (a.refill_price_usd ?? 0) * (a.refill_count ?? 0), 0);
      const argileRevPct = totalRevenue > 0 ? totalArgileRev / (totalRevenue + totalArgileRev) : 0;

      // Tip rate (crude: tip / subtotal)
      const paidOrdFull = orders.filter((o) => o.status === 'paid');
      const tipRevs = paidOrdFull.map((o) => {
        const items = orderItems.filter((i) => i.order_id === o.id);
        const sub = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        return { tip: o.tip_amount_usd ?? 0, sub };
      });
      const avgTip = tipRevs.length > 0 ? tipRevs.reduce((s, r) => s + (r.sub > 0 ? r.tip / r.sub : 0), 0) / tipRevs.length : 0;
      const prevTip = avgTip * 0.9; // placeholder; ideally compare prior period

      const generatedInsights = generateInsights({
        pattern: analyzeWeeklyPattern(dailyHistory),
        forecast: fc,
        velocities: vels,
        avgTipRate: avgTip,
        prevAvgTipRate: prevTip,
        argileRevenuePct: argileRevPct,
      });
      setInsights(generatedInsights);

      // Waiter leaderboard
      const waiterMap = new Map<string, WaiterPerformanceStats>();
      for (const order of paidOrdFull) {
        if (!order.waiter_id) continue;
        const items = orderItems.filter((i) => i.order_id === order.id);
        const rev = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
        const existing = waiterMap.get(order.waiter_id);
        if (existing) {
          existing.tables_served += 1;
          existing.total_revenue += rev;
          existing.avg_ticket = existing.total_revenue / existing.tables_served;
        } else {
          waiterMap.set(order.waiter_id, {
            employee_id: order.waiter_id as string,
            employee_name: `Staff ${(order.waiter_id as string).slice(0, 6)}`,
            tables_served: 1,
            total_revenue: rev,
            avg_ticket: rev,
            avg_rating: 0,
            avg_service_minutes: 20,
            period_score: 0,
          });
        }
      }
      setWaiters([...waiterMap.values()]);

    } catch (err) {
      console.error('[RestaurantAnalytics] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId, range]);

  useEffect(() => { void load(); }, [load]);

  // ── Chart data ─────────────────────────────────────────────────────────────

  // Combine history + forecast for the trend chart
  const trendData = [
    ...history.slice(-14).map((d) => ({
      date: d.date.slice(5), // MM-DD
      actual: d.totalUsd,
      predicted: undefined as number | undefined,
      lower: undefined as number | undefined,
      upper: undefined as number | undefined,
    })),
    ...forecast.map((f) => ({
      date: f.date.slice(5),
      actual: undefined as number | undefined,
      predicted: f.predicted,
      lower: f.lower,
      upper: f.upper,
    })),
  ];

  const dowData = weeklyPattern.map((p) => ({
    day: p.label,
    revenue: Math.round(p.avgRevenue * 100) / 100,
    index: Math.round(p.indexVsWeekAvg * 100),
  }));

  const ranked = rankWaiters(waiters);
  const todayIsRamadan = isRamadan(new Date());

  // Next 7-day forecast summary from Holt
  const revSeries = history.map((d) => d.totalUsd);
  const weekForecast = revSeries.length > 0 ? holtSmoothing(revSeries, 0.3, 0.1, 7).forecast : [];
  const forecastWeekTotal = weekForecast.reduce((s, v) => s + v, 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/30 to-yellow-500/10">
              <BarChart2 className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                {t('restaurant.analytics.title', 'Restaurant Analytics')}
                <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                  <Brain className="h-3 w-3" /> ML
                </span>
              </h1>
              <p className="text-xs text-white/40">
                {new Date().toLocaleDateString('en-LB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {todayIsRamadan && <span className="ml-2 text-amber-400">🌙 Ramadan</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Range selector */}
            <div className="relative">
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as Range)}
                className="appearance-none rounded-xl border border-white/20 bg-slate-800 pl-3 pr-8 py-2 text-xs text-white focus:outline-none"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            </div>
            <button
              onClick={() => { void load(true); }}
              disabled={refreshing}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-white/10">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'forecast', label: 'Forecast', icon: '📈' },
            { id: 'matrix', label: 'Menu Matrix', icon: '🧮' },
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id as AnalyticsTab)}
              className={`px-4 py-2.5 text-xs font-semibold transition-all relative flex items-center gap-1.5 ${
                tab === tabItem.id
                  ? 'text-amber-400'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              {tabItem.icon} {tabItem.label}
              {tab === tabItem.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-yellow-400" />
              )}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB CONTENT */}
        {tab === 'overview' && (
          <>

        {/* Live ops strip */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3">
            {t('restaurant.analytics.live', 'Live Operations')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Tables', value: `${live.tablesOccupied}/${live.totalTables}`, icon: Users, color: 'from-sky-500/20 to-sky-500/5', iconColor: 'text-sky-400' },
              { label: 'Active Orders', value: live.activeOrders, icon: Clock, color: 'from-amber-500/20 to-yellow-500/5', iconColor: 'text-amber-400' },
              { label: 'Slow Alerts', value: live.slowAlerts, icon: AlertCircle, color: live.slowAlerts > 0 ? 'from-red-500/20 to-red-500/5' : 'from-white/8 to-white/3', iconColor: live.slowAlerts > 0 ? 'text-red-400' : 'text-white/30' },
              { label: 'Argile Active', value: live.argileSessions, icon: Flame, color: 'from-orange-500/20 to-orange-500/5', iconColor: 'text-orange-400' },
              { label: '7d Forecast', value: `$${Math.round(forecastWeekTotal)}`, icon: TrendingUp, color: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-400' },
            ].map(({ label, value, icon: Icon, color, iconColor }) => (
              <div key={label} className={`backdrop-blur-md bg-gradient-to-br ${color} border border-white/10 rounded-2xl shadow-2xl p-4`}>
                <div className={`inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br mb-2 ${color}`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <p className="text-xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">{value}</p>
                <p className="text-[10px] text-white/50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Today KPIs */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3">Today</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Revenue', value: `$${today.revenue.toFixed(2)}` },
              { label: 'Covers', value: today.covers },
              { label: 'Avg Check', value: `$${today.avgCheck.toFixed(2)}` },
              { label: 'Argile Revenue', value: `$${today.argileRevenue.toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-xl p-4">
                <p className="text-xs text-white/40 mb-1">{label}</p>
                <p className="text-2xl font-black bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">{value}</p>
              </div>
            ))}
          </div>
          {today.topDish !== '—' && (
            <p className="mt-2 text-xs text-white/40">
              🏆 Top dish today: <span className="text-white/70 font-medium">{today.topDish}</span>
              {today.avgRating > 0 && (
                <span className="ml-3">⭐ {today.avgRating.toFixed(1)} avg rating</span>
              )}
            </p>
          )}
        </section>

        {/* Revenue trend + 7-day forecast */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
              Revenue Trend + Forecast
            </h2>
            <span className="text-[9px] text-white/30 bg-white/5 rounded-lg px-2 py-0.5">
              Holt double-smoothing · 80% CI
            </span>
          </div>
          <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-4 h-64">
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/30 text-sm">
                No historical data yet — revenue will appear here after your first closed orders.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData}>
                  <defs>
                    <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
                  <Tooltip content={<AmberTooltip />} />
                  {/* Confidence band */}
                  <Area dataKey="upper" stroke="none" fill="url(#fcGrad)" legendType="none" name="Upper CI" />
                  <Area dataKey="lower" stroke="none" fill="#0f172a" legendType="none" name="Lower CI" />
                  {/* Actual */}
                  <Line dataKey="actual" stroke="#f59e0b" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
                  {/* Forecast */}
                  <Line dataKey="predicted" stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Forecast" connectNulls={false} />
                  {/* Today marker */}
                  <ReferenceLine x={new Date().toISOString().slice(5, 10)} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 2" label={{ value: 'Today', fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[10px] text-white/40">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-amber-400 inline-block" /> Actual revenue</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-violet-400 inline-block" style={{ borderTop: '2px dashed' }} /> 7-day forecast</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-4 bg-amber-500/10 inline-block rounded-sm" /> 80% confidence band</span>
          </div>
        </section>

        {/* Weekly DOW pattern */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">Weekly Pattern</h2>
            <span className="text-[9px] text-white/30 bg-white/5 rounded-lg px-2 py-0.5">Thu/Fri peaks · Lebanese DOW</span>
          </div>
          <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-4 h-48">
            {dowData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/30 text-sm">Insufficient history for pattern analysis.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <Tooltip content={<AmberTooltip />} />
                  <ReferenceLine y={dowData.reduce((s, d) => s + d.revenue, 0) / (dowData.filter((d) => d.revenue > 0).length || 1)} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 2" />
                  <Bar dataKey="revenue" name="Avg Revenue" radius={[6, 6, 0, 0]}
                    fill="#f59e0b"
                    className="cursor-default"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* ML Insights */}
        {insights.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3 flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> AI Insights
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Menu velocity */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3">Menu Velocity</h2>
          {velocities.length === 0 ? (
            <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-xl p-8 text-center text-white/30 text-sm">
              No item data yet for the selected period.
            </div>
          ) : (
            <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/30">Item</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/30">Last 7d</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/30">Prev 7d</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/30">Trend</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/30">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {velocities.slice(0, 10).map((item, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 font-medium text-white/80 max-w-[180px] truncate">{item.name}</td>
                        <td className="px-4 py-3 text-right text-white/60">{item.last7DayQty}</td>
                        <td className="px-4 py-3 text-right text-white/40">{item.prev7DayQty}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={item.trend > 0 ? 'text-emerald-400' : item.trend < 0 ? 'text-red-400' : 'text-white/40'}>
                            {item.trend > 0 ? '+' : ''}{Math.round(item.trend * 100)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                            item.alert === 'rising' ? 'bg-emerald-500/20 text-emerald-400'
                              : item.alert === 'falling' ? 'bg-red-500/20 text-red-400'
                                : 'bg-white/5 text-white/30'
                          }`}>
                            {item.alert === 'rising' ? '↑ Rising' : item.alert === 'falling' ? '↓ Falling' : 'Stable'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Waiter leaderboard */}
        {ranked.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3">Staff Leaderboard</h2>
            <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/30">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/30">Staff</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/30">Tables</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/30">Revenue</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-white/30">Avg Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 5).map((w, i) => (
                    <tr key={w.employee_id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-white/40">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</td>
                      <td className="px-4 py-3 font-medium text-white/80">{w.employee_name}</td>
                      <td className="px-4 py-3 text-right text-white/60">{w.tables_served}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-400">${w.total_revenue.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-white/50">${w.avg_ticket.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Recent feedback */}
        {feedback.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-3">Today's Guest Feedback</h2>
            <div className="space-y-2">
              {feedback.slice(0, 5).map((f: TableFeedback, i: number) => (
                <div key={i} className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-xl shadow-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Table {(f as { table_number?: number }).table_number ?? '?'}</p>
                    {(f as { comment?: string }).comment && (
                      <p className="text-xs text-white/40 mt-0.5 italic">"{(f as { comment?: string }).comment}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    <span className="text-sm font-bold">{(f as { overall_rating?: number }).overall_rating?.toFixed(1) ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
          </>
        )}

        {/* FORECAST TAB */}
        {tab === 'forecast' && (
          <ForecastTab tenantId={tenantId} />
        )}

      </div>
    </Layout>
  );
}
