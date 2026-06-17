import { Search, Package, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';

type StockStatus = 'out_of_stock' | 'low_stock' | 'ok';

interface TrackedProduct {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  stock_quantity: number;
  min_stock_level: number;
  stock_status: StockStatus;
}

function getStockStatus(qty: number, min: number): StockStatus {
  if (qty === 0) return 'out_of_stock';
  if (qty <= min) return 'low_stock';
  return 'ok';
}

const STATUS_COLORS: Record<StockStatus, string> = {
  out_of_stock: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  low_stock:    'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  ok:           'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
};

const STATUS_LABELS: Record<StockStatus, string> = {
  out_of_stock: 'Out of Stock',
  low_stock:    'Low Stock',
  ok:           'OK',
};

export default function BatchTracking() {
  const { setModalOpen } = useApp();
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | StockStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('products')
        .select('id, name, sku, category, stock_quantity, min_stock_level')
        .eq('is_active', true)
        .order('name');

      if (dbError) throw dbError;

      setProducts(
        (data ?? []).map(p => ({
          id:             p.id,
          name:           p.name,
          sku:            p.sku,
          category:       p.category,
          stock_quantity: p.stock_quantity,
          min_stock_level: p.min_stock_level,
          stock_status:   getStockStatus(p.stock_quantity, p.min_stock_level),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && (filterStatus === 'all' || p.stock_status === filterStatus);
  });

  const stats = [
    { label: 'Total Products',  value: products.length,                                              subcopy: 'Tracked items',      critical: false },
    { label: 'Out of Stock',    value: products.filter(p => p.stock_status === 'out_of_stock').length, subcopy: 'Needs restock',       critical: products.some(p => p.stock_status === 'out_of_stock') },
    { label: 'Low Stock',       value: products.filter(p => p.stock_status === 'low_stock').length,    subcopy: 'At or below minimum', critical: products.some(p => p.stock_status === 'low_stock') },
    { label: 'Well Stocked',    value: products.filter(p => p.stock_status === 'ok').length,           subcopy: 'Above minimum',       critical: false },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Inventory Intelligence</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Batch & Stock Tracking</h1>
              <p className="mt-2 text-sm text-white/80">
                Monitor product stock levels and flag items that need attention.
                Full batch and expiry date tracking will be available in an upcoming update.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg backdrop-blur-xl text-white">
              <p className="text-xs uppercase tracking-[0.25em] text-white/70">{stat.label}</p>
              <p className={`mt-3 text-3xl font-semibold ${stat.critical ? 'text-amber-400' : 'text-white'}`}>
                {stat.value}
              </p>
              <p className="text-sm text-white/80">{stat.subcopy}</p>
            </div>
          ))}
        </section>

        <section className="hero-gradient glass-panel p-6 text-white space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-white">Product Inventory</h2>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
              className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="all"          className="bg-slate-800 text-white">All Status</option>
              <option value="out_of_stock" className="bg-slate-800 text-white">Out of Stock</option>
              <option value="low_stock"    className="bg-slate-800 text-white">Low Stock</option>
              <option value="ok"           className="bg-slate-800 text-white">OK</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search by product name, SKU, or category..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 pl-12 pr-4 py-3 text-white placeholder-white/60 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </section>

        <section className="glass-panel p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                <p className="mt-4 text-sm text-white/60">Loading products…</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
              <h3 className="mt-2 text-sm font-semibold text-white">Failed to load products</h3>
              <p className="mt-1 text-sm text-white/60">{error}</p>
              <button onClick={loadProducts} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-white/30" />
              <h3 className="mt-2 text-sm font-semibold text-white">
                {products.length === 0 ? 'No products yet' : 'No products match your filters'}
              </h3>
              <p className="mt-1 text-sm text-white/60">
                {products.length === 0
                  ? 'Add products from the Inventory page to start tracking stock levels.'
                  : 'Try adjusting your search or status filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">Product</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">SKU</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">Category</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">In Stock</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">Min Level</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="py-4 font-medium text-white">{p.name}</td>
                      <td className="py-4 text-sm text-white/70">{p.sku ?? '—'}</td>
                      <td className="py-4 text-sm text-white/70">{p.category ?? '—'}</td>
                      <td className="py-4">
                        <span className={`font-medium ${p.stock_quantity === 0 ? 'text-rose-400' : p.stock_quantity <= p.min_stock_level ? 'text-amber-400' : 'text-white'}`}>
                          {p.stock_quantity} units
                        </span>
                      </td>
                      <td className="py-4 text-sm text-white/70">{p.min_stock_level} units</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.stock_status]}`}>
                          {STATUS_LABELS[p.stock_status]}
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
