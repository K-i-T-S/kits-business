import {
  Search,
  AlertTriangle,
  TrendingUp,
  Package,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import React from 'react';
import { useState, useEffect, useCallback } from 'react';

import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';

type StockStatus = 'out_of_stock' | 'low_stock' | 'optimal' | 'overstock';

interface ProductReorderData {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  stock_quantity: number;
  min_stock_level: number;
  stock_status: StockStatus;
  editing: boolean;
  newMinLevel: number;
}

function computeStatus(qty: number, min: number): StockStatus {
  if (qty === 0) return 'out_of_stock';
  if (qty <= min) return 'low_stock';
  if (min > 0 && qty > min * 3) return 'overstock';
  return 'optimal';
}

const STATUS_COLORS: Record<StockStatus, string> = {
  out_of_stock: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  low_stock: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  optimal: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  overstock: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
};

const STATUS_ICONS: Record<StockStatus, React.ReactNode> = {
  out_of_stock: <AlertTriangle className="h-4 w-4" />,
  low_stock: <TrendingUp className="h-4 w-4" />,
  optimal: <Package className="h-4 w-4" />,
  overstock: <BarChart3 className="h-4 w-4" />,
};

export default function ReorderPointManagement() {
  const { setModalOpen } = useApp();
  const [items, setItems] = useState<ProductReorderData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | StockStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('products')
        .select('id, name, sku, category, stock_quantity, min_stock_level')
        .eq('is_active', true)
        .order('name');

      if (dbError) throw dbError;

      setItems(
        (data ?? []).map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          stock_quantity: p.stock_quantity,
          min_stock_level: p.min_stock_level,
          stock_status: computeStatus(p.stock_quantity, p.min_stock_level),
          editing: false,
          newMinLevel: p.min_stock_level,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const startEdit = (id: string) =>
    setItems(prev => prev.map(p => p.id === id ? { ...p, editing: true } : p));

  const cancelEdit = (id: string) =>
    setItems(prev => prev.map(p => p.id === id ? { ...p, editing: false, newMinLevel: p.min_stock_level } : p));

  const saveMinLevel = async (item: ProductReorderData) => {
    setSaving(item.id);
    try {
      const { error: dbError } = await supabase
        .from('products')
        .update({ min_stock_level: item.newMinLevel })
        .eq('id', item.id);

      if (dbError) throw dbError;

      setItems(prev => prev.map(p =>
        p.id === item.id
          ? { ...p, min_stock_level: item.newMinLevel, stock_status: computeStatus(p.stock_quantity, item.newMinLevel), editing: false }
          : p,
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  };

  const filtered = items.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && (filterStatus === 'all' || p.stock_status === filterStatus);
  });

  const stats = [
    { label: 'Total Products', value: items.length, subcopy: 'Tracked items', critical: false },
    { label: 'Need Reorder', value: items.filter(r => r.stock_status === 'out_of_stock' || r.stock_status === 'low_stock').length, subcopy: 'Critical items', critical: items.some(r => r.stock_status === 'out_of_stock' || r.stock_status === 'low_stock') },
    { label: 'Optimal Stock', value: items.filter(r => r.stock_status === 'optimal').length, subcopy: 'Well stocked', critical: false },
    { label: 'Overstock', value: items.filter(r => r.stock_status === 'overstock').length, subcopy: 'Excess stock', critical: false },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Inventory Intelligence</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Reorder Point Management</h1>
              <p className="mt-2 text-sm text-white/80">
                Monitor stock levels against minimums and set reorder points for each product.
                Click the edit icon on any row to update the minimum stock level.
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
            <h2 className="text-lg font-semibold text-white">Reorder Directory</h2>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
              className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="all" className="bg-slate-800 text-white">All Status</option>
              <option value="out_of_stock" className="bg-slate-800 text-white">Out of Stock</option>
              <option value="low_stock" className="bg-slate-800 text-white">Low Stock</option>
              <option value="optimal" className="bg-slate-800 text-white">Optimal</option>
              <option value="overstock" className="bg-slate-800 text-white">Overstock</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or category..."
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
              <h3 className="mt-2 text-sm font-semibold text-white">Error loading products</h3>
              <p className="mt-1 text-sm text-white/60">{error}</p>
              <button onClick={loadProducts} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="mx-auto h-12 w-12 text-white/30" />
              <h3 className="mt-2 text-sm font-semibold text-white">
                {items.length === 0 ? 'No products yet' : 'No products match your filters'}
              </h3>
              <p className="mt-1 text-sm text-white/60">
                {items.length === 0
                  ? 'Add products from the Inventory page to manage reorder points.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">Product</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">Category</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">In Stock</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">Min Level</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">Status</th>
                    <th className="pb-3 text-left text-sm font-semibold text-white/70">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="py-4">
                        <p className="font-medium text-white">{p.name}</p>
                        {p.sku && <p className="text-xs text-white/50">SKU: {p.sku}</p>}
                      </td>
                      <td className="py-4 text-sm text-white/70">{p.category ?? '—'}</td>
                      <td className="py-4">
                        <span className={`font-medium ${p.stock_quantity === 0 ? 'text-rose-400' : p.stock_quantity <= p.min_stock_level ? 'text-amber-400' : 'text-white'}`}>
                          {p.stock_quantity} units
                        </span>
                      </td>
                      <td className="py-4">
                        {p.editing ? (
                          <input
                            type="number"
                            min={0}
                            value={p.newMinLevel}
                            onChange={e => setItems(prev => prev.map(x => x.id === p.id ? { ...x, newMinLevel: parseInt(e.target.value, 10) || 0 } : x))}
                            className="w-24 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="text-sm text-white/80">{p.min_stock_level} units</span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.stock_status]}`}>
                          {STATUS_ICONS[p.stock_status]}
                          {p.stock_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4">
                        {p.editing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveMinLevel(p)}
                              disabled={saving === p.id}
                              className="text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                            >
                              {saving === p.id ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={() => cancelEdit(p.id)}
                              className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(p.id)}
                            className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                          >
                            Set Min
                          </button>
                        )}
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
