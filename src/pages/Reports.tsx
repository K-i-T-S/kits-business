import { TrendingUp, DollarSign, Users, BarChart3, Download, Sparkles, Settings, FileText } from 'lucide-react';
import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

import AdvancedAnalytics from '../components/AdvancedAnalytics';
import Forecasting from '../components/Forecasting';
import Layout from '../components/Layout';
import ReportBuilder, { type ReportWidget } from '../components/ReportBuilder';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useApp } from '../context/AppContext';
import { ExportService } from '../utils/exportService';

export default function Reports() {
  const { products, sales, customers, employees } = useApp();
  const [dateRange, setDateRange] = useState('today');
  const [reportType, setReportType] = useState('overview');
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [customWidgets, setCustomWidgets] = useState<ReportWidget[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('kits_report_configs') ?? '[]') as ReportWidget[];
    } catch {
      return [];
    }
  });

  // Filter sales by date range
  const getFilteredSales = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return (sales || [])?.filter(sale => {
      const saleDate = new Date(sale.date);

      switch (dateRange) {
        case 'today':
          return saleDate >= today;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return saleDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return saleDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  const filteredSales = getFilteredSales();

  // Calculate metrics
  const totalRevenue = (filteredSales || [])?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  const totalProfit = (filteredSales || [])?.reduce((sum, s) =>
    sum + ((s.items || [])?.reduce((itemSum, item) =>
      itemSum + (((item.price || 0) - (item.cost || 0)) * (item.quantity || 0)), 0)
    ), 0,
  ) || 0;
  const totalTransactions = filteredSales?.length || 0;
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Top products by revenue
  const productSales = new Map<string, { name: string; revenue: number; quantity: number; profit: number }>();

  (filteredSales || [])?.forEach(sale => {
    (sale.items || [])?.forEach(item => {
      const existing = productSales.get(item.productId) || {
        name: item.productName,
        revenue: 0,
        quantity: 0,
        profit: 0,
      };
      existing.revenue += (item.price || 0) * (item.quantity || 0);
      existing.quantity += (item.quantity || 0);
      existing.profit += (((item.price || 0) - (item.cost || 0)) * (item.quantity || 0));
      productSales.set(item.productId, existing);
    });
  });

  const topProducts = Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Sales by employee
  const employeeSales = (employees || [])?.map(emp => {
    const empSales = (filteredSales || [])?.filter(s => s.employeeId === emp.id) || [];
    const revenue = empSales.reduce((sum, s) => sum + (s.total || 0), 0);
    return {
      name: emp.name || 'Unknown',
      sales: revenue,
      transactions: empSales.length,
    };
  }).filter(e => e.transactions > 0) || [];

  // Sales by payment method
  const paymentMethods = [
    {
      name: 'Cash',
      value: (filteredSales || [])?.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.total || 0), 0) || 0,
    },
    {
      name: 'Card',
      value: (filteredSales || [])?.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + (s.total || 0), 0) || 0,
    },
  ];

  // Daily sales trend (last 7 days)
  const getDailySales = () => {
    const dailyData = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();

      const daySales = (sales || [])?.filter(s => new Date(s.date).toDateString() === dateStr) || [];
      const revenue = daySales.reduce((sum, s) => sum + (s.total || 0), 0);
      const profit = daySales.reduce((sum, s) =>
        sum + ((s.items || [])?.reduce((itemSum, item) =>
          itemSum + (((item.price || 0) - (item.cost || 0)) * (item.quantity || 0)), 0)
        ), 0,
      );

      dailyData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: revenue,
        profit: profit,
      });
    }

    return dailyData;
  };

  const dailySales = getDailySales();

  // Cost shifts
  const costShifts = (products || [])
    .map(product =>
      (product.variants || [])
        .map(variant => {
          const historyLength = (variant.costHistory || []).length;
          if (historyLength < 2) return null;
          const previous = variant.costHistory[historyLength - 2];
          const recent = variant.costHistory[historyLength - 1];
          if (!previous || !recent) return null;
          const change = previous.cost ? (((recent.cost || 0) - (previous.cost || 0)) / (previous.cost || 1)) * 100 : 0;

          return {
            product: product.name || 'Unknown Product',
            variant: Object.values(variant.attributes || {}).join(' - '),
            previousCost: previous.cost,
            currentCost: recent.cost,
            change,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    )
    .flat();

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const _escapeCsv = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'excel') => {
    if (!filteredSales?.length) {
      toast.info('No data to export', {
        description: 'Try selecting a wider date range.',
      });
      return;
    }

    const employeeLookup = new Map((employees || [])?.map(emp => [emp.id, emp.name]) || []);
    const customerLookup = new Map((customers || [])?.map(c => [c.id, c.name]) || []);

    const rows = (filteredSales || [])?.flatMap(sale => {
      const saleDate = new Date(sale.date).toLocaleString();
      const employeeName = employeeLookup.get(sale.employeeId) ?? 'Unknown';
      const customerName = sale.customerId ? (customerLookup.get(sale.customerId) ?? 'Guest') : 'Guest';

      return (sale.items || [])?.map(item => {
        const revenue = (item.price || 0) * (item.quantity || 0);
        const profit = ((item.price || 0) - (item.cost || 0)) * (item.quantity || 0);
        return [
          sale.id,
          saleDate,
          employeeName,
          customerName,
          sale.paymentMethod,
          item.productName,
          item.quantity,
          (item.price || 0).toFixed(2),
          (item.cost || 0).toFixed(2),
          (revenue || 0).toFixed(2),
          (profit || 0).toFixed(2),
        ];
      });
    });

    const exportData = {
      headers: [
        'Sale ID',
        'Date',
        'Employee',
        'Customer',
        'Payment Method',
        'Product',
        'Quantity',
        'Unit Price',
        'Unit Cost',
        'Revenue',
        'Profit',
      ],
      rows,
      title: `Sales Report - ${dateRange}`,
      metadata: {
        dateRange,
        generatedAt: new Date().toLocaleString(),
        totalRows: rows.length,
      },
    };

    try {
      switch (format) {
        case 'csv':
          ExportService.exportToCSV(exportData, `sales-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
          break;
        case 'excel':
          await ExportService.exportToExcel(exportData, `sales-report-${dateRange}-${new Date().toISOString().split('T')[0]}.xlsx`);
          break;
        case 'pdf':
          await ExportService.exportToPDF('reports-content', `sales-report-${dateRange}-${new Date().toISOString().split('T')[0]}.pdf`);
          break;
      }

      toast.success('Report exported successfully', {
        description: `Downloaded ${rows.length} row${rows.length === 1 ? '' : 's'} as ${format.toUpperCase()}`,
      });
      setShowExportDialog(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed', {
        description: 'Please try again.',
      });
    }
  };

  const formatCurrency = (value: number) =>
    (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const statCards = [
    {
      title: 'Total revenue',
      value: formatCurrency(totalRevenue),
      helper: `${totalTransactions} transactions`,
      accent: 'from-indigo-600/95 via-indigo-500/85 to-sky-400/80',
      icon: DollarSign,
    },
    {
      title: 'Total profit',
      value: formatCurrency(totalProfit),
      helper: `${totalRevenue > 0 ? (((totalProfit || 0) / totalRevenue) * 100).toFixed(1) : '0'}% margin`,
      accent: 'from-emerald-500/95 via-emerald-400/85 to-lime-400/80',
      icon: TrendingUp,
    },
    {
      title: 'Avg transaction',
      value: formatCurrency(avgTransactionValue),
      helper: 'per sale',
      accent: 'from-amber-500/95 via-amber-400/85 to-orange-400/80',
      icon: BarChart3,
    },
    {
      title: 'Active customers',
      value: (customers?.length || 0).toLocaleString(),
      helper: 'total registered',
      accent: 'from-purple-500/95 via-purple-400/85 to-pink-400/80',
      icon: Users,
    },
  ];

  return (
    <Layout>
      <div className="space-y-10 pb-4 lg:pb-6">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <Sparkles className="pointer-events-none absolute -end-6 -top-6 h-24 w-24 text-white/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Advanced Intelligence</p>
              <h1 className="mt-3 text-3xl font-semibold text-white">Reports & analytics</h1>
              <p className="mt-2 text-sm text-white/80">
                Monitor revenue, profit, inventory velocity, and cashier performance. Use advanced analytics and forecasting to guide business decisions.
              </p>
            </div>
            <div className="w-full lg:w-auto flex flex-col gap-3 rounded-3xl border border-white/60 bg-white/80 p-4 sm:p-5 text-sm text-slate-600 shadow-lg shadow-slate-900/5">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="rounded-2xl border border-slate-200 bg-white/90 py-2.5 px-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Overview</SelectItem>
                  <SelectItem value="analytics">Advanced Analytics</SelectItem>
                  <SelectItem value="forecasting">Forecasting</SelectItem>
                  <SelectItem value="custom">Custom Report</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReportBuilder(true)}
                  className="flex-1 min-h-[40px]"
                >
                  <Settings className="h-4 w-4 me-2" />
                  Build Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportDialog(true)}
                  className="flex-1 min-h-[40px]"
                >
                  <Download className="h-4 w-4 me-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </section>

        {reportType === 'overview' && (
          <div>
            <div id="reports-content">
              {/* Date Range Selector */}
              <div className="flex justify-end mb-6">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white/90 py-2.5 px-4 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              {filteredSales.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-slate-400 text-sm">No sales data for this period. Start making sales from the POS terminal.</p>
                </div>
              )}

              {/* Original Overview Content */}
              <section className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((card) => (
                  <div
                    key={card.title}
                    className={`tilt-hover rounded-3xl border border-white/10 bg-gradient-to-br ${card.accent} p-5 text-white shadow-lg shadow-slate-900/15`}
                  >
                    <div className="flex items-center gap-2 text-white/80">
                      <card.icon className="h-4 w-4" />
                      <p className="text-xs uppercase tracking-[0.25em]">{card.title}</p>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">{card.value}</p>
                    <p className="text-sm text-white/80">{card.helper}</p>
                  </div>
                ))}
              </section>

              <section className="grid grid-cols-1 gap-4 mt-8 sm:gap-6 xl:grid-cols-2">
                <div className="hero-gradient glass-panel p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">Revenue pulse</p>
                      <h2 className="text-lg font-semibold text-white">Sales trend (last 7 days)</h2>
                    </div>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/70">Auto-refreshes</span>
                  </div>
                  <div className="mt-4 h-[260px] sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailySales}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2} name="Revenue" />
                        <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} name="Profit" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="hero-gradient glass-panel p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">Merch velocity</p>
                      <h2 className="text-lg font-semibold text-white">Top products by revenue</h2>
                    </div>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/70">Sync with PLU</span>
                  </div>
                  <div className="mt-4 h-[260px] sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#4F46E5" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="hero-gradient glass-panel p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">Tender mix</p>
                      <h2 className="text-lg font-semibold text-white">Payment method distribution</h2>
                    </div>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/70">Customize copy</span>
                  </div>
                  <div className="mt-4 h-[260px] sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentMethods}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {paymentMethods.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="hero-gradient glass-panel p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">People power</p>
                      <h2 className="text-lg font-semibold text-white">Employee performance</h2>
                    </div>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/70">Use for coaching</span>
                  </div>
                  <div className="mt-4 h-[260px] sm:h-[320px]">
                    {employeeSales.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={employeeSales}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="sales" fill="#10B981" name="Sales ($)" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/60">
                        No sales data available for this period
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 mt-8 sm:gap-6 xl:grid-cols-2">
                <div className="hero-gradient glass-panel p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">Product intelligence</p>
                      <h2 className="text-lg font-semibold text-white">Top products details</h2>
                    </div>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/70">Kits insights</span>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-start text-sm text-white/80">
                      <thead className="bg-white/10 text-xs uppercase tracking-[0.2em] text-white/60">
                        <tr>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3 text-end">Qty sold</th>
                          <th className="px-4 py-3 text-end">Revenue</th>
                          <th className="px-4 py-3 text-end">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/20 bg-white/10">
                        {topProducts.map((product, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-white">{product.name}</td>
                            <td className="px-4 py-3 text-end text-white/80">{product.quantity}</td>
                            <td className="px-4 py-3 text-end font-semibold text-white">
                              {formatCurrency(product.revenue)}
                            </td>
                            <td className="px-4 py-3 text-end text-emerald-300">
                              {formatCurrency(product.profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {topProducts.length === 0 && (
                      <p className="py-8 text-center text-sm text-white/60">No sales data</p>
                    )}
                  </div>
                </div>

                <div className="hero-gradient glass-panel p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-white/70">Cost intelligence</p>
                      <h2 className="text-lg font-semibold text-white">Recent cost shifts</h2>
                    </div>
                    <span className="text-xs uppercase tracking-[0.35em] text-white/70">Audit ready</span>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-start text-sm text-white/80">
                      <thead className="bg-white/10 text-xs uppercase tracking-[0.2em] text-white/60">
                        <tr>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3 text-end">Previous</th>
                          <th className="px-4 py-3 text-end">Current</th>
                          <th className="px-4 py-3 text-end">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/20 bg-white/10">
                        {costShifts.slice(0, 5).map((shift, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{shift.product}</p>
                              <p className="text-xs uppercase tracking-[0.2em] text-white/60">{shift.variant}</p>
                            </td>
                            <td className="px-4 py-3 text-end text-white/80">
                              {formatCurrency(shift.previousCost)}
                            </td>
                            <td className="px-4 py-3 text-end text-white">
                              {formatCurrency(shift.currentCost)}
                            </td>
                            <td className="px-4 py-3 text-end">
                              <span
                                className={
                                  shift.currentCost > shift.previousCost ? 'text-rose-300' : 'text-emerald-300'
                                }
                              >
                                {shift.currentCost > shift.previousCost ? '+' : '-'}
                                {formatCurrency(Math.abs(shift.currentCost - shift.previousCost))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {costShifts.length === 0 && (
                      <p className="py-8 text-center text-sm text-slate-500">No recent changes</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {reportType === 'analytics' && (
          <AdvancedAnalytics
            data={{
              sales: filteredSales || [],
              products: products || [],
              customers: customers || [],
              employees: employees || [],
              dateRange,
            }}
          />
        )}

        {reportType === 'forecasting' && (
          <Forecasting
            data={{
              sales: sales || [],
              products: products || [],
              customers: customers || [],
            }}
          />
        )}

        {reportType === 'custom' && customWidgets.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900">Custom Report</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {customWidgets.map((widget) => (
                <div key={widget.id} className="hero-gradient glass-panel p-6 text-white">
                  <h4 className="text-lg font-semibold text-white mb-4">{widget.title}</h4>
                  <div className="h-64 flex items-center justify-center text-white/60">
                    {widget.type} Widget Content
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export Dialog */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Export Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Choose the format for your report export. The current date range ({dateRange}) will be used.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  onClick={() => handleExport('csv')}
                  className="justify-start"
                  variant="outline"
                >
                  <FileText className="h-4 w-4 me-2" />
                  Export as CSV
                </Button>
                <Button
                  onClick={() => handleExport('excel')}
                  className="justify-start"
                  variant="outline"
                >
                  <FileText className="h-4 w-4 me-2" />
                  Export as Excel
                </Button>
                <Button
                  onClick={() => handleExport('pdf')}
                  className="justify-start"
                  variant="outline"
                >
                  <FileText className="h-4 w-4 me-2" />
                  Export as PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Report Builder Dialog */}
        {showReportBuilder && (
          <ReportBuilder
            onSave={(widgets) => {
              setCustomWidgets(widgets);
              localStorage.setItem('kits_report_configs', JSON.stringify(widgets));
              setShowReportBuilder(false);
              setReportType('custom');
              toast.success('Custom report created', {
                description: `Added ${widgets.length} widgets to your report`,
              });
            }}
            onCancel={() => setShowReportBuilder(false)}
            initialWidgets={customWidgets}
          />
        )}
      </div>
    </Layout>
  );
}
