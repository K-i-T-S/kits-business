import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  TrendingUp,
  AlertTriangle,
  Upload,
  Layers3,
  Filter,
  X,
  Loader2,
} from 'lucide-react';
import React, { Fragment, useMemo, useState } from 'react';

import AddProductModal from '../components/AddProductModal';
import ImportInventoryModal from '../components/ImportInventoryModal';
import Layout from '../components/Layout';
import { useApp, type Product, type ProductVariant, type CostEntry } from '../context/AppContext';

interface EditForm {
  name: string;
  price: string;
  cost: string;
  stock: string;
  category: string;
  supplier: string;
}

export default function Inventory() {
  const { products, deleteProduct, updateProduct } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', price: '', cost: '', stock: '', category: '', supplier: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const categories = useMemo(
    () => ['all', ...new Set(products?.map((p) => p.category) || [])],
    [products],
  );

  const filteredProducts = (products ?? []).filter((product) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(q) ||
      product.barcode.toLowerCase().includes(q) ||
      product.sku.toLowerCase().includes(q) ||
      (product.category ?? '').toLowerCase().includes(q);
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const calculateStats = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return { totalStock: 0, avgCost: 0, avgPrice: 0, isLowStock: false };
    }
    const totalStock = product.variants.reduce((sum: number, v: ProductVariant) => sum + (v.stock || 0), 0);
    const avgCost = product.variants.reduce((sum: number, v: ProductVariant) => sum + (v.cost || 0), 0) / product.variants.length;
    const avgPrice = product.variants.reduce((sum: number, v: ProductVariant) => sum + (v.price || 0), 0) / product.variants.length;
    const isLowStock = product.variants.some((v: ProductVariant) => (v.stock || 0) <= (v.reorderLevel || 0));
    return { totalStock, avgCost, avgPrice, isLowStock };
  };

  const getCostTrend = (costHistory: CostEntry[]) => {
    if (costHistory.length < 2) return 'stable';
    const recent = costHistory[costHistory.length - 1]?.cost ?? 0;
    const previous = costHistory[costHistory.length - 2]?.cost ?? 0;
    if (recent > previous) return 'up';
    if (recent < previous) return 'down';
    return 'stable';
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}"? This action cannot be undone.`)) {
      deleteProduct(id);
    }
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      price: String(product.variants?.[0]?.price ?? ''),
      cost: String(product.variants?.[0]?.cost ?? ''),
      stock: String(product.variants?.[0]?.stock ?? ''),
      category: product.category ?? '',
      supplier: product.supplier ?? '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.id) return;
    setEditSubmitting(true);
    try {
      await updateProduct(editingProduct.id, {
        name: editForm.name,
        category: editForm.category,
        supplier: editForm.supplier,
        variants: [{
          ...(editingProduct.variants?.[0] ?? { id: crypto.randomUUID(), attributes: {}, costHistory: [], reorderLevel: 0 }),
          price: parseFloat(editForm.price) || 0,
          cost: parseFloat(editForm.cost) || 0,
          stock: parseInt(editForm.stock) || 0,
        }],
      });
      setEditingProduct(null);
    } catch {
      // updateProduct shows toast on failure
    } finally {
      setEditSubmitting(false);
    }
  };

  const inventoryStats = [
    {
      label: 'Catalog size',
      value: products?.length || 0,
      subcopy: 'active SKUs',
    },
    {
      label: 'Variants',
      value: products?.reduce((acc, p) => acc + (p.variants?.length || 0), 0) || 0,
      subcopy: 'configurations',
    },
    {
      label: 'Units on hand',
      value: products?.reduce(
        (acc, p) => acc + (p.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0),
        0,
      ) || 0,
      subcopy: 'live quantity',
    },
    {
      label: 'Low stock alerts',
      value: products?.reduce(
        (acc, p) => acc + (p.variants?.filter((v) => v.stock <= v.reorderLevel).length || 0),
        0,
      ) || 0,
      subcopy: 'variants below buffer',
      critical: true,
    },
  ];

  return (
    <Layout>
      <div className="space-y-10 pb-4 lg:pb-6">
        <section className="hero-gradient glass-panel flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/80">Inventory HQ</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Product Intelligence</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Track product performance with layered filters, live reorder signals, and variant-level
              cost history. Keep your hardware, accessories, and gaming stock organized—and always
              know what to reorder next.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => setShowImportModal(true)}
              className="tilt-hover flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/50 bg-gradient-to-r from-emerald-500 to-lime-400 px-5 py-3 text-white shadow-lg shadow-emerald-500/40"
            >
              <Upload className="h-4 w-4" />
              Import catalog
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="tilt-hover flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/60 btn-brand px-5 py-3 text-white shadow-lg shadow-indigo-500/30"
            >
              <Plus className="h-4 w-4" />
              New product
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {inventoryStats.map((stat) => (
            <div
              key={stat.label}
              className="hero-gradient tilt-hover rounded-3xl border border-white/30 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-xl text-white"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-white/70">{stat.label}</p>
              <p
                className={`mt-3 text-3xl font-semibold ${
                  stat.critical ? 'text-amber-400' : 'text-white'
                }`}
              >
                {stat.value}
              </p>
              <p className="text-sm text-white/80">{stat.subcopy}</p>
            </div>
          ))}
        </section>

        <section className="hero-gradient glass-panel p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Filters</p>
              <h2 className="text-lg font-semibold text-white">Curate catalog view</h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2 text-xs text-white/80">
              <Layers3 className="h-4 w-4" />
              Tip: keep categories consistent (e.g. Hardware, Software, Gaming, Accessories, POS).
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[2fr,1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <input
                type="text"
                placeholder="Search by product, barcode, or SKU…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-white/30 bg-white/20 py-3 pl-12 pr-4 text-sm text-white placeholder-white/50 shadow-inner focus:border-white/50 focus:outline-none"
              />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/30 bg-white/20 py-3 pl-12 pr-10 text-sm text-white shadow-inner focus:border-white/50 focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All categories' : cat}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/60">▾</div>
            </div>
          </div>
        </section>

        <section className="hero-gradient glass-panel overflow-hidden p-0 text-white hidden md:block">
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <table className="w-full text-left text-sm text-white/80">
                <thead className="bg-white/10 text-xs uppercase tracking-[0.2em] text-white/60">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Barcode / SKU</th>
                    <th className="px-6 py-4">Variants</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">Avg cost</th>
                    <th className="px-6 py-4">Avg price</th>
                    <th className="px-6 py-4">Supplier</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20 bg-white/10">
                  {filteredProducts.map((product) => {
                    const stats = calculateStats(product);
                    const isExpanded = selectedProduct === product.id;

                    return (
                      <Fragment key={product.id}>
                        <tr className="transition hover:bg-white/20">
                          <td className="px-6 py-4">
                            <p className="font-medium text-white">{product.name}</p>
                            <p className="text-xs text-white/60">{product.category}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-mono text-white/60">{product.barcode}</p>
                            <p className="text-xs text-white/60">{product.sku}</p>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setSelectedProduct(isExpanded ? null : product.id!)}
                              className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                            >
                              {product.variants?.length || 0} variant
                              {(product.variants?.length || 0) > 1 ? 's' : ''}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {stats.isLowStock && (
                                <AlertTriangle className="h-4 w-4 text-amber-400" />
                              )}
                              <span
                                className={`text-sm font-semibold ${
                                  stats.isLowStock ? 'text-amber-400' : 'text-white/80'
                                }`}
                              >
                                {stats.totalStock}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-white/80">${(stats.avgCost || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 text-white/80">${(stats.avgPrice || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 text-white/60">{product.supplier}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEdit(product)}
                                className="rounded-full border border-white/30 bg-white/20 p-2 text-indigo-300 hover:bg-white/30"
                                title="Edit product"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(product.id!, product.name)}
                                className="rounded-full border border-white/30 bg-white/20 p-2 text-rose-300 hover:bg-white/30"
                                title="Delete product"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-white/10 px-6 py-6">
                              <div className="space-y-4 rounded-3xl border border-white/30 bg-white/20 p-4">
                                <p className="text-sm font-semibold text-white/80">
                                  Variant intelligence
                                </p>
                                <div className="grid gap-4 md:grid-cols-2">
                                  {product.variants?.map((variant) => {
                                    const trend = getCostTrend(variant.costHistory);
                                    return (
                                      <div
                                        key={variant.id}
                                        className="rounded-2xl border border-white/30 bg-white/10 p-4 shadow-inner"
                                      >
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                                          {Object.entries(variant.attributes)
                                            .map(([key, value]) => `${key}: ${value}`)
                                            .join(' • ')}
                                        </p>
                                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                          <div>
                                            <p className="text-xs text-white/60">Cost</p>
                                            <p className="font-semibold text-white">
                                              ${(variant.cost || 0).toFixed(2)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-white/60">Price</p>
                                            <p className="font-semibold text-white">
                                              ${(variant.price || 0).toFixed(2)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-white/60">Stock</p>
                                            <p
                                              className={`font-semibold ${
                                                variant.stock <= variant.reorderLevel
                                                  ? 'text-amber-400'
                                                  : 'text-white'
                                              }`}
                                            >
                                              {variant.stock} units
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-white/60">Trend</p>
                                            <div className="flex items-center gap-1 text-xs font-semibold">
                                              {trend === 'up' && (
                                                <>
                                                  <TrendingUp className="h-4 w-4 text-rose-300" />
                                                  Cost rising
                                                </>
                                              )}
                                              {trend === 'down' && (
                                                <>
                                                  <TrendingUp className="h-4 w-4 rotate-180 text-emerald-300" />
                                                  Cost easing
                                                </>
                                              )}
                                              {trend === 'stable' && <span>Stable</span>}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {product.variants[0]?.costHistory?.length ? (
                                  <div className="rounded-2xl border border-slate-100 bg-white/90 p-4 text-xs text-slate-500">
                                    <p className="text-sm font-semibold text-slate-700">
                                      Cost history
                                    </p>
                                    <div className="mt-2 space-y-1 font-mono">
                                      {product.variants?.[0]?.costHistory?.map((entry, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2"
                                        >
                                          <span>{new Date(entry.date).toLocaleDateString()}</span>
                                          <span className="text-slate-900">
                                            ${(entry.cost || 0).toFixed(2)} ({entry.quantity || 0} units)
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-white/40">
              <Package className="h-12 w-12" />
              {products.length === 0 ? (
                <>
                  <p className="mt-3 text-sm font-medium text-white/60">No products yet.</p>
                  <p className="text-sm">Click &quot;New product&quot; above to get started.</p>
                </>
              ) : (
                <p className="mt-3 text-sm">No products match your search. Try different filters.</p>
              )}
            </div>
          )}
        </section>

        {/* Mobile card list */}
        <section className="md:hidden space-y-3">
          {filteredProducts.map((product) => {
            const stats = calculateStats(product);
            return (
              <div key={product.id} className="hero-gradient glass-panel p-4 text-white rounded-2xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{product.name}</p>
                    <p className="text-xs text-white/50">{product.category}</p>
                    {product.barcode && <p className="text-xs font-mono text-white/40 mt-1">{product.barcode}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(product)}
                      className="rounded-full border border-white/20 bg-white/10 p-2 text-indigo-300 hover:bg-white/20"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id!, product.name)}
                      className="rounded-full border border-white/20 bg-white/10 p-2 text-rose-300 hover:bg-white/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-white/50">Stock</p>
                    <p className={`font-semibold mt-0.5 ${stats.isLowStock ? 'text-amber-400' : 'text-white'}`}>
                      {stats.isLowStock && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                      {stats.totalStock}
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-white/50">Cost</p>
                    <p className="font-semibold text-white mt-0.5">${stats.avgCost.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <p className="text-white/50">Price</p>
                    <p className="font-semibold text-white mt-0.5">${stats.avgPrice.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-white/40">
              <Package className="h-10 w-10" />
              <p className="mt-2 text-sm">No products yet. Tap &quot;New product&quot; to add one.</p>
            </div>
          )}
        </section>
      </div>

      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} />}
      {showImportModal && <ImportInventoryModal onClose={() => setShowImportModal(false)} />}

      {/* Edit product modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="glass-panel-dark w-full max-w-md rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Edit Product</h2>
              <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="h-5 w-5 text-white/60" />
              </button>
            </div>
            <form onSubmit={(e) => void handleEditSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Price</label>
                  <input type="number" step="0.01" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Cost</label>
                  <input type="number" step="0.01" min="0" value={editForm.cost} onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Stock</label>
                  <input type="number" min="0" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Category</label>
                  <input type="text" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Supplier</label>
                <input type="text" value={editForm.supplier} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingProduct(null)} disabled={editSubmitting} className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:bg-white/10 transition-all disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={editSubmitting} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {editSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editSubmitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
