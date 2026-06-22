import {
  MapPin,
  Sparkles,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  ArrowRightLeft,
  Package,
  ChevronDown,
  X,
  Check,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import FeatureGate from '../FeatureGate';
import Layout from '../Layout';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/utils/supabaseClient';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_main: boolean;
  is_active: boolean;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string;
}

interface LocationStockRow {
  id: string;
  location_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
  products: ProductRow | null;
}

interface TransferRecord {
  id: string;
  fromLocation: string;
  toLocation: string;
  productName: string;
  quantity: number;
  transferredAt: string;
}

// ─── Add / Edit Location Form ────────────────────────────────────────────────

interface LocationFormProps {
  initial?: Partial<Location>;
  onSave: (data: { name: string; address: string; phone: string; is_main: boolean }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function LocationForm({ initial, onSave, onCancel, saving }: LocationFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [isMain, setIsMain] = useState(initial?.is_main ?? false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Location name is required');
      return;
    }
    await onSave({ name: name.trim(), address: address.trim(), phone: phone.trim(), is_main: isMain });
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          {initial?.id ? 'Edit Location' : 'Add New Location'}
        </h3>
        <button type="button" onClick={onCancel} className="text-white/40 hover:text-white/80 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-white/60">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Main Branch, Warehouse A…"
            className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/60">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Tripoli, North Lebanon"
            className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/60">Phone (+961 format)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+961 6 123 456"
            className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={isMain}
          onChange={(e) => setIsMain(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 accent-indigo-500"
        />
        <span className="text-sm text-white/80">Set as main location</span>
      </label>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl btn-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {initial?.id ? 'Update' : 'Add Location'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Locations Tab ───────────────────────────────────────────────────────────

interface LocationsTabProps {
  locations: Location[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

function LocationsTab({ locations, loading, onRefresh }: LocationsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (data: {
    name: string;
    address: string;
    phone: string;
    is_main: boolean;
  }) => {
    setSaving(true);
    try {
      if (editTarget) {
        // If setting as main, clear other main flags first
        if (data.is_main) {
          await supabase.from('locations').update({ is_main: false }).neq('id', editTarget.id);
        }
        const { error } = await supabase
          .from('locations')
          .update({
            name: data.name,
            address: data.address || null,
            phone: data.phone || null,
            is_main: data.is_main,
          })
          .eq('id', editTarget.id);
        if (error) throw error;
        toast.success('Location updated');
      } else {
        if (data.is_main) {
          await supabase.from('locations').update({ is_main: false }).gte('id', '');
        }
        const { error } = await supabase.from('locations').insert({
          name: data.name,
          address: data.address || null,
          phone: data.phone || null,
          is_main: data.is_main,
          is_active: true,
        });
        if (error) throw error;
        toast.success('Location added');
      }
      setShowForm(false);
      setEditTarget(null);
      await onRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save location';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (loc: Location) => {
    if (loc.is_main) {
      toast.error('Cannot deactivate the main location');
      return;
    }
    try {
      const { error } = await supabase
        .from('locations')
        .update({ is_active: !loc.is_active })
        .eq('id', loc.id);
      if (error) throw error;
      toast.success(loc.is_active ? 'Location deactivated' : 'Location activated');
      await onRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update location';
      toast.error(message);
    }
  };

  const handleEdit = (loc: Location) => {
    setEditTarget(loc);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditTarget(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-white/40">
          {locations.length} location{locations.length !== 1 ? 's' : ''}
        </p>
        {!showForm && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-xl btn-brand px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Add Location
          </button>
        )}
      </div>

      {showForm && (
        <LocationForm
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
        />
      )}

      {locations.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/50">No locations yet. Add your first location above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className={`rounded-2xl border p-4 transition-colors ${
                loc.is_active ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20">
                    <MapPin className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white truncate">{loc.name}</p>
                      {loc.is_main && (
                        <span className="shrink-0 rounded-full bg-indigo-500/20 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                          Main
                        </span>
                      )}
                      {!loc.is_active && (
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">
                          Inactive
                        </span>
                      )}
                    </div>
                    {loc.address && <p className="mt-0.5 text-xs text-white/50">{loc.address}</p>}
                    {loc.phone && <p className="text-xs text-white/40">{loc.phone}</p>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleEdit(loc)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                    title="Edit location"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(loc)}
                    disabled={loc.is_main}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                    title={loc.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {loc.is_active ? (
                      <ToggleRight className="h-4 w-4 text-green-400" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stock by Location Tab ───────────────────────────────────────────────────

interface StockTabProps {
  locations: Location[];
}

function StockTab({ locations }: StockTabProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [stockRows, setStockRows] = useState<LocationStockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState<Record<string, string>>({});

  const activeLocations = locations.filter((l) => l.is_active);

  const loadStock = useCallback(async (locationId: string) => {
    if (!locationId) return;
    setLoadingStock(true);
    try {
      const { data, error } = await supabase
        .from('location_stock')
        .select('*, products(id, name, sku)')
        .eq('location_id', locationId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setStockRows((data as LocationStockRow[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load stock';
      toast.error(message);
    } finally {
      setLoadingStock(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      void loadStock(selectedLocationId);
    } else {
      setStockRows([]);
    }
  }, [selectedLocationId, loadStock]);

  const handleAdjust = async (row: LocationStockRow) => {
    const rawQty = adjustQty[row.id];
    const qty = parseInt(rawQty ?? '', 10);
    if (isNaN(qty) || qty < 0) {
      toast.error('Enter a valid non-negative quantity');
      return;
    }
    try {
      const { error } = await supabase.from('location_stock').upsert(
        {
          id: row.id,
          location_id: row.location_id,
          product_id: row.product_id,
          quantity: qty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'location_id,product_id' },
      );
      if (error) throw error;
      toast.success('Stock adjusted');
      setAdjustingId(null);
      setAdjustQty((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await loadStock(selectedLocationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to adjust stock';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full appearance-none bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 pr-8 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Select a location…</option>
            {activeLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        </div>
      </div>

      {!selectedLocationId && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/50">Select a location to view its stock levels.</p>
        </div>
      )}

      {selectedLocationId && loadingStock && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500" />
        </div>
      )}

      {selectedLocationId && !loadingStock && stockRows.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-white/30" />
          <p className="text-sm text-white/50">No stock records for this location yet.</p>
          <p className="mt-1 text-xs text-white/30">Stock entries are created via Transfer or manual adjustment.</p>
        </div>
      )}

      {selectedLocationId && !loadingStock && stockRows.length > 0 && (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white/50">SKU</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-white/50">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-white/50">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stockRows.map((row) => (
                <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 text-white">{row.products?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-white/50 font-mono text-xs">{row.products?.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">{row.quantity}</td>
                  <td className="px-4 py-3 text-right">
                    {adjustingId === row.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          min="0"
                          value={adjustQty[row.id] ?? String(row.quantity)}
                          onChange={(e) =>
                            setAdjustQty((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          className="w-20 rounded-lg border border-white/20 bg-slate-800 px-2 py-1 text-right text-sm text-white focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                          onClick={() => void handleAdjust(row)}
                          className="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setAdjustingId(null)}
                          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/50 hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAdjustingId(row.id);
                          setAdjustQty((prev) => ({ ...prev, [row.id]: String(row.quantity) }));
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10 transition-colors"
                      >
                        Adjust
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Transfer Stock Tab ──────────────────────────────────────────────────────

interface TransferTabProps {
  locations: Location[];
}

function TransferTab({ locations }: TransferTabProps) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [transferring, setTransferring] = useState(false);
  const [history, setHistory] = useState<TransferRecord[]>([]);

  const activeLocations = locations.filter((l) => l.is_active);

  // Load products for dropdown
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');
      setProducts((data as ProductRow[]) ?? []);
    };
    void load();
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!fromId || !toId || !productId || isNaN(qty) || qty <= 0) {
      toast.error('Fill all fields with a positive quantity');
      return;
    }
    if (fromId === toId) {
      toast.error('From and To locations must be different');
      return;
    }

    setTransferring(true);
    try {
      // Fetch current quantities at both locations
      const [fromRes, toRes] = await Promise.all([
        supabase
          .from('location_stock')
          .select('id, quantity')
          .eq('location_id', fromId)
          .eq('product_id', productId)
          .maybeSingle(),
        supabase
          .from('location_stock')
          .select('id, quantity')
          .eq('location_id', toId)
          .eq('product_id', productId)
          .maybeSingle(),
      ]);

      if (fromRes.error) throw fromRes.error;
      if (toRes.error) throw toRes.error;

      const fromQty = fromRes.data?.quantity ?? 0;
      if (fromQty < qty) {
        toast.error(`Insufficient stock at source (available: ${fromQty})`);
        return;
      }

      const toQty = toRes.data?.quantity ?? 0;

      // Decrement source
      const { error: fromErr } = await supabase.from('location_stock').upsert(
        {
          location_id: fromId,
          product_id: productId,
          quantity: fromQty - qty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'location_id,product_id' },
      );
      if (fromErr) throw fromErr;

      // Increment destination
      const { error: toErr } = await supabase.from('location_stock').upsert(
        {
          location_id: toId,
          product_id: productId,
          quantity: toQty + qty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'location_id,product_id' },
      );
      if (toErr) throw toErr;

      const fromName = activeLocations.find((l) => l.id === fromId)?.name ?? fromId;
      const toName = activeLocations.find((l) => l.id === toId)?.name ?? toId;
      const prodName = products.find((p) => p.id === productId)?.name ?? productId;

      toast.success(`Transferred ${qty}x ${prodName} from ${fromName} → ${toName}`);

      // Add to local history
      setHistory((prev) => [
        {
          id: crypto.randomUUID(),
          fromLocation: fromName,
          toLocation: toName,
          productName: prodName,
          quantity: qty,
          transferredAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      // Reset form
      setQuantity('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transfer failed';
      toast.error(message);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-sm">
            <ArrowRightLeft className="h-4 w-4 text-indigo-400" />
            Transfer Stock Between Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleTransfer(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-white/60">From Location</label>
                <div className="relative">
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className="w-full appearance-none bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 pr-8 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {activeLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/60">To Location</label>
                <div className="relative">
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="w-full appearance-none bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 pr-8 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select…</option>
                    {activeLocations
                      .filter((loc) => loc.id !== fromId)
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/60">Product</label>
                <div className="relative">
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full appearance-none bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 pr-8 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/60">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-white/20 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={transferring || !fromId || !toId || !productId || !quantity}
              className="flex items-center gap-2 rounded-xl btn-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {transferring ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              Transfer Stock
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Transfer History */}
      {history.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40 mb-3">Recent Transfers (this session)</p>
          <div className="space-y-2">
            {history.map((record) => (
              <div
                key={record.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <ArrowRightLeft className="h-4 w-4 shrink-0 text-indigo-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">
                    <span className="font-medium">{record.quantity}x</span> {record.productName}
                  </p>
                  <p className="text-xs text-white/50">
                    {record.fromLocation} → {record.toLocation}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-white/30">
                  {new Date(record.transferredAt).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-sm text-white/40">No transfers yet in this session.</p>
        </div>
      )}
    </div>
  );
}

// ─── Root Component ──────────────────────────────────────────────────────────

export default function MultiLocationSupport() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const loadLocations = useCallback(async () => {
    setLoadingLocations(true);
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      if (error) throw error;
      setLocations((data as Location[]) ?? []);
    } catch {
      toast.error('Failed to load locations');
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  return (
    <Layout>
      <div className="space-y-8 pb-4 lg:pb-6">
        {/* Hero */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative">
            <p className="stat-chip bg-white/10 text-white/80">Enterprise</p>
            <h1 className="mt-3 text-3xl font-semibold">Multi-Location Support</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Manage multiple branches, warehouses, and stores with per-location inventory tracking
              and real-time stock transfers.
            </p>
          </div>
        </section>

        {/* Feature-gated content */}
        <FeatureGate feature="multi_location">
          <Tabs defaultValue="locations" className="space-y-6">
            <TabsList className="bg-white/5 border border-white/10 rounded-xl p-1 w-full sm:w-auto inline-flex">
              <TabsTrigger
                value="locations"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Locations
              </TabsTrigger>
              <TabsTrigger
                value="stock"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Stock by Location
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Transfer Stock
              </TabsTrigger>
            </TabsList>

            <TabsContent value="locations" className="mt-0">
              <LocationsTab
                locations={locations}
                loading={loadingLocations}
                onRefresh={loadLocations}
              />
            </TabsContent>

            <TabsContent value="stock" className="mt-0">
              <StockTab locations={locations} />
            </TabsContent>

            <TabsContent value="transfer" className="mt-0">
              <TransferTab locations={locations} />
            </TabsContent>
          </Tabs>
        </FeatureGate>
      </div>
    </Layout>
  );
}
