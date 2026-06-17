import { Search, ShoppingCart } from 'lucide-react';
import { useState, useEffect } from 'react';

import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';

export default function PurchaseOrderManagement() {
  const { setModalOpen } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  const stats = [
    { label: 'Total Orders', value: 0, subcopy: 'Purchase orders',   critical: false },
    { label: 'Pending',      value: 0, subcopy: 'Awaiting delivery', critical: false },
    { label: 'Received',     value: 0, subcopy: 'Completed orders',  critical: false },
    { label: 'Total Value',  value: '$0.00', subcopy: 'Order value', critical: false },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Procurement Hub</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Purchase Order Management</h1>
              <p className="mt-2 text-sm text-white/80">
                Track purchase orders from creation to delivery and maintain complete procurement
                visibility.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg backdrop-blur-xl text-white">
              <p className="text-xs uppercase tracking-[0.25em] text-white/70">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
              <p className="text-sm text-white/80">{stat.subcopy}</p>
            </div>
          ))}
        </section>

        <section className="hero-gradient glass-panel p-6 text-white space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-white">Order Directory</h2>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="all"       className="bg-slate-800 text-white">All Status</option>
              <option value="draft"     className="bg-slate-800 text-white">Draft</option>
              <option value="sent"      className="bg-slate-800 text-white">Sent</option>
              <option value="confirmed" className="bg-slate-800 text-white">Confirmed</option>
              <option value="partial"   className="bg-slate-800 text-white">Partial</option>
              <option value="received"  className="bg-slate-800 text-white">Received</option>
              <option value="cancelled" className="bg-slate-800 text-white">Cancelled</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search orders by number, supplier, or notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 pl-12 pr-4 py-3 text-white placeholder-white/60 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </section>

        <section className="glass-panel p-6">
          <div className="text-center py-16">
            <ShoppingCart className="mx-auto h-14 w-14 text-white/20" />
            <h3 className="mt-4 text-lg font-semibold text-white">Purchase Orders Coming Soon</h3>
            <p className="mt-2 max-w-md mx-auto text-sm text-white/60">
              Full purchase order management — create orders, track deliveries, and reconcile
              received stock — will be available in a future update once supplier management
              is in place.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
