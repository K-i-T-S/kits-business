import { Search, Truck, Plus, X, CheckCircle, ArrowRight, Package } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';

// ── Types ──────────────────────────────────────────────────────

interface TransferItem {
  id: string;
  product_id: string;
  quantity: number;
  products: { name: string; sku: string | null } | null;
}

interface StockTransfer {
  id: string;
  from_location: string;
  to_location: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  stock_transfer_items: TransferItem[];
}

interface NewTransferItem {
  product_id: string;
  quantity: number;
  product_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_transit: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// ── Component ──────────────────────────────────────────────────

export default function StockTransferManagement() {
  const { setModalOpen, products } = useApp();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Create form state
  const [fromLocation, setFromLocation] = useState('Main Store');
  const [toLocation, setToLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [newItems, setNewItems] = useState<NewTransferItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_transfers')
        .select('*, stock_transfer_items(*, products(name, sku))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTransfers((data ?? []) as StockTransfer[]);
    } catch (err) {
      toast.error('Failed to load transfers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTransfers(); }, [loadTransfers]);

  // ── Derived stats ──────────────────────────────────────────

  const totalQty = transfers.reduce(
    (sum, t) => sum + t.stock_transfer_items.reduce((s, i) => s + i.quantity, 0), 0,
  );

  const stats = [
    { label: 'Total Transfers', value: transfers.length, subcopy: 'Stock movements' },
    { label: 'In Transit', value: transfers.filter(t => t.status === 'in_transit').length, subcopy: 'Currently moving' },
    { label: 'Completed', value: transfers.filter(t => t.status === 'completed').length, subcopy: 'Delivered' },
    { label: 'Total Units', value: totalQty, subcopy: 'Units transferred' },
  ];

  // ── Filtering ──────────────────────────────────────────────

  const filtered = transfers.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.from_location.toLowerCase().includes(q) ||
      t.to_location.toLowerCase().includes(q) ||
      (t.notes ?? '').toLowerCase().includes(q) ||
      t.stock_transfer_items.some(i => i.products?.name.toLowerCase().includes(q))
    );
  });

  // ── Create transfer ────────────────────────────────────────

  const addItemToNewTransfer = () => {
    if (!selectedProductId || selectedQty < 1) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    if (newItems.some(i => i.product_id === selectedProductId)) {
      toast.error('Product already added to this transfer');
      return;
    }
    setNewItems(prev => [...prev, { product_id: selectedProductId, quantity: selectedQty, product_name: product.name }]);
    setSelectedProductId('');
    setSelectedQty(1);
  };

  const removeItem = (productId: string) => {
    setNewItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toLocation.trim()) { toast.error('Destination location is required'); return; }
    if (newItems.length === 0) { toast.error('Add at least one product'); return; }

    setSubmitting(true);
    try {
      const { data: transferRow, error: transferErr } = await supabase
        .from('stock_transfers')
        .insert({ from_location: fromLocation.trim(), to_location: toLocation.trim(), notes: notes.trim() || null })
        .select()
        .single();
      if (transferErr) throw transferErr;

      const { error: itemsErr } = await supabase
        .from('stock_transfer_items')
        .insert(newItems.map(i => ({ transfer_id: (transferRow as { id: string }).id, product_id: i.product_id, quantity: i.quantity })));
      if (itemsErr) throw itemsErr;

      toast.success('Transfer created');
      setShowCreateForm(false);
      setToLocation('');
      setNotes('');
      setNewItems([]);
      loadTransfers();
    } catch (err) {
      toast.error('Failed to create transfer');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Status updates ─────────────────────────────────────────

  const advanceStatus = async (transfer: StockTransfer) => {
    const next: Record<string, string> = { pending: 'in_transit', in_transit: 'completed' };
    const newStatus = next[transfer.status];
    if (!newStatus) return;

    try {
      const patch: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'completed') patch.completed_at = new Date().toISOString();

      const { error } = await supabase.from('stock_transfers').update(patch).eq('id', transfer.id);
      if (error) throw error;
      toast.success(`Transfer marked as ${newStatus.replace('_', ' ')}`);
      loadTransfers();
    } catch (err) {
      toast.error('Failed to update transfer status');
      console.error(err);
    }
  };

  const cancelTransfer = async (id: string) => {
    try {
      const { error } = await supabase.from('stock_transfers').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      toast.success('Transfer cancelled');
      loadTransfers();
    } catch (err) {
      toast.error('Failed to cancel transfer');
      console.error(err);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Logistics Control</p>
              <h1 className="mt-3 text-3xl font-semibold text-white">Stock Transfer Management</h1>
              <p className="mt-1 text-sm text-white/70">
                Move inventory between locations and track every transfer in real-time.
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
            >
              <Plus className="h-4 w-4" /> New Transfer
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg backdrop-blur-xl text-white">
              <p className="text-xs uppercase tracking-widest text-white/70">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
              <p className="text-sm text-white/60">{stat.subcopy}</p>
            </div>
          ))}
        </section>

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <form
              onSubmit={handleCreateTransfer}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">New Stock Transfer</h2>
                <button type="button" onClick={() => setShowCreateForm(false)} className="text-white/60 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-white/60">From Location</label>
                    <input
                      value={fromLocation}
                      onChange={e => setFromLocation(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      placeholder="e.g. Main Store"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-white/60">To Location</label>
                    <input
                      value={toLocation}
                      onChange={e => setToLocation(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      placeholder="e.g. Branch 2"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-white/60">Notes (optional)</label>
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    placeholder="Any notes about this transfer..."
                  />
                </div>

                {/* Add item row */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-white/60">Product</label>
                    <select
                      value={selectedProductId}
                      onChange={e => setSelectedProductId(e.target.value)}
                      className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Select product…</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block text-xs text-white/60">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedQty}
                      onChange={e => setSelectedQty(Number(e.target.value))}
                      className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addItemToNewTransfer}
                    className="rounded-xl border border-indigo-500/40 px-3 py-2 text-sm text-indigo-400 hover:bg-indigo-500/10"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Items list */}
                {newItems.length > 0 && (
                  <ul className="space-y-1.5 rounded-xl border border-white/10 bg-white/5 p-3">
                    {newItems.map(item => (
                      <li key={item.product_id} className="flex items-center justify-between text-sm text-white">
                        <span>{item.product_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-white/60">×{item.quantity}</span>
                          <button type="button" onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-300">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm text-white/60 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || newItems.length === 0}
                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create Transfer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <section className="hero-gradient glass-panel p-5 text-white space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              <input
                type="text"
                placeholder="Search by location, product, or notes…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-white/20 bg-white/10 py-2.5 pe-4 ps-11 text-sm text-white placeholder-white/50 focus:border-white/40 focus:outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </section>

        {/* Transfer List */}
        <section className="glass-panel p-5">
          {loading ? (
            <div className="py-16 text-center text-white/40">Loading transfers…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Truck className="mx-auto h-12 w-12 text-white/20" />
              <p className="mt-3 text-white/40">
                {searchQuery || filterStatus !== 'all' ? 'No transfers match your filters.' : 'No stock transfers yet. Create your first one.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(transfer => (
                <div
                  key={transfer.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      {/* Route */}
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Package className="h-4 w-4 text-indigo-400" />
                        <span>{transfer.from_location}</span>
                        <ArrowRight className="h-4 w-4 text-white/40" />
                        <span>{transfer.to_location}</span>
                      </div>

                      {/* Items summary */}
                      <p className="text-xs text-white/50">
                        {transfer.stock_transfer_items.length} product{transfer.stock_transfer_items.length !== 1 ? 's' : ''}
                        {' · '}
                        {transfer.stock_transfer_items.reduce((s, i) => s + i.quantity, 0)} units
                        {transfer.notes ? ` · ${transfer.notes}` : ''}
                      </p>

                      {/* Item names */}
                      {transfer.stock_transfer_items.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {transfer.stock_transfer_items.slice(0, 3).map(item => (
                            <span key={item.id} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">
                              {item.products?.name ?? '—'} ×{item.quantity}
                            </span>
                          ))}
                          {transfer.stock_transfer_items.length > 3 && (
                            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">
                              +{transfer.stock_transfer_items.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-white/40">
                        {new Date(transfer.created_at).toLocaleDateString('en-LB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[transfer.status] ?? ''}`}>
                        {transfer.status.replace('_', ' ')}
                      </span>
                      {transfer.status === 'pending' && (
                        <>
                          <button
                            onClick={() => advanceStatus(transfer)}
                            className="rounded-lg border border-blue-500/30 px-3 py-1 text-xs text-blue-400 hover:bg-blue-500/10"
                          >
                            Mark In Transit
                          </button>
                          <button
                            onClick={() => cancelTransfer(transfer.id)}
                            className="rounded-lg border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {transfer.status === 'in_transit' && (
                        <button
                          onClick={() => advanceStatus(transfer)}
                          className="flex items-center gap-1 rounded-lg border border-green-500/30 px-3 py-1 text-xs text-green-400 hover:bg-green-500/10"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
