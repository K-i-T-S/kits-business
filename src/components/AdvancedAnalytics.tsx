import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PieChart,
  Activity,
  DollarSign,
  Users,
  ShoppingCart,
  Package,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart } from 'recharts';

import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Progress } from './ui/progress';

interface KPICard {
  title: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  target?: number;
  unit?: string;
  description?: string;
}

interface AnalyticsData {
  sales: any[];
  products: any[];
  customers: any[];
  employees: any[];
  dateRange: string;
}

interface AdvancedAnalyticsProps {
  data: AnalyticsData;
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function AdvancedAnalytics({ data }: AdvancedAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'profit' | 'orders' | 'customers'>('revenue');

  // Calculate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    const daysBack = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    const startDate = subDays(now, daysBack);
    return { startDate: startOfDay(startDate), endDate: endOfDay(now) };
  };

  // Filter data by date range
  const filteredData = useMemo(() => {
    const { startDate, endDate } = getDateRange();

    return {
      sales: data.sales.filter(sale => {
        const saleDate = parseISO(sale.date);
        return isWithinInterval(saleDate, { start: startDate, end: endDate });
      }),
      products: data.products,
      customers: data.customers,
      employees: data.employees,
    };
  }, [data, selectedPeriod]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const { sales, customers } = filteredData;
    const previousPeriodData = getPreviousPeriodData(sales, selectedPeriod);

    const currentRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const previousRevenue = previousPeriodData.reduce((sum, s) => sum + (s.total || 0), 0);
    const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const currentProfit = sales.reduce((sum: number, s: any) =>
      sum + ((s.items || []).reduce((itemSum: number, item: any) =>
        itemSum + (((item.price || 0) - (item.cost || 0)) * (item.quantity || 0)), 0)
      ), 0,
    );
    const previousProfit = previousPeriodData.reduce((sum: number, s: any) =>
      sum + ((s.items || []).reduce((itemSum: number, item: any) =>
        itemSum + (((item.price || 0) - (item.cost || 0)) * (item.quantity || 0)), 0)
      ), 0,
    );
    const profitChange = previousProfit > 0 ? ((currentProfit - previousProfit) / previousProfit) * 100 : 0;

    const currentOrders = sales.length;
    const previousOrders = previousPeriodData.length;
    const ordersChange = previousOrders > 0 ? ((currentOrders - previousOrders) / previousOrders) * 100 : 0;

    const activeCustomers = customers.filter(c =>
      sales.some(s => s.customerId === c.id),
    ).length;
    const previousCustomers = previousPeriodData.reduce((acc, s) =>
      s.customerId ? acc.add(s.customerId) : acc, new Set(),
    ).size;
    const customersChange = previousCustomers > 0 ? ((activeCustomers - previousCustomers) / previousCustomers) * 100 : 0;

    const avgOrderValue = currentOrders > 0 ? currentRevenue / currentOrders : 0;
    const previousAvgOrderValue = previousOrders > 0 ? previousRevenue / previousOrders : 0;
    const avgOrderChange = previousAvgOrderValue > 0 ? ((avgOrderValue - previousAvgOrderValue) / previousAvgOrderValue) * 100 : 0;

    return [
      {
        title: 'Total Revenue',
        value: currentRevenue,
        previousValue: previousRevenue,
        change: revenueChange,
        changeType: revenueChange > 0 ? 'increase' : revenueChange < 0 ? 'decrease' : 'neutral',
        icon: DollarSign,
        color: 'from-indigo-600/95 via-indigo-500/85 to-sky-400/80',
        unit: 'currency',
        description: 'Total sales revenue',
      },
      {
        title: 'Net Profit',
        value: currentProfit,
        previousValue: previousProfit,
        change: profitChange,
        changeType: profitChange > 0 ? 'increase' : profitChange < 0 ? 'decrease' : 'neutral',
        icon: TrendingUp,
        color: 'from-emerald-500/95 via-emerald-400/85 to-lime-400/80',
        unit: 'currency',
        description: 'Revenue minus costs',
      },
      {
        title: 'Total Orders',
        value: currentOrders,
        previousValue: previousOrders,
        change: ordersChange,
        changeType: ordersChange > 0 ? 'increase' : ordersChange < 0 ? 'decrease' : 'neutral',
        icon: ShoppingCart,
        color: 'from-amber-500/95 via-amber-400/85 to-orange-400/80',
        unit: 'number',
        description: 'Number of transactions',
      },
      {
        title: 'Active Customers',
        value: activeCustomers,
        previousValue: previousCustomers,
        change: customersChange,
        changeType: customersChange > 0 ? 'increase' : customersChange < 0 ? 'decrease' : 'neutral',
        icon: Users,
        color: 'from-purple-500/95 via-purple-400/85 to-pink-400/80',
        unit: 'number',
        description: 'Customers with purchases',
      },
      {
        title: 'Avg Order Value',
        value: avgOrderValue,
        previousValue: previousAvgOrderValue,
        change: avgOrderChange,
        changeType: avgOrderChange > 0 ? 'increase' : avgOrderChange < 0 ? 'decrease' : 'neutral',
        icon: Target,
        color: 'from-rose-500/95 via-rose-400/85 to-pink-400/80',
        unit: 'currency',
        description: 'Average revenue per order',
      },
    ] as KPICard[];
  }, [filteredData, selectedPeriod]);

  // Trend data for charts
  const trendData = useMemo(() => {
    const { sales } = filteredData;
    const { startDate, endDate } = getDateRange();
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const data = [];
    for (let i = 0; i <= daysDiff; i++) {
      const date = subDays(endDate, daysDiff - i);
      const dateStr = format(date, 'yyyy-MM-dd');

      const daySales = sales.filter((s: any) => format(parseISO(s.date), 'yyyy-MM-dd') === dateStr);
      const revenue = daySales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
      const profit = daySales.reduce((sum: number, s: any) =>
        sum + ((s.items || []).reduce((itemSum: number, item: any) =>
          itemSum + (((item.price || 0) - (item.cost || 0)) * (item.quantity || 0)), 0)
        ), 0,
      );
      const orders = daySales.length;

      data.push({
        date: format(date, 'MMM dd'),
        revenue,
        profit,
        orders,
        customers: new Set(daySales.map(s => s.customerId).filter(Boolean)).size,
      });
    }

    return data;
  }, [filteredData, selectedPeriod]);

  // Product performance data
  const productPerformance = useMemo(() => {
    const { sales } = filteredData;
    const productMap = new Map();

    sales.forEach(sale => {
      (sale.items || []).forEach((item: any) => {
        const existing = productMap.get(item.productId) || {
          name: item.productName,
          revenue: 0,
          quantity: 0,
          profit: 0,
          orders: 0,
        };

        existing.revenue += (item.price || 0) * (item.quantity || 0);
        existing.quantity += (item.quantity || 0);
        existing.profit += (((item.price || 0) - (item.cost || 0)) * (item.quantity || 0));
        existing.orders += 1;

        productMap.set(item.productId, existing);
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredData]);

  // Customer segmentation
  const customerSegmentation = useMemo(() => {
    const { sales, customers } = filteredData;
    const customerSpending = new Map();

    sales.forEach(sale => {
      if (sale.customerId) {
        const current = customerSpending.get(sale.customerId) || 0;
        customerSpending.set(sale.customerId, current + (sale.total || 0));
      }
    });

    const segments = {
      'High Value (> $1000)': 0,
      'Medium ($300-$1000)': 0,
      'Low (< $300)': 0,
      'One-time': 0,
    };

    customerSpending.forEach(spending => {
      if (spending > 1000) segments['High Value (> $1000)']++;
      else if (spending >= 300) segments['Medium ($300-$1000)']++;
      else segments['Low (< $300)']++;
    });

    segments['One-time'] = customers.length - customerSpending.size;

    return Object.entries(segments).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const formatNumber = (value: number) =>
    value.toLocaleString('en-US');

  const getChangeIcon = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase': return ArrowUpRight;
      case 'decrease': return ArrowDownRight;
      default: return Minus;
    }
  };

  const getChangeColor = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase': return 'text-emerald-600';
      case 'decrease': return 'text-rose-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Advanced Analytics</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((kpi) => {
          const ChangeIcon = getChangeIcon(kpi.changeType || 'neutral');
          const Icon = kpi.icon;

          return (
            <Card key={kpi.title} className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${kpi.color}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${getChangeColor(kpi.changeType || 'neutral')}`}>
                  <ChangeIcon className="h-4 w-4" />
                  {Math.abs(kpi.change || 0).toFixed(1)}%
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">{kpi.title}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {kpi.unit === 'currency' ? formatCurrency(kpi.value as number) : formatNumber(kpi.value as number)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{kpi.description}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stackId="1" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.6} />
              <Area type="monotone" dataKey="profit" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Customer Segmentation */}
        <Card className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Segmentation</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={customerSegmentation}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {customerSegmentation.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RePieChart>
          </ResponsiveContainer>
        </Card>

        {/* Product Performance */}
        <Card className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productPerformance.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Bar dataKey="revenue" fill="#4F46E5" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Orders Trend */}
        <Card className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders & Customers Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="orders" stroke="#F59E0B" strokeWidth={2} />
              <Line type="monotone" dataKey="customers" stroke="#8B5CF6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card className="p-6 bg-white/50 backdrop-blur-sm border-white/20">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Profit Margin</span>
              <span className="text-sm font-medium text-gray-900">
                {kpis[0]?.value && kpis[1]?.value ?
                  (((kpis[1].value as number) / (kpis[0].value as number)) * 100).toFixed(1) : '0'
                }%
              </span>
            </div>
            <Progress
              value={kpis[0]?.value && kpis[1]?.value ?
                (((kpis[1].value as number) / (kpis[0].value as number)) * 100) : 0
              }
              className="h-2"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Customer Retention</span>
              <span className="text-sm font-medium text-gray-900">
                {filteredData.customers.length > 0 ?
                  (((filteredData.customers.length - (customerSegmentation[3]?.value || 0)) / filteredData.customers.length) * 100).toFixed(1) : '0'
                }%
              </span>
            </div>
            <Progress
              value={filteredData.customers.length > 0 ?
                (((filteredData.customers.length - (customerSegmentation[3]?.value || 0)) / filteredData.customers.length) * 100) : 0
              }
              className="h-2"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Growth Rate</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.abs(kpis[0]?.change || 0).toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, (kpis[0]?.change || 0) + 50))}
              className="h-2"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function getPreviousPeriodData(sales: any[], period: '7d' | '30d' | '90d') {
  const now = new Date();
  const daysBack = period === '7d' ? 14 : period === '30d' ? 60 : 180;
  const startDate = subDays(now, daysBack);
  const endDate = subDays(now, period === '7d' ? 7 : period === '30d' ? 30 : 90);

  return sales.filter(sale => {
    const saleDate = parseISO(sale.date);
    return isWithinInterval(saleDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
  });
}
