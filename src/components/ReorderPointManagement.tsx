import {
  Search,
  Plus,
  AlertTriangle,
  TrendingUp,
  Package,
  MapPin,
  BarChart3,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Fragment, useMemo, useState, useEffect } from 'react';

import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import type { ReorderPoint } from '../types/inventory';

export default function ReorderPointManagement() {
  const { setModalOpen } = useApp();
  const [reorderPoints, setReorderPoints] = useState<ReorderPoint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'out_of_stock' | 'low_stock' | 'optimal' | 'overstock'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  useEffect(() => {
    loadReorderPoints();
  }, []);

  const loadReorderPoints = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockReorderPoints: ReorderPoint[] = [
        {
          id: 'rop-1',
          tenant_id: 'tenant-1',
          product_id: 'prod-1',
          location_id: 'loc-1',
          min_stock_level: 20,
          max_stock_level: 100,
          reorder_point: 30,
          reorder_quantity: 50,
          lead_time_days: 7,
          safety_stock: 10,
          is_active: true,
          last_calculated: '2024-01-20T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-20T10:00:00Z',
          product_name: 'Fresh Milk',
          product_sku: 'MLK-001',
          location_name: 'Main Warehouse',
          current_stock: 25,
          stock_status: 'low_stock',
          days_of_stock: 2,
        },
        {
          id: 'rop-2',
          tenant_id: 'tenant-1',
          product_id: 'prod-2',
          location_id: 'loc-2',
          min_stock_level: 10,
          max_stock_level: 50,
          reorder_point: 15,
          reorder_quantity: 25,
          lead_time_days: 14,
          safety_stock: 5,
          is_active: true,
          last_calculated: '2024-01-20T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-20T10:00:00Z',
          product_name: 'Computer Parts',
          product_sku: 'TECH-002',
          location_name: 'Tech Storage',
          current_stock: 0,
          stock_status: 'out_of_stock',
          days_of_stock: 0,
        },
        {
          id: 'rop-3',
          tenant_id: 'tenant-1',
          product_id: 'prod-3',
          location_id: 'loc-1',
          min_stock_level: 50,
          max_stock_level: 200,
          reorder_point: 75,
          reorder_quantity: 100,
          lead_time_days: 5,
          safety_stock: 25,
          is_active: true,
          last_calculated: '2024-01-20T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-20T10:00:00Z',
          product_name: 'Beverages',
          product_sku: 'BEV-003',
          location_name: 'Main Warehouse',
          current_stock: 150,
          stock_status: 'optimal',
          days_of_stock: 15,
        },
      ];
      setReorderPoints(mockReorderPoints);
    } catch (error) {
      console.error('Error loading reorder points:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReorderPoints = reorderPoints.filter((rop) => {
    const matchesSearch =
      rop.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rop.product_sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rop.location_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || rop.stock_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const reorderStats = [
    {
      label: 'Total Products',
      value: reorderPoints.length,
      subcopy: 'Tracked items',
      critical: false,
    },
    {
      label: 'Need Reorder',
      value: reorderPoints.filter(r => r.stock_status === 'out_of_stock' || r.stock_status === 'low_stock').length,
      subcopy: 'Critical items',
      critical: reorderPoints.filter(r => r.stock_status === 'out_of_stock' || r.stock_status === 'low_stock').length > 0,
    },
    {
      label: 'Optimal Stock',
      value: reorderPoints.filter(r => r.stock_status === 'optimal').length,
      subcopy: 'Well stocked',
      critical: false,
    },
    {
      label: 'Overstock',
      value: reorderPoints.filter(r => r.stock_status === 'overstock').length,
      subcopy: 'Excess inventory',
      critical: false,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return 'bg-red-100 text-red-800';
      case 'low_stock':
        return 'bg-yellow-100 text-yellow-800';
      case 'optimal':
        return 'bg-green-100 text-green-800';
      case 'overstock':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return <AlertTriangle className="h-4 w-4" />;
      case 'low_stock':
        return <TrendingUp className="h-4 w-4" />;
      case 'optimal':
        return <Package className="h-4 w-4" />;
      case 'overstock':
        return <BarChart3 className="h-4 w-4" />;
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
              <p className="stat-chip bg-white/10 text-white/80">Inventory Intelligence</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">
                Reorder Point Management
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Optimize inventory levels with intelligent reorder points. Monitor stock status,
                prevent stockouts, and maintain optimal inventory across all locations.
              </p>
            </div>
            <button
              className="tilt-hover flex items-center gap-2 rounded-2xl border border-white/60 bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-white shadow-lg shadow-indigo-500/30"
            >
              <Plus className="h-4 w-4" />
              New Reorder Point
            </button>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {reorderStats.map((stat) => (
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
              <h2 className="text-lg font-semibold text-white">Reorder Directory</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="all" className="text-gray-900">All Status</option>
                <option value="out_of_stock" className="text-gray-900">Out of Stock</option>
                <option value="low_stock" className="text-gray-900">Low Stock</option>
                <option value="optimal" className="text-gray-900">Optimal</option>
                <option value="overstock" className="text-gray-900">Overstock</option>
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
              placeholder="Search products by name, SKU, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 pl-12 pr-4 py-3 text-white placeholder-white/60 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </section>

        {/* Reorder Points Table */}
        <section className="glass-panel p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                <p className="mt-4 text-sm text-gray-600">Loading reorder points...</p>
              </div>
            </div>
          ) : filteredReorderPoints.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No reorder points found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by setting up your first reorder point'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Location</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Current Stock</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Reorder Point</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Reorder Quantity</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Lead Time</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredReorderPoints.map((rop) => (
                    <tr key={rop.id} className="hover:bg-gray-50">
                      <td className="py-4">
                        <div>
                          <p className="font-medium text-gray-900">{rop.product_name}</p>
                          <p className="text-sm text-gray-500">SKU: {rop.product_sku}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p>{rop.location_name}</p>
                          <p className="text-gray-500">ID: {rop.location_id}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p className="font-medium">{rop.current_stock} units</p>
                          <p className="text-gray-500">{rop.days_of_stock} days of stock</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p className="font-medium">{rop.reorder_point} units</p>
                          <p className="text-gray-500">Min: {rop.min_stock_level}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p className="font-medium">{rop.reorder_quantity} units</p>
                          <p className="text-gray-500">Max: {rop.max_stock_level}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p>{rop.lead_time_days} days</p>
                          <p className="text-gray-500">Safety: {rop.safety_stock}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(rop.stock_status || 'optimal')}`}>
                            {getStatusIcon(rop.stock_status || 'optimal')}
                            <span className="ml-1">{rop.stock_status?.replace('_', ' ') || 'unknown'}</span>
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
