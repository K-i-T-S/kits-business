import { Search, Users } from 'lucide-react';
import { useState, useEffect } from 'react';

import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';

export default function SupplierManagement() {
  const { setModalOpen } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  const stats = [
    { label: 'Total Suppliers',  value: 0, subcopy: 'Registered partners', critical: false },
    { label: 'Active Suppliers', value: 0, subcopy: 'Currently trading',   critical: false },
    { label: 'Avg Lead Time',    value: '— days', subcopy: 'Delivery window', critical: false },
    { label: 'Inactive',         value: 0, subcopy: 'Need attention',      critical: false },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Supplier Network</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Strategic Partner Management</h1>
              <p className="mt-2 text-sm text-white/80">
                Track supplier performance, manage contact information, and optimize procurement
                relationships.
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
            <h2 className="text-lg font-semibold text-white">Supplier Directory</h2>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-white backdrop-blur-sm focus:border-white/40 focus:outline-none"
            >
              <option value="all"      className="text-gray-900">All Status</option>
              <option value="active"   className="text-gray-900">Active</option>
              <option value="inactive" className="text-gray-900">Inactive</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search suppliers by name, contact person, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 pl-12 pr-4 py-3 text-white placeholder-white/60 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </section>

        <section className="glass-panel p-6">
          <div className="text-center py-16">
            <Users className="mx-auto h-14 w-14 text-white/20" />
            <h3 className="mt-4 text-lg font-semibold text-white">Supplier Management Coming Soon</h3>
            <p className="mt-2 max-w-md mx-auto text-sm text-white/60">
              Full supplier management — including contact details, lead times, and payment terms —
              will be available in a future update. For now, you can store your supplier name
              directly on each product.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
