import {
  Search,
  ShoppingCart,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import Layout from '../components/Layout';
import { supabase } from '../utils/supabaseClient';

// ── Types ──────────────────────────────────────────────────────
type POStatus = 'draft' | 'sent' | 'received' | 'cancelled';

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
}

interface POItem {
  id?: string;
  product_id: string;
  product_name?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
}

interface PurchaseOrder {
  id: string;
  supplier_id: string | null;
  order_number: string;
  status: POStatus;
  expected_delivery: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  received_at: string | null;
  supplier?: { name: string } | null;
  purchase_order_items?: POItem[];
}

// ── Status badge ───────────────────────────────────────────────
const STATUS_STYLES: Record<POStatus, string> = {
  draft: 'bg-white/10 text-white/50',
  sent: 'bg-blue-500/20 text-blue-400',
  received: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

function StatusBadge({ status }: { status: POStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

// ── New PO Form Modal ──────────────────────────────────────────
interface NewPOModalProps {
  suppliers: Supplier[];
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}

function NewPOModal({ suppliers, products, onClose, onSaved }: NewPOModalProps) {
  const [supplierId, setSupplierId] = useState('');
  const [orderNumber, setOrderNumber] = useState(`PO-${Date.now().toString().slice(-6)}`);
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ product_id: string; quantity_ordered: number; unit_cost: number }[]>([
    { product_id: '', quantity_ordered: 1, unit_cost: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems(prev => [...prev, { product_id: '', quantity_ordered: 1, unit_cost: 0 }]);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem<K extends keyof(typeof items)[number]>(
    idx: number,
    key: K,
    value: (typeof items)[number][K],
  ) {
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  const totalAmount = items.reduce((sum, it) => sum + it.quantity_ordered * it.unit_cost, 0);

  async function handleSave() {
    if (!orderNumber.trim()) { setError('Order number is required'); return; }
    const validItems = items.filter(it => it.product_id);
    if (validItems.length === 0) { setError('Add at least one product'); return; }

    setSaving(true);
    setError(null);
    try {
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: supplierId || null,
          order_number: orderNumber.trim(),
          status: 'draft',
          expected_delivery: expectedDelivery || null,
          notes: notes.trim() || null,
          total_amount: totalAmount,
        })
        .select('id')
        .single();
      if (poErr || !po) throw poErr ?? new Error('PO insert failed');

      const lineItems = validItems.map(it => ({
        purchase_order_id: po.id as string,
        product_id: it.product_id,
        quantity_ordered: it.quantity_ordered,
        quantity_received: 0,
        unit_cost: it.unit_cost,
      }));
      const { error: itemErr } = await supabase.from('purchase_order_items').insert(lineItems);
      if (itemErr) throw itemErr;

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-white placeholder-white/40 focus:border-indigo-500 focus:outline-none text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
          <h2 className="text-lg font-semibold text-white">New Purchase Order</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-white/60 mb-1">Order Number *</label>
              <input className={inputCls} value={orderNumber} onChange={e => setOrderNumber(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Supplier</label>
              <select
                className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none text-sm"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
              >
                <option value="">— No supplier —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Expected Delivery</label>
              <input
                className={inputCls}
                type="date"
                value={expectedDelivery}
                onChange={e => setExpectedDelivery(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Notes</label>
              <input className={inputCls} placeholder="Optional notes…" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/60 uppercase tracking-wider">Line Items</label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center rounded-xl bg-white/5 p-3">
                  <div className="col-span-5">
                    <select
                      className="w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      value={item.product_id}
                      onChange={e => updateItem(idx, 'product_id', e.target.value)}
                    >
                      <option value="">Select product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      className="w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none text-center"
                      value={item.quantity_ordered}
                      onChange={e => updateItem(idx, 'quantity_ordered', Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                  <div className="col-span-3">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white/40">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full rounded-lg border border-white/20 bg-slate-800 pl-5 pr-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                        value={item.unit_cost}
                        onChange={e => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="col-span-1 text-right text-xs text-white/60">
                    ${(item.quantity_ordered * item.unit_cost).toFixed(2)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="text-white/30 hover:text-red-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end text-sm font-semibold text-white">
              Total: ${totalAmount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4 shrink-0">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl btn-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? 'Creating…' : 'Create PO'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PO Row (expandable) ────────────────────────────────────────
interface PORowProps {
  po: PurchaseOrder;
  onReceive: (po: PurchaseOrder) => void;
  onStatusChange: (id: string, status: POStatus) => void;
}

function PORow({ po, onReceive, onStatusChange }: PORowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <td className="px-6 py-4">
          <div className="font-mono text-sm text-white">{po.order_number}</div>
          <div className="text-xs text-white/50 mt-0.5">
            {new Date(po.created_at).toLocaleDateString()}
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-white/80">
          {po.supplier?.name ?? <span className="text-white/30">—</span>}
        </td>
        <td className="px-6 py-4">
          <StatusBadge status={po.status} />
        </td>
        <td className="hidden px-6 py-4 text-sm text-white/70 md:table-cell">
          {po.expected_delivery
            ? new Date(po.expected_delivery).toLocaleDateString()
            : '—'}
        </td>
        <td className="px-6 py-4 text-sm font-medium text-white">
          ${po.total_amount.toFixed(2)}
        </td>
        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {po.status === 'draft' && (
              <button
                onClick={() => onStatusChange(po.id, 'sent')}
                className="rounded-lg border border-blue-500/40 px-2.5 py-1 text-xs text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                Mark Sent
              </button>
            )}
            {po.status === 'sent' && (
              <button
                onClick={() => onReceive(po)}
                className="rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                Receive
              </button>
            )}
            {(po.status === 'draft' || po.status === 'sent') && (
              <button
                onClick={() => onStatusChange(po.id, 'cancelled')}
                className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-4 text-white/40">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </td>
      </tr>
      {expanded && po.purchase_order_items && po.purchase_order_items.length > 0 && (
        <tr className="bg-slate-900/50">
          <td colSpan={7} className="px-8 py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-white/40 uppercase">
                  <th className="pb-1 text-left">Product</th>
                  <th className="pb-1 text-right">Ordered</th>
                  <th className="pb-1 text-right">Received</th>
                  <th className="pb-1 text-right">Unit Cost</th>
                  <th className="pb-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {po.purchase_order_items.map((item, idx) => (
                  <tr key={item.id ?? idx}>
                    <td className="py-1.5 text-white/80">{item.product_name ?? item.product_id}</td>
                    <td className="py-1.5 text-right text-white/70">{item.quantity_ordered}</td>
                    <td className="py-1.5 text-right text-white/70">{item.quantity_received}</td>
                    <td className="py-1.5 text-right text-white/70">${item.unit_cost.toFixed(2)}</td>
                    <td className="py-1.5 text-right text-white">
                      ${(item.quantity_ordered * item.unit_cost).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Receive Modal ──────────────────────────────────────────────
interface ReceiveModalProps {
  po: PurchaseOrder;
  onClose: () => void;
  onDone: () => void;
}

function ReceiveModal({ po, onClose, onDone }: ReceiveModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    (po.purchase_order_items ?? []).forEach(it => {
      if (it.id) map[it.id] = it.quantity_ordered;
    });
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReceive() {
    setSaving(true);
    setError(null);
    try {
      const items = po.purchase_order_items ?? [];

      // Update each item's quantity_received
      await Promise.all(
        items.map(it => {
          if (!it.id) return Promise.resolve();
          return supabase
            .from('purchase_order_items')
            .update({ quantity_received: quantities[it.id] ?? it.quantity_ordered })
            .eq('id', it.id);
        }),
      );

      // Increment stock_quantity for each product
      await Promise.all(
        items.map(async it => {
          if (!it.product_id) return;
          const qty = it.id ? (quantities[it.id] ?? 0) : 0;
          if (qty <= 0) return;
          // Fetch current stock first (RPC not available, so read-then-update)
          const { data: prod } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', it.product_id)
            .single();
          const currentStock = (prod as { stock_quantity: number } | null)?.stock_quantity ?? 0;
          return supabase
            .from('products')
            .update({ stock_quantity: currentStock + qty })
            .eq('id', it.product_id);
        }),
      );

      // Mark PO as received
      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({ status: 'received', received_at: new Date().toISOString() })
        .eq('id', po.id);
      if (poErr) throw poErr;

      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Receive failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Receive Order</h2>
            <p className="text-sm text-white/50">{po.order_number}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <p className="text-sm text-white/60">
            Confirm quantities received. Stock will be updated automatically.
          </p>
          <div className="space-y-2">
            {(po.purchase_order_items ?? []).map((item, idx) => (
              <div key={item.id ?? idx} className="flex items-center gap-4 rounded-xl bg-white/5 px-4 py-3">
                <div className="flex-1 text-sm text-white">{item.product_name ?? 'Product'}</div>
                <div className="text-xs text-white/50">Ordered: {item.quantity_ordered}</div>
                <input
                  type="number"
                  min="0"
                  max={item.quantity_ordered}
                  value={item.id ? (quantities[item.id] ?? item.quantity_ordered) : item.quantity_ordered}
                  onChange={e => {
                    if (item.id) {
                      setQuantities(prev => ({ ...prev, [item.id!]: parseInt(e.target.value) || 0 }));
                    }
                  }}
                  className="w-20 rounded-lg border border-white/20 bg-slate-800 px-2 py-1 text-center text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleReceive()}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl btn-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <CheckCircle className="h-4 w-4" />
            {saving ? 'Processing…' : 'Confirm Received'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function PurchaseOrderManagement() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<POStatus | 'all'>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, suppliersRes, productsRes] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('*, supplier:suppliers(name), purchase_order_items(id, product_id, quantity_ordered, quantity_received, unit_cost, product:products(name))')
          .order('created_at', { ascending: false }),
        supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
        supabase.from('products').select('id, name, sku, stock_quantity').eq('is_active', true).order('name'),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (suppliersRes.error) throw suppliersRes.error;
      if (productsRes.error) throw productsRes.error;

      // Flatten product names onto items
      const rawOrders = (ordersRes.data ?? []) as (Omit<PurchaseOrder, 'purchase_order_items'> & {
        purchase_order_items: (POItem & { product: { name: string } | null })[];
      })[];

      const normalised: PurchaseOrder[] = rawOrders.map(o => ({
        ...o,
        purchase_order_items: o.purchase_order_items.map(it => ({
          ...it,
          product_name: it.product?.name ?? undefined,
        })),
      }));

      setOrders(normalised);
      setSuppliers((suppliersRes.data as Supplier[]) ?? []);
      setProducts((productsRes.data as Product[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleStatusChange(id: string, status: POStatus) {
    try {
      const { error: dbErr } = await supabase
        .from('purchase_orders')
        .update({ status })
        .eq('id', id);
      if (dbErr) throw dbErr;
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status update failed');
    }
  }

  const filtered = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      o.order_number.toLowerCase().includes(q) ||
      (o.supplier?.name ?? '').toLowerCase().includes(q) ||
      (o.notes ?? '').toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchesQuery && matchesStatus;
  });

  // Stats
  const totalOrders = orders.length;
  const pendingCount = orders.filter(o => o.status === 'draft' || o.status === 'sent').length;
  const receivedCount = orders.filter(o => o.status === 'received').length;
  const totalValue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const stats = [
    { label: 'Total Orders', value: totalOrders, subcopy: 'Purchase orders' },
    { label: 'Pending', value: pendingCount, subcopy: 'Awaiting delivery' },
    { label: 'Received', value: receivedCount, subcopy: 'Completed orders' },
    { label: 'Total Value', value: `$${totalValue.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, subcopy: 'Order value' },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        {/* ── Hero ── */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Procurement Hub</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Purchase Order Management</h1>
              <p className="mt-2 text-sm text-white/80">
                Track purchase orders from creation to delivery and maintain complete procurement visibility.
              </p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex shrink-0 items-center gap-2 rounded-xl btn-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              New PO
            </button>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg backdrop-blur-xl text-white">
              <p className="text-xs uppercase tracking-[0.25em] text-white/70">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{stat.value}</p>
              <p className="text-sm text-white/80">{stat.subcopy}</p>
            </div>
          ))}
        </section>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Search & Filter ── */}
        <section className="hero-gradient glass-panel p-6 text-white space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-white">Order Directory</h2>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
              className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="all" className="bg-slate-800 text-white">All Status</option>
              <option value="draft" className="bg-slate-800 text-white">Draft</option>
              <option value="sent" className="bg-slate-800 text-white">Sent</option>
              <option value="received" className="bg-slate-800 text-white">Received</option>
              <option value="cancelled" className="bg-slate-800 text-white">Cancelled</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search by order number, supplier, or notes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/20 bg-white/10 pl-12 pr-4 py-3 text-white placeholder-white/60 backdrop-blur-sm focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </section>

        {/* ── Table ── */}
        <section className="glass-panel overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingCart className="mx-auto h-14 w-14 text-white/20" />
              <h3 className="mt-4 text-lg font-semibold text-white">
                {orders.length === 0 ? 'No purchase orders yet' : 'No results found'}
              </h3>
              <p className="mt-2 text-sm text-white/60">
                {orders.length === 0 ? 'Create your first PO to get started.' : 'Try adjusting your filter.'}
              </p>
              {orders.length === 0 && (
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl btn-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  New PO
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">Order #</th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">Supplier</th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">Status</th>
                    <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50 md:table-cell">Delivery</th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">Total</th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">Actions</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map(po => (
                    <PORow
                      key={po.id}
                      po={po}
                      onReceive={setReceiveTarget}
                      onStatusChange={(id, status) => void handleStatusChange(id, status)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showNewModal && (
        <NewPOModal
          suppliers={suppliers}
          products={products}
          onClose={() => setShowNewModal(false)}
          onSaved={() => { setShowNewModal(false); void loadData(); }}
        />
      )}
      {receiveTarget && (
        <ReceiveModal
          po={receiveTarget}
          onClose={() => setReceiveTarget(null)}
          onDone={() => { setReceiveTarget(null); void loadData(); }}
        />
      )}
    </Layout>
  );
}
