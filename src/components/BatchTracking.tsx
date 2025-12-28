import {
  Search,
  Plus,
  Calendar,
  Package,
  MapPin,
  AlertTriangle,
  Layers,
  Clock,
} from 'lucide-react';
import { Fragment, useMemo, useState, useEffect } from 'react';

import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import type { ProductBatch } from '../types/inventory';

export default function BatchTracking() {
  const { setModalOpen } = useApp();
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockBatches: ProductBatch[] = [
        {
          id: 'batch-1',
          tenant_id: 'tenant-1',
          product_id: 'prod-1',
          batch_number: 'BATCH-001',
          quantity: 100,
          quantity_reserved: 0,
          quantity_available: 100,
          unit_cost: 2.50,
          manufacture_date: '2024-01-01',
          expiration_date: '2024-06-01',
          received_date: '2024-01-01',
          location_id: 'loc-1',
          supplier_id: 'sup-1',
          notes: 'Fresh dairy batch',
          is_active: true,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 'batch-2',
          tenant_id: 'tenant-1',
          product_id: 'prod-2',
          batch_number: 'BATCH-002',
          quantity: 50,
          quantity_reserved: 10,
          quantity_available: 40,
          unit_cost: 15.00,
          manufacture_date: '2023-12-01',
          expiration_date: '2024-05-01',
          received_date: '2023-12-01',
          location_id: 'loc-2',
          supplier_id: 'sup-2',
          notes: 'Tech components batch',
          is_active: false,
          created_at: '2023-12-01T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'batch-3',
          tenant_id: 'tenant-1',
          product_id: 'prod-3',
          batch_number: 'BATCH-003',
          quantity: 200,
          quantity_reserved: 25,
          quantity_available: 175,
          unit_cost: 1.25,
          manufacture_date: '2024-01-10',
          expiration_date: '2024-07-10',
          received_date: '2024-01-10',
          location_id: 'loc-1',
          supplier_id: 'sup-3',
          notes: 'Beverage batch',
          is_active: true,
          created_at: '2024-01-10T10:00:00Z',
          updated_at: '2024-01-10T10:00:00Z',
        },
      ];
      setBatches(mockBatches);
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBatches = batches.filter((batch) => {
    const matchesSearch =
      batch.batch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && batch.is_active) ||
      (filterStatus === 'inactive' && !batch.is_active);
    return matchesSearch && matchesStatus;
  });

  const batchStats = [
    {
      label: 'Total Batches',
      value: batches.length,
      subcopy: 'Tracked batches',
      critical: false,
    },
    {
      label: 'Active Batches',
      value: batches.filter(b => b.is_active).length,
      subcopy: 'Currently valid',
      critical: false,
    },
    {
      label: 'Inactive',
      value: batches.filter(b => !b.is_active).length,
      subcopy: 'Need attention',
      critical: batches.filter(b => !b.is_active).length > 0,
    },
    {
      label: 'Total Quantity',
      value: batches.reduce((sum, b) => sum + b.quantity, 0),
      subcopy: 'Units tracked',
      critical: false,
    },
  ];

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const getExpirationStatus = (expirationDate: string | undefined) => {
    if (!expirationDate) {
      return { text: 'No expiry', color: 'text-gray-600' };
    }
    const today = new Date();
    const expDate = new Date(expirationDate);
    const daysUntilExpiration = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiration < 0) {
      return { text: 'Expired', color: 'text-red-600' };
    } else if (daysUntilExpiration <= 7) {
      return { text: `${daysUntilExpiration} days`, color: 'text-orange-600' };
    } else if (daysUntilExpiration <= 30) {
      return { text: `${daysUntilExpiration} days`, color: 'text-yellow-600' };
    } else {
      return { text: `${daysUntilExpiration} days`, color: 'text-green-600' };
    }
  };

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero Section */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Batch Intelligence</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">
                Product Batch Tracking
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Monitor product batches, track expiration dates, and manage inventory quality.
                Ensure product safety with real-time batch status and automated expiration alerts.
              </p>
            </div>
            <button
              className="tilt-hover flex items-center gap-2 rounded-2xl border border-white/60 bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-white shadow-lg shadow-indigo-500/30"
            >
              <Plus className="h-4 w-4" />
              New Batch
            </button>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {batchStats.map((stat) => (
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
              <h2 className="text-lg font-semibold text-white">Batch Directory</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="all" className="text-gray-900">All Status</option>
                <option value="active" className="text-gray-900">Active</option>
                <option value="inactive" className="text-gray-900">Inactive</option>
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
              placeholder="Search batches by number or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 pl-12 pr-4 py-3 text-white placeholder-white/60 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </section>

        {/* Batches Table */}
        <section className="glass-panel p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                <p className="mt-4 text-sm text-gray-600">Loading batches...</p>
              </div>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No batches found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first batch'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Batch</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Quantity</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Unit Cost</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Manufactured</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Expires</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredBatches.map((batch) => {
                    const expirationStatus = getExpirationStatus(batch.expiration_date);
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="py-4">
                          <div>
                            <p className="font-medium text-gray-900">{batch.batch_number}</p>
                            <p className="text-sm text-gray-500">ID: {batch.id}</p>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="text-sm text-gray-900">
                            <p>Product ID: {batch.product_id}</p>
                            {batch.notes && <p className="text-gray-500">{batch.notes}</p>}
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="text-sm text-gray-900">
                            <p>{batch.quantity_available} available</p>
                            <p className="text-gray-500">{batch.quantity_reserved} reserved</p>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-gray-900">${batch.unit_cost.toFixed(2)}</span>
                        </td>
                        <td className="py-4">
                          <div className="text-sm text-gray-900">
                            {batch.manufacture_date ? (
                              <>
                                <p>{new Date(batch.manufacture_date).toLocaleDateString()}</p>
                                <p className="text-gray-500">
                                  {Math.ceil((new Date().getTime() - new Date(batch.manufacture_date).getTime()) / (1000 * 60 * 60 * 24))} days ago
                                </p>
                              </>
                            ) : (
                              <p className="text-gray-500">Unknown</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="text-sm">
                            {batch.expiration_date ? (
                              <>
                                <p>{new Date(batch.expiration_date).toLocaleDateString()}</p>
                                <p className={`font-medium ${expirationStatus.color}`}>
                                  {expirationStatus.text}
                                </p>
                              </>
                            ) : (
                              <p className="text-gray-500">No expiration</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(batch.is_active)}`}>
                            {batch.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="text-sm text-gray-900">
                            <p>Location ID: {batch.location_id}</p>
                            <p className="text-gray-500">Supplier: {batch.supplier_id}</p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
