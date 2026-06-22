import {
  BarChart3,
  Calendar,
  DollarSign,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalPurchases?: number;
  debtBalance?: number;
  visitCount?: number;
  lastPurchaseDate?: string;
  createdAt?: string;
}

interface Segment {
  id: string;
  name: string;
  customerCount: number;
}

interface CRMAnalyticsProps {
  customers: Customer[];
  segments: Segment[];
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
}

export default function CRMAnalytics({ customers, segments, dateRange, onDateRangeChange: _onDateRangeChange }: CRMAnalyticsProps) {
  const analytics = useMemo(() => {
    const totalCustomers = customers.length;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const newCustomersThisMonth = customers.filter(c => {
      const d = c.createdAt ? new Date(c.createdAt) : null;
      return d && d >= startOfMonth;
    }).length;

    const newCustomersLastMonth = customers.filter(c => {
      const d = c.createdAt ? new Date(c.createdAt) : null;
      return d && d >= startOfLastMonth && d < startOfMonth;
    }).length;

    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0);
    const averageLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    const customersWithRecentPurchase = customers.filter(c => {
      const d = c.lastPurchaseDate ? new Date(c.lastPurchaseDate) : null;
      return d && d >= startOfLastMonth;
    }).length;

    const retentionRate = totalCustomers > 0 ? (customersWithRecentPurchase / totalCustomers) * 100 : 0;

    const totalDebt = customers.reduce((sum, c) => sum + (c.debtBalance || 0), 0);

    const topCustomers = [...customers]
      .sort((a, b) => (b.totalPurchases || 0) - (a.totalPurchases || 0))
      .slice(0, 5);

    const purchaseFrequency = [
      { label: 'One-time', min: 0, max: 1 },
      { label: '2–5 visits', min: 2, max: 5 },
      { label: '6–10 visits', min: 6, max: 10 },
      { label: '10+ visits', min: 11, max: Infinity },
    ].map(range => ({
      ...range,
      count: customers.filter(c => (c.visitCount || 0) >= range.min && (c.visitCount || 0) <= range.max).length,
    }));

    return {
      totalCustomers,
      newCustomersThisMonth,
      newCustomersLastMonth,
      totalRevenue,
      averageLifetimeValue,
      retentionRate,
      totalDebt,
      topCustomers,
      purchaseFrequency,
    };
  }, [customers]);

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const MetricCard = ({
    title,
    value,
    icon: Icon,
    sub,
  }: {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    sub?: string;
  }) => (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
          <Icon className="h-5 w-5 text-white/70" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/60">{title}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-white/50">{sub}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-4 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-medium">CRM Analytics</p>
          <h2 className="mt-1 text-xl font-bold text-white">Customer performance</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Calendar className="h-4 w-4" />
          <span>
            {new Date(dateRange.start).toLocaleDateString()} – {new Date(dateRange.end).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total customers"
          value={analytics.totalCustomers}
          icon={Users}
          sub="In your database"
        />
        <MetricCard
          title="New this month"
          value={analytics.newCustomersThisMonth}
          icon={UserPlus}
          sub={`${analytics.newCustomersLastMonth} last month`}
        />
        <MetricCard
          title="Retention rate"
          value={`${analytics.retentionRate.toFixed(1)}%`}
          icon={Target}
          sub="Purchased within 30 days"
        />
        <MetricCard
          title="Outstanding debt"
          value={fmt(analytics.totalDebt)}
          icon={DollarSign}
          sub="Awaiting collection"
        />
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetricCard
          title="Lifetime revenue"
          value={fmt(analytics.totalRevenue)}
          icon={TrendingUp}
          sub="All-time customer purchases"
        />
        <MetricCard
          title="Avg. customer lifetime value"
          value={fmt(analytics.averageLifetimeValue)}
          icon={BarChart3}
          sub="Revenue ÷ total customers"
        />
      </div>

      {/* Top Customers + Visit Frequency */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">Top customers by revenue</h3>
          {analytics.topCustomers.length === 0 ? (
            <p className="text-sm text-white/50">No customer data yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.topCustomers.map((customer, index) => (
                <div key={customer.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/70">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{customer.name}</p>
                      <p className="text-xs text-white/50">{customer.email || customer.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{fmt(customer.totalPurchases || 0)}</p>
                    <p className="text-xs text-white/50">{customer.visitCount || 0} visits</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">Purchase frequency distribution</h3>
          <div className="space-y-3">
            {analytics.purchaseFrequency.map(range => {
              const pct = analytics.totalCustomers > 0 ? (range.count / analytics.totalCustomers) * 100 : 0;
              return (
                <div key={range.label} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-white/70">{range.label}</span>
                  <div className="flex-1 rounded-full bg-white/10 h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-white/50">{range.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Segments */}
      {segments.length > 0 && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">Segment overview</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {segments.map(seg => (
              <div key={seg.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/60">{seg.name}</p>
                <p className="text-xl font-bold text-white">{seg.customerCount}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
