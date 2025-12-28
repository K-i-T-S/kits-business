import {
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Building,
  Edit,
  Trash2,
  Users,
} from 'lucide-react';
import { Fragment, useMemo, useState, useEffect } from 'react';

import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import type { Supplier, CreateSupplierForm } from '../types/inventory';

export default function SupplierManagement() {
  const { setModalOpen } = useApp();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockSuppliers: Supplier[] = [
        {
          id: 'sup-1',
          tenant_id: 'tenant-1',
          name: 'Dairy Farm Co.',
          contact_person: 'John Smith',
          email: 'orders@dairyfarm.com',
          phone: '+1-555-0101',
          address: '123 Farm Road',
          city: 'Milkville',
          state: 'CA',
          zip_code: '90210',
          country: 'USA',
          tax_id: '12-3456789',
          payment_terms: 'NET30',
          lead_time_days: 3,
          min_order_amount: 500,
          is_active: true,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'sup-2',
          tenant_id: 'tenant-1',
          name: 'Tech Components Ltd.',
          contact_person: 'Sarah Johnson',
          email: 'sarah@techcomponents.com',
          phone: '+1-555-0102',
          address: '456 Tech Boulevard',
          city: 'Silicon Valley',
          state: 'CA',
          zip_code: '94025',
          country: 'USA',
          tax_id: '98-7654321',
          payment_terms: 'NET15',
          lead_time_days: 7,
          min_order_amount: 1000,
          is_active: true,
          created_at: '2024-01-10T10:00:00Z',
          updated_at: '2024-01-10T10:00:00Z',
        },
      ];
      setSuppliers(mockSuppliers);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && supplier.is_active) ||
      (filterStatus === 'inactive' && !supplier.is_active);
    return matchesSearch && matchesStatus;
  });

  const supplierStats = [
    {
      label: 'Total Suppliers',
      value: suppliers.length,
      subcopy: 'Registered partners',
      critical: false,
    },
    {
      label: 'Active Suppliers',
      value: suppliers.filter(s => s.is_active).length,
      subcopy: 'Currently trading',
      critical: false,
    },
    {
      label: 'Avg Lead Time',
      value: `${Math.round(suppliers.reduce((sum, s) => sum + (s.lead_time_days || 0), 0) / suppliers.length || 0)} days`,
      subcopy: 'Delivery window',
      critical: false,
    },
    {
      label: 'Inactive',
      value: suppliers.filter(s => !s.is_active).length,
      subcopy: 'Need attention',
      critical: suppliers.filter(s => !s.is_active).length > 0,
    },
  ];

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setShowAddModal(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowAddModal(true);
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      try {
        // TODO: Implement actual API call
        // await supabase
        //   .from('suppliers')
        //   .delete()
        //   .eq('id', supplierId)
        //   .eq('tenant_id', currentTenantId);

        setSuppliers(suppliers.filter(s => s.id !== supplierId));
      } catch (error) {
        console.error('Error deleting supplier:', error);
      }
    }
  };

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero Section */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Supplier Network</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">
                Strategic Partner Management
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Track supplier performance, manage contact information, and optimize procurement relationships.
                Keep your supply chain organized with real-time lead times and payment terms.
              </p>
            </div>
            <button
              onClick={handleAddSupplier}
              className="tilt-hover flex items-center gap-2 rounded-2xl border border-white/60 bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-white shadow-lg shadow-indigo-500/30"
            >
              <Plus className="h-4 w-4" />
              New Supplier
            </button>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {supplierStats.map((stat) => (
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
              <h2 className="text-lg font-semibold text-white">Supplier Directory</h2>
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
              placeholder="Search suppliers by name, contact person, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 pl-12 pr-4 py-3 text-white placeholder-white/60 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </section>

        {/* Suppliers Table */}
        <section className="glass-panel p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                <p className="mt-4 text-sm text-gray-600">Loading suppliers...</p>
              </div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No suppliers found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first supplier'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Supplier</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Contact</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Location</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Terms</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Lead Time</th>
                    <th className="pb-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="pb-3 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="py-4">
                        <div>
                          <p className="font-medium text-gray-900">{supplier.name}</p>
                          <p className="text-sm text-gray-500">ID: {supplier.id}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div>
                          <p className="text-sm text-gray-900">{supplier.contact_person}</p>
                          <p className="text-sm text-gray-500">{supplier.email}</p>
                          <p className="text-sm text-gray-500">{supplier.phone}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p>{supplier.city}, {supplier.state}</p>
                          <p className="text-gray-500">{supplier.country}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-900">
                          <p>{supplier.payment_terms}</p>
                          <p className="text-gray-500">Min: ${supplier.min_order_amount}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          {supplier.lead_time_days} days
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          supplier.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {supplier.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditSupplier(supplier)}
                            className="p-1 text-gray-600 hover:text-indigo-600"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSupplier(supplier.id)}
                            className="p-1 text-gray-600 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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