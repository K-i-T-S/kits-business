import { Fragment, useMemo, useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Truck,
  MapPin,
  Package,
  ArrowRight,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import type { StockTransfer } from '../types/inventory';

export default function StockTransferManagement() {
  const { setModalOpen } = useApp();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_transit' | 'completed' | 'cancelled'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  useEffect(() => {
    loadTransfers();
  }, []);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockTransfers: StockTransfer[] = [
        {
          id: 'transfer-1',
          tenant_id: 'tenant-1',
          transfer_number: 'TR-2024-001',
          from_location_id: 'loc-1',
          to_location_id: 'loc-2',
          status: 'completed',
          transfer_date: '2024-01-15',
          completed_date: '2024-01-16',
          notes: 'Urgent dairy transfer',
          created_by: 'user-1',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-16T14:30:00Z',
          from_location_name: 'Main Warehouse',
          to_location_name: 'Secondary Storage',
          items: [
            {
              id: 'item-1',
              stock_transfer_id: 'transfer-1',
              product_id: 'prod-1',
              batch_id: 'batch-1',
              quantity: 50,
              notes: 'Fresh milk batch',
              created_at: '2024-01-15T10:00:00Z',
              product_name: 'Fresh Milk',
              batch_number: 'BATCH-001',
            }
          ]
        },
        {
          id: 'transfer-2',
          tenant_id: 'tenant-1',
          transfer_number: 'TR-2024-002',
          from_location_id: 'loc-2',
          to_location_id: 'loc-3',
          status: 'in_transit',
          transfer_date: '2024-01-18',
          notes: 'Tech components redistribution',
          created_by: 'user-2',
          created_at: '2024-01-18T09:00:00Z',
          updated_at: '2024-01-18T09:00:00Z',
          from_location_name: 'Secondary Storage',
          to_location_name: 'Tech Storage',
          items: [
            {
              id: 'item-2',
              stock_transfer_id: 'transfer-2',
              product_id: 'prod-2',
              batch_id: 'batch-2',
              quantity: 25,
              notes: 'Computer parts',
              created_at: '2024-01-18T09:00:00Z',
              product_name: 'Computer Parts',
              batch_number: 'BATCH-002',
            }
          ]
        },
      ];
      setTransfers(mockTransfers);
    } catch (error) {
      console.error('Error loading transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch =
      transfer.transfer_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transfer.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transfer.items?.some(item => 
        item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.batch_number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesStatus = filterStatus === 'all' || transfer.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const transferStats = [
    {
      label: 'Total Transfers',
      value: transfers.length,
      subcopy: 'Stock movements',
      critical: false,
    },
    {
      label: 'In Transit',
      value: transfers.filter(t => t.status === 'in_transit').length,
      subcopy: 'Currently moving',
      critical: transfers.filter(t => t.status === 'in_transit').length > 0,
    },
    {
      label: 'Completed',
      value: transfers.filter(t => t.status === 'completed').length,
      subcopy: 'Delivered',
      critical: false,
    },
    {
      label: 'Total Quantity',
      value: transfers.reduce((sum, t) => sum + (t.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0),
      subcopy: 'Units transferred',
      critical: false,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero Section */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Logistics Control</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">
                Stock Transfer Management
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Manage stock movements between locations. Track transfers in real-time,
                optimize inventory distribution, and maintain complete logistics visibility.
              </p>
            </div>
            <button
              className="tilt-hover flex items-center gap-2 rounded-2xl border border-white/60 bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-white shadow-lg shadow-indigo-500/30"
            >
              <Plus className="h-4 w-4" />
              New Transfer
            </button>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {transferStats.map((stat) => (
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
              <h2 className="text-lg font-semibold text-white">Transfer Directory</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="all" className="text-gray-900">All Status</option>
                <option value="pending" className="text-gray-900">Pending</option>
                <option value="in_transit" className="text-gray-900">In Transit</option>
                <option value="completed" className="text-gray-900">Completed</option>
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
              placeholder="Search transfers by product, batch, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 pl-12 pr-4 py-3 text-white placeholder-white/60 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </section>

        {/* Transfers Table */}
        <section className="glass-panel p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                <p className="mt-4 text-sm text-gray-600">Loading transfers...</p>
              </div>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No transfers found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first stock transfer'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Transfer</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">From → To</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Quantity</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Batch</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Transfer Date</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTransfers.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-gray-50">
                      <td className="py-4">
                        <div>
                          <p className="font-medium text-gray-900">{transfer.transfer_number}</p>
                          <p className="text-sm text-gray-500">ID: {transfer.id}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          {transfer.items?.map((item, index) => (
                            <div key={item.id}>
                              <p>{item.product_name}</p>
                              <p className="text-gray-500">ID: {item.product_id}</p>
                              {transfer.items && transfer.items.length > 1 && index < transfer.items.length - 1 && <hr className="my-2" />}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <div>
                            <p>{transfer.from_location_name}</p>
                            <p className="text-gray-500">{transfer.from_location_id}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400" />
                          <div>
                            <p>{transfer.to_location_name}</p>
                            <p className="text-gray-500">{transfer.to_location_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          {transfer.items?.map((item, index) => (
                            <div key={item.id}>
                              <span className="font-medium">{item.quantity} units</span>
                              {transfer.items && transfer.items.length > 1 && index < transfer.items.length - 1 && <hr className="my-2" />}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          {transfer.items?.map((item, index) => (
                            <div key={item.id}>
                              <span>{item.batch_number}</span>
                              {transfer.items && transfer.items.length > 1 && index < transfer.items.length - 1 && <hr className="my-2" />}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p>{new Date(transfer.transfer_date).toLocaleDateString()}</p>
                          {transfer.completed_date && (
                            <p className="text-green-600">Completed: {new Date(transfer.completed_date).toLocaleDateString()}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(transfer.status)}`}>
                          {transfer.status.replace('_', ' ')}
                        </span>
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
