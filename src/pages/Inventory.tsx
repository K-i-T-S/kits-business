import { Fragment, useMemo, useState } from 'react';
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
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import AddProductModal from '../components/AddProductModal';
import ImportInventoryModal from '../components/ImportInventoryModal';

export default function Inventory() {
  const { products, deleteProduct } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const categories = useMemo(
    () => ['all', ...new Set(products?.map((p) => p.category) || [])],
    [products],
  );

  const filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const calculateStats = (product: any) => {
    if (!product.variants || product.variants.length === 0) {
      return { totalStock: 0, avgCost: 0, avgPrice: 0, isLowStock: false };
    }
    
    const totalStock = product.variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
    const avgCost =
      product.variants.reduce((sum: number, v: any) => sum + (v.cost || 0), 0) / product.variants.length;
    const avgPrice =
      product.variants.reduce((sum: number, v: any) => sum + (v.price || 0), 0) / product.variants.length;
    const isLowStock = product.variants.some((v: any) => (v.stock || 0) <= (v.reorderLevel || 0));

    return { totalStock, avgCost, avgPrice, isLowStock };
  };

  const getCostTrend = (costHistory: any[]) => {
    if (costHistory.length < 2) return 'stable';
    const recent = costHistory[costHistory.length - 1].cost;
    const previous = costHistory[costHistory.length - 2].cost;
    if (recent > previous) return 'up';
    if (recent < previous) return 'down';
    return 'stable';
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
      <div className="space-y-10 pb-20 lg:pb-0">
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
              className="tilt-hover flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/60 bg-gradient-to-r from-indigo-600 to-sky-500 px-5 py-3 text-white shadow-lg shadow-indigo-500/30"
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

        <section className="hero-gradient glass-panel overflow-hidden p-0 text-white">
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
                              <button className="rounded-full border border-white/30 bg-white/20 p-2 text-indigo-300 hover:bg-white/30">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteProduct(product.id!)}
                                className="rounded-full border border-white/30 bg-white/20 p-2 text-rose-300 hover:bg-white/30"
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
          {!filteredProducts?.length && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <Package className="h-12 w-12" />
              <p className="mt-3 text-sm">No products found. Reset filters and try again.</p>
            </div>
          )}
        </section>
      </div>

      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} />}
      {showImportModal && <ImportInventoryModal onClose={() => setShowImportModal(false)} />}
    </Layout>
  );
}
