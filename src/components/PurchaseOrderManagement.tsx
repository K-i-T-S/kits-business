import {
  Search,
  Plus,
  ShoppingCart,
  Calendar,
  DollarSign,
  Package,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Fragment, useMemo, useState, useEffect } from 'react';

import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import type { PurchaseOrder } from '../types/inventory';

export default function PurchaseOrderManagement() {
  const { setModalOpen } = useApp();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'sent' | 'confirmed' | 'partial' | 'received' | 'cancelled'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockOrders: PurchaseOrder[] = [
        {
          id: 'po-1',
          tenant_id: 'tenant-1',
          supplier_id: 'sup-1',
          location_id: 'loc-1',
          order_number: 'PO-2024-001',
          status: 'received',
          order_date: '2024-01-15',
          expected_date: '2024-01-20',
          received_date: '2024-01-19',
          subtotal: 2500.00,
          tax_amount: 200.00,
          total_amount: 2700.00,
          payment_terms: 'NET30',
          notes: 'Urgent dairy order',
          created_by: 'user-1',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-19T15:30:00Z',
          supplier_name: 'Dairy Farm Co.',
          location_name: 'Main Warehouse',
        },
        {
          id: 'po-2',
          tenant_id: 'tenant-1',
          supplier_id: 'sup-2',
          location_id: 'loc-2',
          order_number: 'PO-2024-002',
          status: 'confirmed',
          order_date: '2024-01-18',
          expected_date: '2024-01-25',
          subtotal: 5000.00,
          tax_amount: 400.00,
          total_amount: 5400.00,
          payment_terms: 'NET15',
          notes: 'Tech components for Q1',
          created_by: 'user-1',
          created_at: '2024-01-18T09:00:00Z',
          updated_at: '2024-01-18T09:00:00Z',
          supplier_name: 'Tech Components Ltd.',
          location_name: 'Tech Storage',
        },
        {
          id: 'po-3',
          tenant_id: 'tenant-1',
          supplier_id: 'sup-3',
          location_id: 'loc-1',
          order_number: 'PO-2024-003',
          status: 'draft',
          order_date: '2024-01-20',
          expected_date: '2024-01-27',
          subtotal: 1500.00,
          tax_amount: 120.00,
          total_amount: 1620.00,
          payment_terms: 'NET45',
          notes: 'Beverage restock',
          created_by: 'user-2',
          created_at: '2024-01-20T11:00:00Z',
          updated_at: '2024-01-20T11:00:00Z',
          supplier_name: 'Beverage Distributors Inc.',
          location_name: 'Main Warehouse',
        },
      ];
      setOrders(mockOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const orderStats = [
    {
      label: 'Total Orders',
      value: orders.length,
      subcopy: 'Purchase orders',
      critical: false,
    },
    {
      label: 'Pending',
      value: orders.filter(o => ['draft', 'sent', 'confirmed'].includes(o.status)).length,
      subcopy: 'Awaiting delivery',
      critical: false,
    },
    {
      label: 'Received',
      value: orders.filter(o => o.status === 'received').length,
      subcopy: 'Completed orders',
      critical: false,
    },
    {
      label: 'Total Value',
      value: `$${orders.reduce((sum, o) => sum + o.total_amount, 0).toFixed(2)}`,
      subcopy: 'Order value',
      critical: false,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'received':
        return 'bg-emerald-100 text-emerald-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero Section */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Procurement Hub</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">
                Purchase Order Management
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Track purchase orders from creation to delivery. Monitor supplier performance,
                manage order status, and maintain complete procurement visibility.
              </p>
            </div>
            <button
              className="tilt-hover flex items-center gap-2 rounded-2xl border border-white/60 bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-white shadow-lg shadow-indigo-500/30"
            >
              <Plus className="h-4 w-4" />
              New Order
            </button>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {orderStats.map((stat) => (
            <div
              key={stat.label}
              className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-xl text-white"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-white/70">{stat.label}</p>
              <p
                className={`mt-3 text-3xl font-semibold ${
                  stat.critical ? 'text-amber-400' : 'text-white'
                }`}
              >
                {stat.value}
              </p>
              <p className="text-sm text-white/80">{stat.subcopy}</p>
            </div>
          ))}
        </section>

        {/* Filters Section */}
        <section className="hero-gradient glass-panel p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Filters</p>
              <h2 className="text-lg font-semibold text-white">Order Directory</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="all" className="text-gray-900">All Status</option>
                <option value="draft" className="text-gray-900">Draft</option>
                <option value="sent" className="text-gray-900">Sent</option>
                <option value="confirmed" className="text-gray-900">Confirmed</option>
                <option value="partial" className="text-gray-900">Partial</option>
                <option value="received" className="text-gray-900">Received</option>
                <option value="cancelled" className="text-gray-900">Cancelled</option>
              </select>
            </div>
          </div>
        </section>

        {/* Search Section */}
        <section className="hero-gradient glass-panel p-6 text-white">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search orders by number, supplier, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 pl-12 pr-4 py-3 text-white placeholder-white/60 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </section>

        {/* Orders Table */}
        <section className="glass-panel p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                <p className="mt-4 text-sm text-gray-600">Loading orders...</p>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No orders found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first purchase order'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Order</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Supplier</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Location</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Order Date</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Expected</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Total Amount</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="py-4">
                        <div>
                          <p className="font-medium text-gray-900">{order.order_number}</p>
                          <p className="text-sm text-gray-500">ID: {order.id}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p>{order.supplier_name}</p>
                          <p className="text-gray-500">ID: {order.supplier_id}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p>{order.location_name}</p>
                          <p className="text-gray-500">ID: {order.location_id}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p>{new Date(order.order_date).toLocaleDateString()}</p>
                          <p className="text-gray-500">
                            {Math.ceil((new Date().getTime() - new Date(order.order_date).getTime()) / (1000 * 60 * 60 * 24))} days ago
                          </p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          {order.expected_date ? (
                            <>
                              <p>{new Date(order.expected_date).toLocaleDateString()}</p>
                              {order.received_date ? (
                                <p className="text-green-600">Received: {new Date(order.received_date).toLocaleDateString()}</p>
                              ) : (
                                <p className="text-orange-600">
                                  {Math.ceil((new Date(order.expected_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-gray-500">Not set</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p className="font-medium">${order.total_amount.toLocaleString()}</p>
                          <p className="text-gray-500">Subtotal: ${order.subtotal.toLocaleString()}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusIcon(order.status)}
                            <span className="ml-1">{order.status}</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
