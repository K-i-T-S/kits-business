import { useState } from 'react';
import { Calendar, TrendingUp, DollarSign, Package, Users, BarChart3, Download } from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner@2.0.3';

export default function Reports() {
  const { products, sales, customers, employees } = useApp();
  const [dateRange, setDateRange] = useState('today');
  const [reportType, setReportType] = useState('overview');

  // Filter sales by date range
  const getFilteredSales = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return sales.filter(sale => {
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
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = filteredSales.reduce((sum, s) => 
    sum + s.items.reduce((itemSum, item) => 
      itemSum + ((item.price - item.cost) * item.quantity), 0
    ), 0
  );
  const totalTransactions = filteredSales.length;
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Top products by revenue
  const productSales = new Map<string, { name: string; revenue: number; quantity: number; profit: number }>();
  
  filteredSales.forEach(sale => {
    sale.items.forEach(item => {
      const existing = productSales.get(item.productId) || { 
        name: item.productName, 
        revenue: 0, 
        quantity: 0,
        profit: 0
      };
      existing.revenue += item.price * item.quantity;
      existing.quantity += item.quantity;
      existing.profit += (item.price - item.cost) * item.quantity;
      productSales.set(item.productId, existing);
    });
  });

  const topProducts = Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Sales by employee
  const employeeSales = employees.map(emp => {
    const empSales = filteredSales.filter(s => s.employeeId === emp.id);
    const revenue = empSales.reduce((sum, s) => sum + s.total, 0);
    return {
      name: emp.name,
      sales: revenue,
      transactions: empSales.length
    };
  }).filter(e => e.transactions > 0);

  // Sales by payment method
  const paymentMethods = [
    { 
      name: 'Cash', 
      value: filteredSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0)
    },
    { 
      name: 'Card', 
      value: filteredSales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0)
    }
  ];

  // Daily sales trend (last 7 days)
  const getDailySales = () => {
    const dailyData = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      
      const daySales = sales.filter(s => new Date(s.date).toDateString() === dateStr);
      const revenue = daySales.reduce((sum, s) => sum + s.total, 0);
      const profit = daySales.reduce((sum, s) => 
        sum + s.items.reduce((itemSum, item) => 
          itemSum + ((item.price - item.cost) * item.quantity), 0
        ), 0
      );
      
      dailyData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: revenue,
        profit: profit
      });
    }
    
    return dailyData;
  };

  const dailySales = getDailySales();

  // Cost shifts
  const costShifts = products
    .map(product =>
      product.variants
        .map(variant => {
          const historyLength = variant.costHistory.length;
          if (historyLength < 2) return null;
          const previous = variant.costHistory[historyLength - 2];
          const recent = variant.costHistory[historyLength - 1];
          if (!previous || !recent) return null;
          const change = ((recent.cost - previous.cost) / previous.cost) * 100;

          return {
            product: product.name,
            variant: Object.values(variant.attributes).join(' - '),
            previousCost: previous.cost,
            currentCost: recent.cost,
            change,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    )
    .flat();

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const escapeCsv = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExport = () => {
    if (filteredSales.length === 0) {
      toast.info('No data to export', {
        description: 'Try selecting a wider date range.',
      });
      return;
    }

    const employeeLookup = new Map(employees.map(emp => [emp.id, emp.name]));
    const customerLookup = new Map(customers.map(c => [c.id, c.name]));

    const rows = filteredSales.flatMap(sale => {
      const saleDate = new Date(sale.date).toLocaleString();
      const employeeName = employeeLookup.get(sale.employeeId) ?? 'Unknown';
      const customerName = sale.customerId ? (customerLookup.get(sale.customerId) ?? 'Guest') : 'Guest';

      return sale.items.map(item => {
        const revenue = item.price * item.quantity;
        const profit = (item.price - item.cost) * item.quantity;
        return [
          sale.id,
          saleDate,
          employeeName,
          customerName,
          sale.paymentMethod,
          item.productName,
          item.quantity,
          item.price.toFixed(2),
          item.cost.toFixed(2),
          revenue.toFixed(2),
          profit.toFixed(2),
        ];
      });
    });

    const header = [
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
    ];

    const csvContent = [header, ...rows]
      .map(row => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reports-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Reports exported', {
      description: `Downloaded ${rows.length} row${rows.length === 1 ? '' : 's'}.`,
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600">Comprehensive business insights and metrics</p>
          </div>
          <div className="flex space-x-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600">Total Revenue</p>
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-gray-900 mb-1">${totalRevenue.toFixed(2)}</p>
            <p className="text-gray-500 text-sm">{totalTransactions} transactions</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600">Total Profit</p>
              <TrendingUp className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-gray-900 mb-1">${totalProfit.toFixed(2)}</p>
            <p className="text-gray-500 text-sm">
              {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}% margin
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600">Avg Transaction</p>
              <BarChart3 className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-gray-900 mb-1">${avgTransactionValue.toFixed(2)}</p>
            <p className="text-gray-500 text-sm">per sale</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600">Active Customers</p>
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-gray-900 mb-1">{customers.length}</p>
            <p className="text-gray-500 text-sm">total registered</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Sales Trend */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Sales Trend (Last 7 Days)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Top Products by Revenue</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Payment Methods Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethods}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
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

          {/* Employee Performance */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Employee Performance</h2>
            {employeeSales.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={employeeSales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sales" fill="#10B981" name="Sales ($)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No sales data available for this period
              </div>
            )}
          </div>
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products Table */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Top Products Details</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 text-gray-600 text-sm">Product</th>
                    <th className="text-right py-2 text-gray-600 text-sm">Qty Sold</th>
                    <th className="text-right py-2 text-gray-600 text-sm">Revenue</th>
                    <th className="text-right py-2 text-gray-600 text-sm">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, index) => (
                    <tr key={index} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 text-gray-900">{product.name}</td>
                      <td className="py-3 text-gray-700 text-right">{product.quantity}</td>
                      <td className="py-3 text-gray-900 text-right">${product.revenue.toFixed(2)}</td>
                      <td className="py-3 text-green-600 text-right">${product.profit.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topProducts.length === 0 && (
                <p className="text-center py-8 text-gray-500">No sales data</p>
              )}
            </div>
          </div>

          {/* Cost Shifts */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-gray-900 mb-4">Recent Cost Shifts</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 text-gray-600 text-sm">Product</th>
                    <th className="text-right py-2 text-gray-600 text-sm">Previous</th>
                    <th className="text-right py-2 text-gray-600 text-sm">Current</th>
                    <th className="text-right py-2 text-gray-600 text-sm">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {costShifts.slice(0, 5).map((shift: any, index) => (
                    <tr key={index} className="border-b border-gray-100 last:border-0">
                      <td className="py-3">
                        <p className="text-gray-900 text-sm">{shift.product}</p>
                        <p className="text-gray-500 text-xs">{shift.variant}</p>
                      </td>
                      <td className="py-3 text-gray-700 text-right text-sm">
                        ${shift.previousCost.toFixed(2)}
                      </td>
                      <td className="py-3 text-gray-900 text-right text-sm">
                        ${shift.currentCost.toFixed(2)}
                      </td>
                      <td className={`py-3 text-right text-sm ${
                        shift.change > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {shift.change > 0 ? '+' : ''}{shift.change.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {costShifts.length === 0 && (
                <p className="text-center py-8 text-gray-500">No cost changes recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
