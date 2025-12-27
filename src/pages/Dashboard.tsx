import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  ShoppingCart,
  Users,
  UserCircle,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';
import { getCurrentUserTenant } from '../utils/tenantManager';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { products, sales, customers, currentEmployee, setCurrentTenant } = useApp();
  const [checkingTenants, setCheckingTenants] = useState(true);

  // Check if user has tenants and load context
  useEffect(() => {
    let cancelled = false;
    const checkUserTenants = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !cancelled) {
        const { data: tenants } = await supabase
          .from('tenant_user_details')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('user_active', true)
          .eq('tenant_active', true);

        if (cancelled) return;

        if (!tenants || tenants.length === 0) {
          navigate('/select-tenant');
          return;
        }

        // Set current tenant context from the first tenant found
        if (tenants && tenants.length > 0) {
          const firstTenant = tenants[0];
          const tenantObj = {
            id: firstTenant.tenant_id,
            name: firstTenant.tenant_name,
            slug: firstTenant.tenant_slug,
            userRole: firstTenant.user_role,
            settings: firstTenant.settings || {}
          };
          setCurrentTenant(tenantObj);
        }
      }
      if (!cancelled) {
        setCheckingTenants(false);
      }
    };
    checkUserTenants();
    return () => {
      cancelled = true;
    };
  }, [navigate, setCurrentTenant]);

  if (checkingTenants) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>;
  }

  const totalProducts = products?.reduce((acc, p) => acc + (p.variants?.length || 0), 0) || 0;
  const totalStock = products?.reduce(
    (acc, p) => acc + (p.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0),
    0,
  ) || 0;
  const lowStockItems = products?.reduce(
    (acc, p) => acc + (p.variants?.filter((v) => v.stock <= v.reorderLevel).length || 0),
    0,
  ) || 0;

  const todaySales = sales?.filter((s) => {
    const today = new Date().toDateString();
    return new Date(s.date).toDateString() === today;
  }) || [];

  const todayRevenue = todaySales?.reduce((acc, s) => acc + s.total, 0) || 0;
  const todayProfit = todaySales?.reduce(
    (acc, s) =>
      acc + s.items?.reduce((sum, item) => sum + (item.price - item.cost) * item.quantity, 0),
    0,
  ) || 0;

  const totalCustomers = customers?.length || 0;
  const customersWithDebt = customers?.filter((c) => c.debtBalance > 0).length || 0;

  const quickStats = [
    {
      title: t('dashboard.totalProducts', 'Total Products'),
      value: totalProducts,
      subtitle: `${totalStock} ${t('inventory.unitsInStock', 'units in stock')}`,
      icon: Package,
      accent: 'from-blue-500/75 to-cyan-400/50',
      link: '/inventory',
    },
    {
      title: t('dashboard.todaysSales', "Today's Sales"),
      value: `$${todayRevenue.toFixed(2)}`,
      subtitle: `${todaySales.length} ${t('pos.transactions', 'transactions')}`,
      icon: ShoppingCart,
      accent: 'from-emerald-500/70 to-lime-400/50',
      link: '/pos',
    },
    {
      title: t('customers.title', 'Customers'),
      value: totalCustomers,
      subtitle: `${customersWithDebt} ${t('customers.withDebt', 'with debt')}`,
      icon: Users,
      accent: 'from-purple-500/70 to-pink-400/50',
      link: '/customers',
    },
    {
      title: t('dashboard.todaysProfit', "Today's Profit"),
      value: `$${todayProfit.toFixed(2)}`,
      subtitle: `${((todayProfit / todayRevenue) * 100 || 0).toFixed(1)}% ${t('dashboard.margin', 'margin')}`,
      icon: TrendingUp,
      accent: 'from-amber-500/70 to-orange-400/50',
      link: '/reports',
    },
  ];

  const quickActions = [
    { title: t('dashboard.newOrder', 'New Sale'), icon: ShoppingCart, link: '/pos', accent: 'from-green-500 to-emerald-400' },
    { title: t('dashboard.addProduct', 'Add Product'), icon: Package, link: '/inventory', accent: 'from-blue-600 to-indigo-500' },
    { title: t('dashboard.viewReports', 'View Reports'), icon: BarChart3, link: '/reports', accent: 'from-purple-600 to-fuchsia-500' },
    { title: t('employees.manageTeam', 'Manage Team'), icon: UserCircle, link: '/employees', accent: 'from-slate-700 to-slate-500' },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="stat-chip bg-white/10 text-white/80">Executive command</p>
              <h1 className="mt-3 text-3xl font-semibold">
                Welcome back, {currentEmployee?.name ?? 'Operator'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Swap this paragraph with your daily leadership note or operations creed. Everything
                here is optimized for touch, so you can run the business from anywhere.
              </p>
            </div>
            <div className="rounded-3xl border border-white/25 bg-white/10 px-6 py-4 text-center text-white/90">
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Today</p>
              <p className="text-lg font-semibold">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((stat) => (
            <Link
              key={stat.title}
              to={stat.link}
              className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg shadow-slate-900/5 text-white"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.accent}`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/70">{stat.title}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
              <p className="text-sm text-white/80">{stat.subtitle}</p>
            </Link>
          ))}
        </section>

        {lowStockItems > 0 && (
          <section className="glass-panel border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm font-semibold uppercase tracking-[0.2em]">
                  Low stock detected
                </p>
              </div>
              <p className="text-sm text-slate-700">
                {lowStockItems} variant{lowStockItems > 1 ? 's are' : ' is'} approaching the reorder
                threshold.{' '}
                <Link to="/inventory" className="text-amber-700 underline">
                  Review inventory
                </Link>
              </p>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm uppercase tracking-[0.3em] text-slate-500">Operator shortcuts</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.link}
                className={`tilt-hover flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br ${action.accent} px-6 py-6 text-white shadow-xl shadow-slate-900/20`}
              >
                <action.icon className="h-7 w-7" />
                <span className="mt-3 text-base font-semibold">{action.title}</span>
                <span className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Tap to open
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="hero-gradient glass-panel p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Live feed</p>
                <h3 className="text-xl font-semibold text-white">Recent Sales</h3>
              </div>
              <Link to="/reports" className="text-sm font-medium text-white/90">
                View all
              </Link>
            </div>
            {todaySales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-white/60">
                <DollarSign className="h-8 w-8 text-white/40" />
                <p className="mt-3 text-sm">No sales yet—keep the scanners ready.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {todaySales.slice(0, 5).map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">Sale #{sale.id}</p>
                      <p className="text-xs text-white/70">
                        {new Date(sale.date).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        ${sale.total.toFixed(2)}
                      </p>
                      <p className="text-xs capitalize text-white/70">{sale.paymentMethod}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hero-gradient glass-panel p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Stock pulse</p>
                <h3 className="text-xl font-semibold text-white">Inventory Overview</h3>
              </div>
              <Link to="/inventory" className="text-sm font-medium text-white/90">
                Manage
              </Link>
            </div>
            <div className="mt-6 space-y-4">
              {products?.slice(0, 5).map((product) => {
                const total = product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
                const isLowStock = product.variants?.some((v) => v.stock <= v.reorderLevel) || false;
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{product.name}</p>
                      <p className="text-xs text-white/70">{product.sku}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLowStock && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      <span
                        className={`text-xs font-semibold ${
                          isLowStock ? 'text-amber-300' : 'text-white/80'
                        }`}
                      >
                        {total} units
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
