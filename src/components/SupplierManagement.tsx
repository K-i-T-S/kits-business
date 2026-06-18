import { Search, Users, Plus, Pencil, X, Check, Phone, Mail, MapPin } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import Layout from '../components/Layout';
import { supabase } from '../utils/supabaseClient';

// ── Types ──────────────────────────────────────────────────────
interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

type SupplierFormData = Omit<Supplier, 'id' | 'created_at'>;

const EMPTY_FORM: SupplierFormData = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  payment_terms: '',
  notes: '',
  is_active: true,
};

// ── Status badge ───────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Modal ──────────────────────────────────────────────────────
interface ModalProps {
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (data: SupplierFormData) => Promise<void>;
  saving: boolean;
}

function SupplierModal({ supplier, onClose, onSave, saving }: ModalProps) {
  const [form, setForm] = useState<SupplierFormData>(
    supplier
      ? {
          name: supplier.name,
          contact_name: supplier.contact_name ?? '',
          phone: supplier.phone ?? '',
          email: supplier.email ?? '',
          address: supplier.address ?? '',
          payment_terms: supplier.payment_terms ?? '',
          notes: supplier.notes ?? '',
          is_active: supplier.is_active,
        }
      : EMPTY_FORM,
  );

  function set<K extends keyof SupplierFormData>(key: K, value: SupplierFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const inputCls =
    'w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-white placeholder-white/40 focus:border-indigo-500 focus:outline-none';
  const labelCls = 'block text-xs text-white/60 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {supplier ? 'Edit Supplier' : 'New Supplier'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Supplier Name *</label>
              <input
                className={inputCls}
                placeholder="e.g. ABC Trading Co."
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Contact Person</label>
              <input
                className={inputCls}
                placeholder="Full name"
                value={form.contact_name ?? ''}
                onChange={e => set('contact_name', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                placeholder="+961 X XXX XXX"
                value={form.phone ?? ''}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                className={inputCls}
                type="email"
                placeholder="supplier@example.com"
                value={form.email ?? ''}
                onChange={e => set('email', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Payment Terms</label>
              <input
                className={inputCls}
                placeholder="e.g. Net 30, COD"
                value={form.payment_terms ?? ''}
                onChange={e => set('payment_terms', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Address</label>
              <input
                className={inputCls}
                placeholder="Full address"
                value={form.address ?? ''}
                onChange={e => set('address', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                placeholder="Any additional notes..."
                value={form.notes ?? ''}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
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
            onClick={() => void onSave(form)}
            disabled={!form.name.trim() || saving}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? 'Saving…' : supplier ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalSupplier, setModalSupplier] = useState<Supplier | null | 'new'>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────
  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (dbErr) throw dbErr;
      setSuppliers((data as Supplier[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  // ── Save (create / update) ────────────────────────────────────
  async function handleSave(form: SupplierFormData) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        address: form.address?.trim() || null,
        payment_terms: form.payment_terms?.trim() || null,
        notes: form.notes?.trim() || null,
        is_active: form.is_active,
      };

      if (modalSupplier === 'new') {
        const { error: dbErr } = await supabase.from('suppliers').insert(payload);
        if (dbErr) throw dbErr;
      } else if (modalSupplier) {
        const { error: dbErr } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', modalSupplier.id);
        if (dbErr) throw dbErr;
      }

      setModalSupplier(null);
      await loadSuppliers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Deactivate ───────────────────────────────────────────────
  async function handleDeactivate(id: string) {
    try {
      const { error: dbErr } = await supabase
        .from('suppliers')
        .update({ is_active: false })
        .eq('id', id);
      if (dbErr) throw dbErr;
      await loadSuppliers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate supplier');
    }
  }

  // ── Filtering ─────────────────────────────────────────────────
  const filtered = suppliers.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.contact_name ?? '').toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q);
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && s.is_active) ||
      (filterStatus === 'inactive' && !s.is_active);
    return matchesQuery && matchesStatus;
  });

  // ── Stats ─────────────────────────────────────────────────────
  const totalCount = suppliers.length;
  const activeCount = suppliers.filter(s => s.is_active).length;
  const inactiveCount = suppliers.filter(s => !s.is_active).length;

  const stats = [
    { label: 'Total Suppliers',  value: totalCount,    subcopy: 'Registered partners' },
    { label: 'Active Suppliers', value: activeCount,   subcopy: 'Currently trading' },
    { label: 'Inactive',         value: inactiveCount, subcopy: 'Need attention' },
    { label: 'Avg Lead Time',    value: '— days',      subcopy: 'Delivery window' },
  ];

  return (
    <Layout>
      <div className="space-y-10">
        {/* ── Hero ── */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 md:p-8 text-white">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="stat-chip bg-white/10 text-white/80">Supplier Network</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Strategic Partner Management</h1>
              <p className="mt-2 text-sm text-white/80">
                Track supplier performance, manage contact information, and optimize procurement relationships.
              </p>
            </div>
            <button
              onClick={() => setModalSupplier('new')}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Add Supplier
            </button>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(stat => (
            <div
              key={stat.label}
              className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg backdrop-blur-xl text-white"
            >
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
            <h2 className="text-lg font-semibold text-white">Supplier Directory</h2>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
              className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="all"      className="bg-slate-800 text-white">All Status</option>
              <option value="active"   className="bg-slate-800 text-white">Active</option>
              <option value="inactive" className="bg-slate-800 text-white">Inactive</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search by name, contact person, or email…"
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
              <Users className="mx-auto h-14 w-14 text-white/20" />
              <h3 className="mt-4 text-lg font-semibold text-white">
                {suppliers.length === 0 ? 'No suppliers yet' : 'No results found'}
              </h3>
              <p className="mt-2 text-sm text-white/60">
                {suppliers.length === 0
                  ? 'Add your first supplier to get started.'
                  : 'Try adjusting your search or filter.'}
              </p>
              {suppliers.length === 0 && (
                <button
                  onClick={() => setModalSupplier('new')}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Supplier
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">Supplier</th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">Contact</th>
                    <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50 md:table-cell">Payment Terms</th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">Status</th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-white/50">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map(supplier => (
                    <tr key={supplier.id} className="bg-white/5 hover:bg-white/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{supplier.name}</div>
                        {supplier.address && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-white/50">
                            <MapPin className="h-3 w-3" />
                            {supplier.address}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {supplier.contact_name && (
                          <div className="text-sm text-white">{supplier.contact_name}</div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-xs text-white/60">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-1 text-xs text-white/60">
                            <Mail className="h-3 w-3" />
                            {supplier.email}
                          </div>
                        )}
                      </td>
                      <td className="hidden px-6 py-4 text-sm text-white/70 md:table-cell">
                        {supplier.payment_terms ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge active={supplier.is_active} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setModalSupplier(supplier)}
                            className="rounded-lg border border-white/20 p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {supplier.is_active && (
                            <button
                              onClick={() => void handleDeactivate(supplier.id)}
                              className="rounded-lg border border-white/20 p-1.5 text-white/60 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                              title="Deactivate"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          {!supplier.is_active && (
                            <button
                              onClick={async () => {
                                try {
                                  await supabase.from('suppliers').update({ is_active: true }).eq('id', supplier.id);
                                  await loadSuppliers();
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : 'Failed to reactivate');
                                }
                              }}
                              className="rounded-lg border border-white/20 p-1.5 text-white/60 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors"
                              title="Reactivate"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
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

      {/* ── Modal ── */}
      {modalSupplier !== null && (
        <SupplierModal
          supplier={modalSupplier === 'new' ? null : modalSupplier}
          onClose={() => setModalSupplier(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </Layout>
  );
}
