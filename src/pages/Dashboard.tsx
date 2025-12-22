import { Link } from 'react-router-dom';
import { Package, ShoppingCart, Users, UserCircle, TrendingUp, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';

export default function Dashboard() {
  const { products, sales, customers, currentEmployee } = useApp();

  // Calculate metrics
  const totalProducts = products.reduce((acc, p) => acc + p.variants.length, 0);
  const totalStock = products.reduce((acc, p) => 
    acc + p.variants.reduce((sum, v) => sum + v.stock, 0), 0
  );
  const lowStockItems = products.reduce((acc, p) => 
    acc + p.variants.filter(v => v.stock <= v.reorderLevel).length, 0
  );
  
  const todaySales = sales.filter(s => {
    const today = new Date().toDateString();
    return new Date(s.date).toDateString() === today;
  });
  
  const todayRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
  const todayProfit = todaySales.reduce((acc, s) => 
    acc + s.items.reduce((sum, item) => sum + ((item.price - item.cost) * item.quantity), 0), 0
  );

  const totalCustomers = customers.length;
  const customersWithDebt = customers.filter(c => c.debtBalance > 0).length;

  const quickStats = [
    {
      title: 'Total Products',
      value: totalProducts,
      subtitle: `${totalStock} units in stock`,
      icon: Package,
      color: 'bg-blue-500',
      link: '/inventory'
    },
    {
      title: "Today's Sales",
      value: `$${todayRevenue.toFixed(2)}`,
      subtitle: `${todaySales.length} transactions`,
      icon: ShoppingCart,
      color: 'bg-green-500',
      link: '/pos'
    },
    {
      title: 'Customers',
      value: totalCustomers,
      subtitle: `${customersWithDebt} with debt`,
      icon: Users,
      color: 'bg-purple-500',
      link: '/customers'
    },
    {
      title: "Today's Profit",
      value: `$${todayProfit.toFixed(2)}`,
      subtitle: `${((todayProfit / todayRevenue) * 100 || 0).toFixed(1)}% margin`,
      icon: TrendingUp,
      color: 'bg-orange-500',
      link: '/reports'
    }
  ];

  const quickActions = [
    { title: 'New Sale', icon: ShoppingCart, link: '/pos', color: 'bg-green-600' },
    { title: 'Add Product', icon: Package, link: '/inventory', color: 'bg-blue-600' },
    { title: 'View Reports', icon: BarChart3, link: '/reports', color: 'bg-purple-600' },
    { title: 'Manage Employees', icon: UserCircle, link: '/employees', color: 'bg-indigo-600' }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-gray-900">Welcome back, {currentEmployee?.name}</h1>
            <p className="text-gray-600">Here's what's happening with your business today</p>
          </div>
          <div className="text-right">
            <p className="text-gray-600">Today</p>
            <p className="text-gray-900">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickStats.map((stat, index) => (
            <Link key={index} to={stat.link} className="group">
              <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-gray-600 mb-1">{stat.title}</p>
                    <p className="text-gray-900 mb-1">{stat.value}</p>
                    <p className="text-gray-500 text-sm">{stat.subtitle}</p>
                  </div>
                  <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Alerts */}
        {lowStockItems > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-orange-900">Low Stock Alert</p>
              <p className="text-orange-700 text-sm">
                {lowStockItems} product variant{lowStockItems > 1 ? 's' : ''} running low on stock. 
                <Link to="/inventory" className="underline ml-1">View inventory</Link>
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Link
                key={index}
                to={action.link}
                className={`${action.color} text-white rounded-xl p-6 hover:opacity-90 transition-opacity flex flex-col items-center justify-center text-center space-y-3`}
              >
                <action.icon className="w-8 h-8" />
                <span>{action.title}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Sales */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-gray-900">Recent Sales</h2>
              <Link to="/reports" className="text-indigo-600 hover:underline text-sm">View all</Link>
            </div>
            {todaySales.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No sales today yet</p>
            ) : (
              <div className="space-y-3">
                {todaySales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-gray-900">Sale #{sale.id}</p>
                      <p className="text-gray-500 text-sm">{new Date(sale.date).toLocaleTimeString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-900">${sale.total.toFixed(2)}</p>
                      <p className="text-gray-500 text-sm capitalize">{sale.paymentMethod}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-gray-900">Inventory Overview</h2>
              <Link to="/inventory" className="text-indigo-600 hover:underline text-sm">Manage</Link>
            </div>
            <div className="space-y-3">
              {products.slice(0, 5).map((product) => {
                const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
                const isLowStock = product.variants.some(v => v.stock <= v.reorderLevel);
                
                return (
                  <div key={product.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1">
                      <p className="text-gray-900">{product.name}</p>
                      <p className="text-gray-500 text-sm">{product.sku}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isLowStock && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                      <span className={`text-sm ${isLowStock ? 'text-orange-600' : 'text-gray-600'}`}>
                        {totalStock} units
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
