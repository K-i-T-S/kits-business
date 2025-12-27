import { useMemo, useState } from 'react';
import {
  AlertCircle,
  DollarSign,
  Phone,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  MessageSquare,
  Users,
  Target,
  Mail,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import CustomerSegmentation from '../components/crm/CustomerSegmentation';
import CustomerCommunicationHistory from '../components/crm/CustomerCommunicationHistory';
import AutomatedMarketing from '../components/crm/AutomatedMarketing';
import CRMAnalytics from '../components/crm/CRMAnalytics';
import MarketingCampaigns from '../components/crm/MarketingCampaigns';

export default function Customers() {
  const { customers, addCustomer, updateCustomer } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [activeTab, setActiveTab] = useState<'overview' | 'segments' | 'communications' | 'marketing' | 'analytics'>('overview');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.phone.includes(searchQuery),
      ),
    [customers, searchQuery],
  );

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    
    const customer = {
      id: Date.now().toString(),
      name: newCustomer.name,
      phone: newCustomer.phone,
      debtBalance: 0,
      totalPurchases: 0
    };

    addCustomer(customer);
    setNewCustomer({ name: '', phone: '' });
    setShowAddModal(false);
  };

  const handlePayDebt = (customerId: string, amount: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      const newBalance = Math.max(0, (customer.debtBalance || 0) - amount);
      updateCustomer(customerId, { debtBalance: newBalance });
    }
  };

  const totalDebt = customers.reduce((sum, c) => sum + (c.debtBalance || 0), 0);
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0);

  const formatCurrency = (value: number | undefined | null) =>
    (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const statCards = [
    {
      title: 'Active profiles',
      value: customers.length.toLocaleString(),
      helper: 'Customers in your database',
      accent: 'from-indigo-500/95 via-indigo-400/85 to-sky-400/80',
    },
    {
      title: 'Lifetime revenue',
      value: formatCurrency(totalRevenue),
      helper: 'All-time purchases',
      accent: 'from-emerald-500/95 via-emerald-400/85 to-lime-400/80',
    },
    {
      title: 'Outstanding debt',
      value: formatCurrency(totalDebt),
      helper: 'Balance awaiting collection',
      accent: 'from-amber-500/95 via-amber-400/85 to-orange-400/80',
    },
    {
      title: 'Accounts with debt',
      value: customers.filter((c) => (c.debtBalance || 0) > 0).length.toLocaleString(),
      helper: 'Priority follow-ups',
      accent: 'from-rose-500/95 via-rose-400/85 to-pink-400/80',
    },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero */}
        <section className="hero-gradient glass-panel relative overflow-hidden rounded-2xl p-4 sm:p-6 md:p-8 text-white">
          <Sparkles className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 text-white/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80 inline-block px-3 py-1 rounded-full text-xs font-medium mb-4">Customer success</p>
              <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                Build loyalty with every sale.
              </h1>
              <p className="mt-3 text-sm sm:text-base text-white/90 leading-relaxed max-w-lg">
                Track purchases, manage outstanding balances, and keep contact details ready for
                fast support—online or at the counter.
              </p>
            </div>
            <div className="lg:flex-shrink-0">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full sm:w-auto tilt-hover inline-flex items-center justify-center gap-2 rounded-xl border border-white/70 bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl transition-all duration-200"
              >
                <Plus className="h-5 w-5" />
                Add customer
              </button>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <section className="hero-gradient glass-panel rounded-2xl p-4 sm:p-6 text-white">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-medium">CRM Features</p>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-1">Customer Management Tools</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'overview', label: 'Overview', icon: Users },
                { id: 'segments', label: 'Segments', icon: Target },
                { id: 'communications', label: 'Communications', icon: MessageSquare },
                { id: 'marketing', label: 'Marketing', icon: Mail },
                { id: 'analytics', label: 'Analytics', icon: TrendingUp },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white border border-white/30 shadow-lg'
                      : 'bg-white/10 text-white/80 border border-white/20 hover:bg-white/15'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6 lg:space-y-8">
            {/* Stats */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {statCards.map((card) => (
                <div
                  key={card.title}
                  className={`tilt-hover rounded-2xl border border-white/10 bg-gradient-to-br ${card.accent} p-4 sm:p-5 text-white shadow-lg shadow-slate-900/15 transition-all duration-300 hover:scale-105`}
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-white/80 font-medium">{card.title}</p>
                  <p className="mt-2 text-xl sm:text-2xl lg:text-3xl font-bold">{card.value}</p>
                  <p className="text-sm text-white/90 mt-1">{card.helper}</p>
                </div>
              ))}
            </section>

            {/* Search */}
            <section className="hero-gradient glass-panel rounded-2xl p-4 sm:p-6 text-white">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/80 font-medium">Directory</p>
                  <h2 className="text-lg sm:text-xl font-bold text-white mt-1">Find the right customer fast</h2>
                </div>
                <div className="md:flex-shrink-0">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/70">
                    Kits-ready workflow
                  </p>
                </div>
              </div>
              <div className="mt-4 relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
                <input
                  type="text"
                  placeholder="Search by name or phone number…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-white/30 bg-white/20 py-3 pl-12 pr-4 text-sm text-white placeholder-white/60 shadow-inner focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all duration-200"
                />
              </div>
            </section>

            {/* Customers List */}
            <section className="hero-gradient glass-panel overflow-hidden rounded-2xl p-0 text-white">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/80 font-medium">Customer Database</p>
                    <h2 className="text-lg sm:text-xl font-bold text-white mt-1">{filteredCustomers.length} customers found</h2>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[600px] sm:min-w-[720px]">
                  <table className="w-full text-left text-sm text-white/90">
                    <thead className="bg-white/10 text-xs uppercase tracking-[0.2em] text-white/80 font-medium">
                      <tr>
                        <th className="px-4 sm:px-6 py-4">Customer</th>
                        <th className="px-4 sm:px-6 py-4">Phone</th>
                        <th className="px-4 sm:px-6 py-4">Total purchases</th>
                        <th className="px-4 sm:px-6 py-4">Debt balance</th>
                        <th className="hidden sm:table-cell px-4 sm:px-6 py-4">Last purchase</th>
                        <th className="px-4 sm:px-6 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/20 bg-white/5">
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="transition hover:bg-white/10">
                          <td className="px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
                                {customer.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-white text-sm sm:text-base">{customer.name}</p>
                                <p className="text-xs uppercase tracking-[0.25em] text-white/70">
                                  Customer profile
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2 text-white/90">
                              <Phone className="h-4 w-4 text-white/60" />
                              <span className="text-sm">{customer.phone}</span>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-2 text-white/90">
                              <TrendingUp className="h-4 w-4 text-emerald-400" />
                              <span className="text-sm font-medium">{formatCurrency(customer.totalPurchases)}</span>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            {(customer.debtBalance || 0) > 0 ? (
                              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-200">
                                <AlertCircle className="h-4 w-4" />
                                {formatCurrency(customer.debtBalance)}
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-300">
                                {formatCurrency(0)}
                              </span>
                            )}
                          </td>
                          <td className="hidden sm:table-cell px-6 py-4 text-xs text-white/60">
                            {customer.lastPurchaseDate
                              ? new Date(customer.lastPurchaseDate).toLocaleDateString()
                              : 'Never'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedCustomer(customer.id)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                              >
                                <MessageSquare className="h-4 w-4" />
                                View
                              </button>
                              {(customer.debtBalance || 0) > 0 && (
                                <button
                                  onClick={() => {
                                    const amount = prompt(`Enter payment amount (Max: ${formatCurrency(customer.debtBalance || 0)}):`);
                                    if (amount) {
                                      const parsedAmount = parseFloat(amount);
                                      if (!isNaN(parsedAmount)) {
                                        handlePayDebt(customer.id, parsedAmount);
                                      }
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                >
                                  <DollarSign className="h-4 w-4" />
                                  Pay debt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {filteredCustomers.length === 0 && (
                <div className="p-10 text-center text-sm text-slate-500">
                  No customers found. Reset filters and try again.
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'segments' && (
          <section className="hero-gradient glass-panel p-6">
            <CustomerSegmentation
              segments={[
                {
                  id: '1',
                  name: 'VIP Customers',
                  description: 'High-value customers with frequent purchases',
                  criteria: { total_purchases: { operator: '>', value: 1000 } },
                  isDynamic: true,
                  customerCount: 12,
                  createdAt: '2024-01-15',
                },
                {
                  id: '2',
                  name: 'New Customers',
                  description: 'Customers who joined in the last 30 days',
                  criteria: { days_since_join: { operator: '<', value: 30 } },
                  isDynamic: true,
                  customerCount: 28,
                  createdAt: '2024-01-10',
                },
              ]}
              customers={customers.map(c => ({
                ...c,
                visitCount: c.visitCount || 0,
                createdAt: c.createdAt || new Date().toISOString(),
              }))}
            />
          </section>
        )}

        {activeTab === 'communications' && (
          <section className="hero-gradient glass-panel p-6">
            {selectedCustomer ? (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-white/80 hover:text-white"
                  >
                    ← Back to customers
                  </button>
                  <h3 className="text-lg font-semibold text-white">
                    {customers.find(c => c.id === selectedCustomer)?.name}
                  </h3>
                </div>
                <CustomerCommunicationHistory
                  customerId={selectedCustomer}
                  communications={[
                    {
                      id: '1',
                      type: 'email',
                      direction: 'outbound',
                      subject: 'Welcome to our store!',
                      content: 'Thank you for joining us. Here is a special offer...',
                      status: 'sent',
                      sentAt: '2024-01-15T10:00:00Z',
                      createdAt: '2024-01-15T10:00:00Z',
                    },
                  ]}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-white">
                <MessageSquare className="mx-auto h-12 w-12 text-white/40" />
                <h3 className="mt-2 text-sm font-semibold text-white">Select a customer</h3>
                <p className="mt-1 text-sm text-white/60">Choose a customer from the overview to view their communication history</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'marketing' && (
          <section className="hero-gradient glass-panel p-6">
            <AutomatedMarketing
              campaigns={[
                {
                  id: '1',
                  name: 'Summer Sale Campaign',
                  description: 'Promote summer products with special discounts',
                  type: 'email',
                  status: 'running',
                  targetSegments: ['1'],
                  targetCustomers: [],
                  content: {
                    subject: 'Summer Sale Special!',
                    body: 'Check out our amazing summer deals...',
                  },
                  schedule: {
                    timezone: 'UTC',
                    bestTimeToSend: true,
                  },
                  performance: {
                    sent: 150,
                    delivered: 140,
                    opened: 120,
                    clicked: 45,
                    replied: 12,
                    bounced: 5,
                    unsubscribed: 3,
                    converted: 8,
                    revenue: 2500,
                    cost: 150,
                    roi: 1566.67,
                  },
                  createdBy: '1',
                  createdAt: '2024-01-10',
                  updatedAt: '2024-01-10',
                },
              ]}
              segments={[]}
              workflows={[]}
              onCreateCampaign={() => {}}
              onUpdateCampaign={() => {}}
              onCreateWorkflow={() => {}}
              onUpdateWorkflow={() => {}}
            />
          </section>
        )}

        {activeTab === 'analytics' && (
          <section className="hero-gradient glass-panel p-6">
            <CRMAnalytics
              customers={customers.map(c => ({
                ...c,
                tags: [],
                source: 'walk_in' as const,
                status: 'active' as const,
                totalSpent: c.totalPurchases,
                averageOrderValue: c.totalPurchases / Math.max(c.visitCount || 1, 1),
                purchaseCount: c.visitCount || 0,
                visitCount: c.visitCount || 0,
                createdAt: c.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }))}
              segments={[]}
              campaigns={[]}
              dateRange={{
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString(),
              }}
              onDateRangeChange={() => {}}
            />
          </section>
        )}

        {/* Add Customer Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="hero-gradient glass-panel w-full max-w-md space-y-6 p-6 sm:p-8 text-white max-h-[90vh] overflow-y-auto">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/80 font-medium">New loyalty profile</p>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">Add customer</h2>
                <p className="text-sm text-white/90 mt-2">
                  Save customer details to speed up service, warranties, and follow-ups.
                </p>
              </div>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Customer name</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="w-full rounded-xl border border-white/30 bg-white/20 px-4 py-3 text-sm text-white placeholder-white/60 shadow-inner focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all duration-200"
                    placeholder="Enter customer name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Phone number</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full rounded-xl border border-white/30 bg-white/20 px-4 py-3 text-sm text-white placeholder-white/60 shadow-inner focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all duration-200"
                    placeholder="Enter phone number"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-xl border border-white/30 bg-slate-800/50 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700/50 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl transition-all duration-200"
                  >
                    Add customer
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
