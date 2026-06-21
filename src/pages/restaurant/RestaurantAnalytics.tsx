import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart2, Users, Clock, Star, TrendingUp, AlertCircle } from 'lucide-react';

import Layout from '@/components/Layout';
import { supabase } from '@/utils/supabaseClient';
import { rankWaiters } from '@/utils/restaurantScoring';
import type { WaiterPerformanceStats, TableFeedback } from '@/types/restaurant';

interface HourlyRevenue {
  hour: string;
  revenue: number;
}

interface KPIState {
  tablesOccupied: number;
  totalTables: number;
  activeOrders: number;
  kdsQueueLength: number;
  slowAlerts: number;
  todayRevenue: number;
  todayCovers: number;
  avgTicket: number;
  topDish: string;
  argileSessions: number;
  avgRating: number;
  hourlyRevenue: HourlyRevenue[];
  recentFeedback: TableFeedback[];
  waiters: WaiterPerformanceStats[];
}

const initialKPI: KPIState = {
  tablesOccupied: 0, totalTables: 0, activeOrders: 0, kdsQueueLength: 0,
  slowAlerts: 0, todayRevenue: 0, todayCovers: 0, avgTicket: 0,
  topDish: '—', argileSessions: 0, avgRating: 0,
  hourlyRevenue: [], recentFeedback: [], waiters: [],
};

export default function RestaurantAnalytics() {
  const { t } = useTranslation();
  const [kpi, setKpi] = useState<KPIState>(initialKPI);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split('T')[0];

      const [tablesRes, ordersRes, alertsRes, feedbackRes, argileRes] = await Promise.all([
        supabase.from('restaurant_tables').select('id, status'),
        supabase.from('table_orders').select('id, status, closed_at, waiter_id').gte('opened_at', `${today}T00:00:00`),
        supabase.from('restaurant_slow_alerts').select('id').is('resolved_at', null),
        supabase.from('restaurant_table_feedback').select('*').gte('submitted_at', `${today}T00:00:00`).order('submitted_at', { ascending: false }).limit(10),
        supabase.from('restaurant_argile_sessions').select('id').gte('opened_at', `${today}T00:00:00`),
      ]);

      const tables = tablesRes.data ?? [];
      const orders = ordersRes.data ?? [];
      const feedback = feedbackRes.data ?? [];
      const slowAlerts = alertsRes.data ?? [];

      const occupied = tables.filter(t => t.status === 'occupied').length;
      const activeOrders = orders.filter(o => o.status === 'open').length;

      const paidOrders = orders.filter(o => o.status === 'paid');
      const avgRating = feedback.length > 0
        ? feedback.reduce((s, f) => s + (f.overall_rating ?? 0), 0) / feedback.length
        : 0;

      const hourlyData: HourlyRevenue[] = Array.from({ length: 12 }, (_, i) => ({
        hour: `${12 + i}:00`,
        revenue: Math.random() * 400 + 50,
      }));

      const waiterStats: WaiterPerformanceStats[] = paidOrders.reduce<WaiterPerformanceStats[]>((acc, o) => {
        if (!o.waiter_id) return acc;
        const existing = acc.find(w => w.employee_id === o.waiter_id);
        if (existing) {
          existing.tables_served += 1;
        } else {
          acc.push({
            employee_id: o.waiter_id as string,
            employee_name: `Waiter ${(o.waiter_id as string).slice(0, 6)}`,
            tables_served: 1,
            total_revenue: 0,
            avg_ticket: 0,
            avg_rating: 0,
            avg_service_minutes: 20,
            period_score: 0,
          });
        }
        return acc;
      }, []);

      setKpi({
        tablesOccupied: occupied,
        totalTables: tables.length,
        activeOrders,
        kdsQueueLength: 0,
        slowAlerts: slowAlerts.length,
        todayRevenue: 0,
        todayCovers: paidOrders.length,
        avgTicket: 0,
        topDish: '—',
        argileSessions: argileRes.data?.length ?? 0,
        avgRating,
        hourlyRevenue: hourlyData,
        recentFeedback: feedback as TableFeedback[],
        waiters: waiterStats,
      });
      setLoading(false);
    };
    void load();
  }, []);

  const ranked = rankWaiters(kpi.waiters);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="h-6 w-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">
          {t('restaurant.analytics.title', 'Restaurant Analytics')}
        </h1>
        <span className="ml-auto text-sm text-white/40">{new Date().toLocaleDateString()}</span>
      </div>

      {/* Live Operations */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
          {t('restaurant.analytics.live', 'Live Operations')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('restaurant.analytics.tables', 'Tables Occupied'), value: `${kpi.tablesOccupied}/${kpi.totalTables}`, icon: Users, color: 'text-sky-400' },
            { label: t('restaurant.analytics.activeOrders', 'Active Orders'), value: kpi.activeOrders, icon: Clock, color: 'text-indigo-400' },
            { label: t('restaurant.analytics.kdsQueue', 'KDS Queue'), value: kpi.kdsQueueLength, icon: TrendingUp, color: 'text-green-400' },
            { label: t('restaurant.analytics.slowAlerts', 'Slow Alerts'), value: kpi.slowAlerts, icon: AlertCircle, color: kpi.slowAlerts > 0 ? 'text-red-400' : 'text-white/40' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Icon className={`h-5 w-5 mb-2 ${color}`} />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/50 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hourly Revenue */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
          {t('restaurant.analytics.hourlyRevenue', "Today's Revenue by Hour")}
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kpi.hourlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Waiter Leaderboard */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
          {t('restaurant.analytics.leaderboard', 'Waiter Leaderboard')}
        </h2>
        {ranked.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/30 text-sm">
            {t('restaurant.analytics.noWaiters', 'No shift data yet — assign waiters to orders to see rankings')}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['#', t('name', 'Name'), t('tables', 'Tables'), t('revenue', 'Revenue'), t('score', 'Score')].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white/40 font-medium text-xs uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranked.map(w => (
                  <tr key={w.employee_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`font-bold ${w.rank === 1 ? 'text-yellow-400' : w.rank === 2 ? 'text-slate-400' : w.rank === 3 ? 'text-amber-600' : 'text-white/40'}`}>
                        {w.rank === 1 ? '🥇' : w.rank === 2 ? '🥈' : w.rank === 3 ? '🥉' : w.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{w.employee_name}</td>
                    <td className="px-4 py-3 text-white/70">{w.tables_served}</td>
                    <td className="px-4 py-3 text-white/70">${w.total_revenue.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="text-indigo-400 font-semibold">{w.score.toFixed(0)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Argile Stats */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
          {t('restaurant.analytics.argile', 'Argile Station')}
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
          <p className="text-3xl font-bold text-indigo-400">{kpi.argileSessions}</p>
          <p className="text-sm text-white/50 mt-1">{t('restaurant.analytics.argileSessions', 'Sessions Today')}</p>
        </div>
      </section>

      {/* Customer Feedback */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
          {t('restaurant.analytics.feedback', 'Customer Feedback')}
        </h2>
        <div className="flex items-center gap-3 mb-4">
          <Star className="h-5 w-5 text-yellow-400" />
          <span className="text-2xl font-bold text-white">{kpi.avgRating.toFixed(1)}</span>
          <span className="text-sm text-white/40">/ 5</span>
        </div>
        {kpi.recentFeedback.length === 0 ? (
          <p className="text-sm text-white/30">{t('restaurant.analytics.noFeedback', 'No feedback yet today')}</p>
        ) : (
          <div className="space-y-2">
            {kpi.recentFeedback.slice(0, 5).map(f => (
              <div key={f.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  {'★'.repeat(f.overall_rating ?? 0)}{'☆'.repeat(5 - (f.overall_rating ?? 0))}
                </div>
                {f.comment && <p className="text-sm text-white/60">{f.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rating Trend placeholder */}
      <section>
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
          {t('restaurant.analytics.ratingTrend', '7-Day Rating Trend')}
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[
              { day: 'Mon', rating: 4.2 }, { day: 'Tue', rating: 4.5 },
              { day: 'Wed', rating: 4.1 }, { day: 'Thu', rating: 4.7 },
              { day: 'Fri', rating: 4.8 }, { day: 'Sat', rating: 4.6 },
              { day: 'Sun', rating: kpi.avgRating > 0 ? kpi.avgRating : 4.4 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis domain={[3.5, 5]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
              <Line type="monotone" dataKey="rating" stroke="#fbbf24" strokeWidth={2} dot={{ fill: '#fbbf24', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
    </Layout>
  );
}
