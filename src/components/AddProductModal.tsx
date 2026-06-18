import { X, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { useApp } from '../context/AppContext';

interface AddProductModalProps {
  onClose: () => void;
}

export default function AddProductModal({ onClose }: AddProductModalProps) {
  const { addProduct, setModalOpen } = useApp();
  const [submitting, setSubmitting] = useState(false);
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
    reorderLevel: '',
  });

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const costVal = parseFloat(formData.cost) || 0;
      const stockVal = parseInt(formData.stock) || 0;
      const reorderVal = parseInt(formData.reorderLevel) || 0;
      const product = {
        name: formData.name,
        barcode: formData.barcode,
        sku: formData.sku,
        category: formData.category,
        supplier: formData.supplier,
        validityDate: formData.validityDate || undefined,
        variants: [
          {
            id: crypto.randomUUID(),
            attributes: formData.variantValue
              ? { [formData.variantAttribute]: formData.variantValue }
              : {},
            cost: costVal,
            costHistory: costVal > 0
              ? [{ date: new Date().toISOString(), cost: costVal, quantity: stockVal }]
              : [],
            price: parseFloat(formData.price),
            stock: stockVal,
            reorderLevel: reorderVal,
          },
        ],
      };
      await addProduct(product);
      onClose();
    } catch {
      // addProduct already shows a toast on failure
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="rounded-xl max-w-2xl w-full p-6 my-8" style={{
        backgroundColor: 'rgba(11, 15, 36, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '1.5rem',
        color: '#f8faff',
        boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
        backdropFilter: 'blur(28px)',
      }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-white text-xl font-semibold">Add New Product</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/80" />
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
                className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
                required
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
                placeholder="e.g., Beverages"
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">Supplier</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
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
            <h3 className="text-white mb-4 font-medium">Variant Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/80 mb-2">Variant Type</label>
                <select
                  value={formData.variantAttribute}
                  onChange={(e) => setFormData({ ...formData, variantAttribute: e.target.value })}
                  className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
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
                  className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
                  placeholder="e.g., 250g, Red, Large"
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
                  className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
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
                  className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
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
                  className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
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
                  className="w-full px-4 py-2 border border-white/20 bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder-white/50"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-white/80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Adding…' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
