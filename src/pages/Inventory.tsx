import { Fragment, useState } from 'react';
import { Plus, Search, Edit, Trash2, Package, TrendingUp, AlertTriangle, Upload, Download } from 'lucide-react';
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

  // Get unique categories
  const categories = ['all', ...new Set(products.map(p => p.category))];

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.barcode.includes(searchQuery) ||
                         product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const calculateStats = (product: any) => {
    const totalStock = product.variants.reduce((sum: number, v: any) => sum + v.stock, 0);
    const avgCost = product.variants.reduce((sum: number, v: any) => sum + v.cost, 0) / product.variants.length;
    const avgPrice = product.variants.reduce((sum: number, v: any) => sum + v.price, 0) / product.variants.length;
    const isLowStock = product.variants.some((v: any) => v.stock <= v.reorderLevel);
    
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-gray-900">Inventory Management</h1>
            <p className="text-gray-600">Manage products, stock levels, and suppliers</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span>Import Inventory</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, barcode, or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Total Products</p>
            <p className="text-gray-900">{products.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Total Variants</p>
            <p className="text-gray-900">{products.reduce((acc, p) => acc + p.variants.length, 0)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Total Stock</p>
            <p className="text-gray-900">
              {products.reduce((acc, p) => acc + p.variants.reduce((sum, v) => sum + v.stock, 0), 0)} units
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-600 mb-1">Low Stock Items</p>
            <p className="text-orange-600">
              {products.reduce((acc, p) => acc + p.variants.filter(v => v.stock <= v.reorderLevel).length, 0)}
            </p>
          </div>
        </div>

        {/* Products List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-600">Product</th>
                  <th className="px-6 py-3 text-left text-gray-600">Barcode / SKU</th>
                  <th className="px-6 py-3 text-left text-gray-600">Variants</th>
                  <th className="px-6 py-3 text-left text-gray-600">Stock</th>
                  <th className="px-6 py-3 text-left text-gray-600">Avg Cost</th>
                  <th className="px-6 py-3 text-left text-gray-600">Avg Price</th>
                  <th className="px-6 py-3 text-left text-gray-600">Supplier</th>
                  <th className="px-6 py-3 text-left text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => {
                  const stats = calculateStats(product);
                  const isExpanded = selectedProduct === product.id;

                  return (
                    <Fragment key={product.id}>
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-gray-900">{product.name}</p>
                            <p className="text-gray-500 text-sm">{product.category}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-gray-700">{product.barcode}</p>
                            <p className="text-gray-500 text-sm">{product.sku}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedProduct(isExpanded ? null : product.id)}
                            className="text-indigo-600 hover:underline"
                          >
                            {product.variants.length} variant{product.variants.length > 1 ? 's' : ''}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {stats.isLowStock && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                            <span className={stats.isLowStock ? 'text-orange-600' : 'text-gray-700'}>
                              {stats.totalStock}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          ${stats.avgCost.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          ${stats.avgPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-gray-700 text-sm">
                          {product.supplier}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteProduct(product.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Variants */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-3">
                              <p className="text-gray-700">Product Variants:</p>
                              {product.variants.map((variant) => {
                                const trend = getCostTrend(variant.costHistory);
                                return (
                                  <div key={variant.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                                    <div className="flex-1 grid grid-cols-5 gap-4">
                                      <div>
                                        <p className="text-gray-500 text-sm">Attributes</p>
                                        <p className="text-gray-900">
                                          {Object.entries(variant.attributes).map(([key, value]) => 
                                            `${key}: ${value}`
                                          ).join(', ')}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-gray-500 text-sm">Cost</p>
                                        <div className="flex items-center space-x-1">
                                          <p className="text-gray-900">${variant.cost.toFixed(2)}</p>
                                          {trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
                                          {trend === 'down' && <TrendingUp className="w-4 h-4 text-green-500 transform rotate-180" />}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-gray-500 text-sm">Price</p>
                                        <p className="text-gray-900">${variant.price.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-500 text-sm">Stock</p>
                                        <p className={variant.stock <= variant.reorderLevel ? 'text-orange-600' : 'text-gray-900'}>
                                          {variant.stock} units
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-gray-500 text-sm">Reorder Level</p>
                                        <p className="text-gray-900">{variant.reorderLevel}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {/* Cost History */}
                              {product.variants[0]?.costHistory?.length ? (
                                <div className="bg-white rounded-lg p-4">
                                  <p className="text-gray-700 mb-2">Cost History:</p>
                                  <div className="space-y-1">
                                    {product.variants[0].costHistory.map((entry, idx) => (
                                      <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-600">{new Date(entry.date).toLocaleDateString()}</span>
                                        <span className="text-gray-900">${entry.cost.toFixed(2)} ({entry.quantity} units)</span>
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

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No products found</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} />}
      {showImportModal && <ImportInventoryModal onClose={() => setShowImportModal(false)} />}
    </Layout>
  );
}
