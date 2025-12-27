import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AddProductModalProps {
  onClose: () => void;
}

export default function AddProductModal({ onClose }: AddProductModalProps) {
  const { addProduct, setModalOpen } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    sku: '',
    category: '',
    supplier: '',
    validityDate: '',
    variantAttribute: 'size',
    variantValue: '',
    cost: '',
    price: '',
    stock: '',
    reorderLevel: ''
  });

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const product = {
      name: formData.name,
      barcode: formData.barcode,
      sku: formData.sku,
      category: formData.category,
      supplier: formData.supplier,
      validityDate: formData.validityDate || undefined,
      variants: [
        {
          id: `${Date.now()}-1`,
          attributes: { [formData.variantAttribute]: formData.variantValue },
          cost: parseFloat(formData.cost),
          costHistory: [
            {
              date: new Date().toISOString(),
              cost: parseFloat(formData.cost),
              quantity: parseInt(formData.stock)
            }
          ],
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock),
          reorderLevel: parseInt(formData.reorderLevel)
        }
      ]
    };

    addProduct(product);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="hero-gradient rounded-xl shadow-xl max-w-2xl w-full p-6 my-8 text-white">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white">Add New Product</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white/80 mb-2">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                required
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">Category *</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                placeholder="e.g., Beverages"
                required
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">Barcode *</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                required
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">SKU *</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                required
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">Supplier *</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                required
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">Validity Date</label>
              <input
                type="date"
                value={formData.validityDate}
                onChange={(e) => setFormData({ ...formData, validityDate: e.target.value })}
                className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white"
              />
            </div>
          </div>

          <div className="border-t border-white/30 pt-4">
            <h3 className="text-white mb-4">Variant Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/80 mb-2">Variant Type</label>
                <select
                  value={formData.variantAttribute}
                  onChange={(e) => setFormData({ ...formData, variantAttribute: e.target.value })}
                  className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white"
                >
                  <option value="size">Size</option>
                  <option value="color">Color</option>
                  <option value="capacity">Capacity</option>
                  <option value="type">Type</option>
                </select>
              </div>

              <div>
                <label className="block text-white/80 mb-2">Variant Value</label>
                <input
                  type="text"
                  value={formData.variantValue}
                  onChange={(e) => setFormData({ ...formData, variantValue: e.target.value })}
                  className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                  placeholder="e.g., 250g, Red, Large"
                  required
                />
              </div>

              <div>
                <label className="block text-white/80 mb-2">Cost *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                  required
                />
              </div>

              <div>
                <label className="block text-white/80 mb-2">Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                  required
                />
              </div>

              <div>
                <label className="block text-white/80 mb-2">Initial Stock *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                  required
                />
              </div>

              <div>
                <label className="block text-white/80 mb-2">Reorder Level *</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                  className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800/50 border border-white/30 rounded-lg hover:bg-slate-700/50 transition-colors text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
