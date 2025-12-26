import { useMemo, useState } from 'react';
import {
  AlertCircle,
  DollarSign,
  Phone,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';

export default function Customers() {
  const { customers, addCustomer, updateCustomer } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

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
      const newBalance = Math.max(0, customer.debtBalance - amount);
      updateCustomer(customerId, { debtBalance: newBalance });
    }
  };

  const totalDebt = customers.reduce((sum, c) => sum + c.debtBalance, 0);
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalPurchases, 0);

  const formatCurrency = (value: number) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

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
      value: customers.filter((c) => c.debtBalance > 0).length.toLocaleString(),
      helper: 'Priority follow-ups',
      accent: 'from-rose-500/95 via-rose-400/85 to-pink-400/80',
    },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <Sparkles className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 text-white/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Customer success</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">
                Build loyalty with every sale.
              </h1>
              <p className="mt-2 text-sm text-white/80">
                Track purchases, manage outstanding balances, and keep contact details ready for
                fast support—online or at the counter.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="tilt-hover inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
            >
              <Plus className="h-5 w-5" />
              Add customer
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.title}
              className={`tilt-hover rounded-3xl border border-white/10 bg-gradient-to-br ${card.accent} p-5 text-white shadow-lg shadow-slate-900/15`}
            >
              <p className="text-xs uppercase tracking-[0.25em] text-white/70">{card.title}</p>
              <p className="mt-3 text-2xl font-semibold">{card.value}</p>
              <p className="text-sm text-white/80">{card.helper}</p>
            </div>
          ))}
        </section>

        {/* Search */}
        <section className="hero-gradient glass-panel p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Directory</p>
              <h2 className="text-lg font-semibold text-white">Find the right customer fast</h2>
            </div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/70">
              Kits-ready workflow
            </p>
          </div>
          <div className="mt-4 relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search by name or phone number…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/30 bg-white/20 py-3 pl-12 pr-4 text-sm text-white placeholder-white/50 shadow-inner focus:border-white/50 focus:outline-none"
            />
          </div>
        </section>

        {/* Customers List */}
        <section className="hero-gradient glass-panel overflow-hidden p-0 text-white">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <table className="w-full text-left text-sm text-white/80">
                <thead className="bg-white/10 text-xs uppercase tracking-[0.2em] text-white/60">
                  <tr>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Total purchases</th>
                    <th className="px-6 py-4">Debt balance</th>
                    <th className="hidden sm:table-cell px-6 py-4">Last purchase</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20 bg-white/10">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="transition hover:bg-white/20">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{customer.name}</p>
                            <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                              Customer profile
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-white/80">
                          <Phone className="h-4 w-4 text-white/60" />
                          <span className="text-sm">{customer.phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-white/80">
                          <TrendingUp className="h-4 w-4 text-emerald-400" />
                          <span className="text-sm">{formatCurrency(customer.totalPurchases)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {customer.debtBalance > 0 ? (
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
                        {customer.debtBalance > 0 && (
                          <button
                            onClick={() => {
                              const amount = prompt(`Enter payment amount (Max: ${formatCurrency(customer.debtBalance)}):`);
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

        {/* Add Customer Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="hero-gradient glass-panel w-full max-w-md space-y-4 p-6 text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">New loyalty profile</p>
                <h2 className="text-xl font-semibold text-white">Add customer</h2>
                <p className="text-sm text-white/80">
                  Save customer details to speed up service, warranties, and follow-ups.
                </p>
              </div>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white/80">Customer name</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/30 bg-white/20 px-4 py-3 text-sm text-white placeholder-white/50 focus:border-white/50 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white/80">Phone number</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/30 bg-white/20 px-4 py-3 text-sm text-white placeholder-white/50 focus:border-white/50 focus:outline-none"
                    required
                  />
                </div>
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-2xl border border-white/30 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/20"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
                  >
                    Save customer
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
