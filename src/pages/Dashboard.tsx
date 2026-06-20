import {
  AlertTriangle,
  DollarSign,
  Package,
  Percent,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import AIInsightCard from '@/components/dashboard/AIInsightCard';
import KPICard from '@/components/dashboard/KPICard';
import LiveActivityFeed from '@/components/dashboard/LiveActivityFeed';
import QuickActions from '@/components/dashboard/QuickActions';
import RevenueChart from '@/components/dashboard/RevenueChart';
import SalesByHourChart from '@/components/dashboard/SalesByHourChart';
import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { useIndustry } from '@/context/IndustryContext';
import { INDUSTRY_CONFIGS } from '@/types/industry';

const ROLE_REDIRECT: Partial<Record<string, string>> = {
  cashier: '/pos',
  stockkeeper: '/inventory',
  accountant: '/reports',
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { products, sales, customers, currentEmployee, currentTenant, loading } = useApp();
  const { industry } = useIndustry();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !currentTenant) return;
    if (location.pathname !== '/dashboard') return;
    const target = ROLE_REDIRECT[currentTenant.userRole];
    if (target) void navigate(target, { replace: true });
  }, [currentTenant, loading, navigate, location.pathname]);

  const now = useMemo(() => new Date(), []);
  const today = now.toDateString();

  const todaySales = useMemo(
    () => sales.filter((s) => new Date(s.date).toDateString() === today),
    [sales, today],
  );

  const todayRevenue = useMemo(
    () => todaySales.reduce((sum, s) => sum + s.total, 0),
    [todaySales],
  );

  const todayProfit = useMemo(
    () =>
      todaySales.reduce(
        (sum, s) =>
          sum +
          s.items.reduce((iSum, item) => iSum + (item.price - item.cost) * item.quantity, 0),
        0,
      ),
    [todaySales],
  );

  const totalProducts = useMemo(
    () => products.reduce((acc, p) => acc + (p.variants?.length ?? 0), 0),
    [products],
  );

  const lowStockItems = useMemo(
    () =>
      products.reduce(
        (acc, p) =>
          acc + (p.variants ?? []).filter((v) => v.stock > 0 && v.stock <= v.reorderLevel).length,
        0,
      ),
    [products],
  );

  const totalCustomers = customers.length;
  const grossMarginPct = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return t('dashboard.goodMorning', 'Good morning');
    if (h < 17) return t('dashboard.goodAfternoon', 'Good afternoon');
    return t('dashboard.goodEvening', 'Good evening');
  }, [now, t]);

  return (
    <Layout>
      <div className="space-y-8 pb-20 lg:pb-8">
        {/* Hero Header */}
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/20 via-slate-800/80 to-slate-900 p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 0% 0%, rgba(99,102,241,0.2) 0%, transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(168,85,247,0.15) 0%, transparent 60%)',
            }}
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-green-400">
                  {t('dashboard.systemActive', 'System Active')}
                </p>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                {greeting},{' '}
                <span className="text-indigo-300">
                  {currentEmployee?.name ?? currentTenant?.name ?? 'Operator'}
                </span>
              </h1>
              <p className="mt-1 text-sm text-white/60">
                {currentTenant?.name ?? t('dashboard.yourBusiness', 'Your Business')}
                {todaySales.length > 0 && (
                  <>
                    {' · '}
                    {todaySales.length}{' '}
                    {t('dashboard.transactionsToday', 'transactions today')}
                    {' · '}
                    <span dir="ltr">${todayRevenue.toFixed(2)}</span>
                    {' '}
                    {t('dashboard.inRevenue', 'in revenue')}
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-end">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">
                {t('dashboard.today', 'Today')}
              </p>
              <p className="text-base font-semibold text-white">
                {now.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-xs text-white/50" dir="ltr">
                {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </section>

        {/* KPI Bento Grid */}
        <section>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            <KPICard
              title={t('dashboard.todayRevenue', "Today's Revenue")}
              numericValue={todayRevenue}
              format={(v) => `$${v.toFixed(2)}`}
              subtitle={`${todaySales.length} ${t('pos.transactions', 'transactions')}`}
              icon={DollarSign}
              gradient={['#6366f1', '#818cf8']}
              link="/reports"
              testId="total-revenue"
            />
            <KPICard
              title={t('dashboard.totalProducts', 'Total Products')}
              numericValue={totalProducts}
              format={(v) => Math.round(v).toLocaleString()}
              subtitle={t('dashboard.variants', 'variants')}
              icon={Package}
              gradient={['#06b6d4', '#22d3ee']}
              link="/inventory"
              testId="total-products"
            />
            <KPICard
              title={t('customers.title', 'Customers')}
              numericValue={totalCustomers}
              format={(v) => Math.round(v).toLocaleString()}
              subtitle={t('dashboard.registeredCustomers', 'registered')}
              icon={Users}
              gradient={['#a855f7', '#c084fc']}
              link="/customers"
              testId="total-customers"
            />
            <KPICard
              title={t('dashboard.todaysProfit', "Today's Profit")}
              numericValue={todayProfit}
              format={(v) => `$${v.toFixed(2)}`}
              subtitle={t('dashboard.grossProfit', 'gross profit')}
              icon={TrendingUp}
              gradient={['#10b981', '#34d399']}
              link="/reports"
              testId="total-orders"
            />
            <KPICard
              title={t('dashboard.grossMargin', 'Gross Margin')}
              numericValue={grossMarginPct}
              format={(v) => `${v.toFixed(1)}%`}
              subtitle={t('dashboard.margin', 'margin')}
              icon={Percent}
              gradient={['#f59e0b', '#fbbf24']}
              link="/reports"
            />
            <KPICard
              title={t('dashboard.lowStockAlerts', 'Low Stock Alerts')}
              numericValue={lowStockItems}
              format={(v) => Math.round(v).toLocaleString()}
              subtitle={t('dashboard.variantsBelowReorder', 'below reorder point')}
              icon={AlertTriangle}
              gradient={lowStockItems > 0 ? ['#ef4444', '#f87171'] : ['#475569', '#64748b']}
              link="/inventory"
            />
          </div>
        </section>

        {/* Low Stock Banner */}
        {lowStockItems > 0 && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <p className="text-sm font-semibold uppercase tracking-[0.15em]">
                  {t('dashboard.lowStockAlert', 'Low Stock Alert')}
                </p>
              </div>
              <p className="text-sm text-white/70">
                {lowStockItems}{' '}
                {t('dashboard.variantsNeedRestocking', 'variant(s) need restocking.')}{' '}
                <Link to="/inventory" className="text-amber-400 underline">
                  {t('dashboard.reviewInventory', 'Review inventory')}
                </Link>
              </p>
            </div>
          </section>
        )}

        {/* Vertical Mode Card — shown when industry is configured */}
        {industry && (() => {
          const cfg = INDUSTRY_CONFIGS.find((c) => c.key === industry);
          if (!cfg) return null;
          return (
            <section className={`rounded-2xl border bg-gradient-to-br ${cfg.gradient} ${cfg.borderColor} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">{cfg.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                      {t('dashboard.industryMode', 'Industry Mode')}
                    </p>
                    <p className="text-base font-bold text-white">
                      {t(cfg.labelKey, cfg.labelFallback)}
                    </p>
                    <p className="text-xs text-white/60">
                      {t(cfg.descriptionKey, cfg.descriptionFallback)}
                    </p>
                  </div>
                </div>
                <Link
                  to="/system-settings"
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                >
                  {t('dashboard.changeIndustry', 'Change Industry')}
                </Link>
              </div>
            </section>
          );
        })()}

        {/* Charts Row */}
        <section className="grid gap-4 lg:grid-cols-2">
          <RevenueChart sales={sales} />
          <SalesByHourChart sales={sales} />
        </section>

        {/* Activity Feed + AI Insights */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LiveActivityFeed sales={sales} />
          </div>
          <AIInsightCard sales={sales} products={products} />
        </section>

        {/* Quick Actions */}
        <section>
          <QuickActions />
        </section>
      </div>
    </Layout>
  );
}
