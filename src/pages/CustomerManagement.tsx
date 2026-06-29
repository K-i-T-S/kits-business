import {
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  Search,
  Send,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

import CustomerCommunicationHistory from '../components/crm/CustomerCommunicationHistory';
import CustomerSegmentation from '../components/crm/CustomerSegmentation';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';

export default function CustomerManagement() {
  const { customers, addCustomer } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'segments' | 'campaigns' | 'analytics'>('overview');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [_filters, _setFilters] = useState({ status: 'all', source: 'all' });
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', email: '', phone: '' });

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone ?? '').includes(searchQuery),
    );
  }, [customers, searchQuery]);

  const stats = useMemo(() => ({
    totalCustomers: customers.length,
    totalRevenue: customers.reduce((s, c) => s + c.totalPurchases, 0),
    totalDebt: customers.reduce((s, c) => s + c.debtBalance, 0),
    withDebt: customers.filter(c => c.debtBalance > 0).length,
  }), [customers]);

  const formatCurrency = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) return;
    void addCustomer({
      id: crypto.randomUUID(),
      name: newCustomerForm.name.trim(),
      phone: newCustomerForm.phone,
      email: newCustomerForm.email,
      debtBalance: 0,
      totalPurchases: 0,
    });
    toast.success('Customer added');
    setNewCustomerForm({ name: '', email: '', phone: '' });
    setShowAddCustomerModal(false);
  };

  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  if (showCustomerDetails && selectedCustomerData) {
    return (
      <Layout>
        <div className="space-y-6 pb-4 lg:pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCustomerDetails(false)}
              className="p-2 rounded-xl bg-white/10 border border-white/20 text-white/60 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white">{selectedCustomerData.name}</h1>
              <p className="text-sm text-white/60">Customer Profile</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Information</h2>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Email', value: selectedCustomerData.email || 'Not provided' },
                    { label: 'Phone', value: selectedCustomerData.phone || 'Not provided' },
                  ].map(row => (
                    <div key={row.label}>
                      <p className="text-white/50 text-xs uppercase tracking-wider">{row.label}</p>
                      <p className="text-white mt-0.5">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Purchase Stats</h2>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Total Spent', value: formatCurrency(selectedCustomerData.totalPurchases) },
                    { label: 'Debt Balance', value: formatCurrency(selectedCustomerData.debtBalance) },
                    { label: 'Visits', value: String(selectedCustomerData.visitCount ?? 0) },
                    { label: 'Last Purchase', value: formatDate(selectedCustomerData.lastPurchaseDate) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-white/60">{row.label}</span>
                      <span className="font-medium text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <CustomerCommunicationHistory
                customerId={selectedCustomerData.id}
                communications={[]}
              />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-4 lg:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Customer Management</h1>
            <p className="text-sm text-white/60">Manage customer relationships and communications</p>
          </div>
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="inline-flex items-center gap-2 rounded-xl btn-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'overview', label: 'Overview', icon: Users },
            { id: 'segments', label: 'Segments', icon: Filter },
            { id: 'campaigns', label: 'Campaigns', icon: Send },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Customers', value: stats.totalCustomers, icon: Users, color: 'text-indigo-400' },
                { label: 'Lifetime Revenue', value: formatCurrency(stats.totalRevenue), icon: TrendingUp, color: 'text-emerald-400' },
                { label: 'Outstanding Debt', value: formatCurrency(stats.totalDebt), icon: Clock, color: 'text-amber-400' },
                { label: 'Accounts with Debt', value: stats.withDebt, icon: CheckCircle2, color: 'text-rose-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <stat.icon className={`h-5 w-5 ${stat.color} mb-3`} />
                  <p className="text-xs text-white/50 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl font-semibold text-white mt-1">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-white/5">
                    <tr>
                      {['Customer', 'Contact', 'Total Spent', 'Debt', 'Last Purchase', 'Actions'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm font-semibold text-indigo-300">
                              {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-white">{customer.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-white/80">{customer.email || '-'}</div>
                          <div className="text-xs text-white/50">{customer.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                          {formatCurrency(customer.totalPurchases)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {customer.debtBalance > 0 ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {formatCurrency(customer.debtBalance)}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-400">Clear</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/50">
                          {formatDate(customer.lastPurchaseDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => { setSelectedCustomer(customer.id); setShowCustomerDetails(true); }}
                            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredCustomers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-10 w-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/60">No customers found</p>
                  <p className="text-white/40 text-sm">Add a customer or try a different search</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Segments Tab */}
        {activeTab === 'segments' && (
          <CustomerSegmentation
            segments={[]}
            customers={customers.map(c => ({
              ...c,
              visitCount: c.visitCount ?? 0,
              createdAt: c.createdAt ?? new Date().toISOString(),
            }))}
          />
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <Send className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Marketing Campaigns</h3>
            <p className="text-white/50 text-sm max-w-sm mx-auto">
              Create targeted campaigns for your customer segments. This feature will be available in a future update.
            </p>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4">Customer Overview</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Total customers', value: stats.totalCustomers },
                  { label: 'With outstanding debt', value: stats.withDebt },
                  { label: 'Without debt', value: stats.totalCustomers - stats.withDebt },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-white/60">{row.label}</span>
                    <span className="font-medium text-white">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4">Revenue Metrics</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Total lifetime revenue', value: formatCurrency(stats.totalRevenue) },
                  { label: 'Total outstanding debt', value: formatCurrency(stats.totalDebt) },
                  { label: 'Revenue per customer', value: formatCurrency(stats.totalCustomers > 0 ? stats.totalRevenue / stats.totalCustomers : 0) },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-white/60">{row.label}</span>
                    <span className="font-medium text-white">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add Customer Modal */}
        {showAddCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Add New Customer</h3>
                <button onClick={() => setShowAddCustomerModal(false)} className="text-white/40 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500"
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500"
                    placeholder="customer@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500"
                    placeholder="+961 X XXX XXX"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(false)}
                    className="flex-1 rounded-xl border border-white/20 bg-white/5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl btn-brand py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
                  >
                    Add Customer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
