import { useState, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner@2.0.3';

interface ImportInventoryModalProps {
  onClose: () => void;
}

export default function ImportInventoryModal({ onClose }: ImportInventoryModalProps) {
  const { products, addProduct, updateProduct, updateStock, setModalOpen } = useApp();
  const [supplier, setSupplier] = useState('');
  const [costAdjustment, setCostAdjustment] = useState('fixed');
  const [adjustmentValue, setAdjustmentValue] = useState('0');
  const [importData, setImportData] = useState('');

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse CSV-like data (simplified example)
    // Format: barcode,quantity,cost
    const lines = importData.trim().split('\n');
    
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
    };

    await Promise.all(lines.map(async line => {
      const [barcode, quantity, newCost] = line.split(',').map(s => s.trim());
      
      if (!barcode || !quantity) return;

      const product = products.find(p => p.barcode === barcode);
      
      if (product) {
        // Update existing product
        const variant = product.variants[0];
        if (!variant) return;
        const baseCost = newCost ? parseFloat(newCost) : variant.cost;
        const calculatedCost = calculateNewCost(variant.cost, baseCost);
        
        // Update cost history
        const updatedVariants = product.variants.map(v => ({
          ...v,
          cost: calculatedCost,
          costHistory: [
            ...v.costHistory,
            {
              date: new Date().toISOString(),
              cost: calculatedCost,
              quantity: parseInt(quantity)
            }
          ]
        }));

        await updateProduct(product.id, { variants: updatedVariants });
        await updateStock(product.id, variant.id, parseInt(quantity));
        results.updated += 1;
      } else {
        // Create new product (simplified - would need more data in real scenario)
        const newProduct = {
          id: Date.now().toString() + Math.random(),
          name: `Product ${barcode}`,
          barcode: barcode,
          sku: `SKU-${barcode}`,
          category: 'Imported',
          supplier: supplier || 'Unknown',
          variants: [
            {
              id: `${Date.now()}-1`,
              attributes: { type: 'Standard' },
              cost: newCost ? parseFloat(newCost) : 0,
              costHistory: [
                {
                  date: new Date().toISOString(),
                  cost: newCost ? parseFloat(newCost) : 0,
                  quantity: parseInt(quantity)
                }
              ],
              price: newCost ? parseFloat(newCost) * 1.5 : 0,
              stock: parseInt(quantity),
              reorderLevel: 10
            }
          ]
        };
        await addProduct(newProduct);
        results.created += 1;
      }
    }));

    toast.success('Import completed', {
      description: `${results.updated} updated, ${results.created} created.`,
    });
    onClose();
  };

  const calculateNewCost = (currentCost: number, newCost: number) => {
    if (costAdjustment === 'fixed') {
      return newCost + parseFloat(adjustmentValue);
    } else if (costAdjustment === 'percentage') {
      return newCost * (1 + parseFloat(adjustmentValue) / 100);
    } else if (costAdjustment === 'weighted') {
      // Simplified weighted average
      return (currentCost + newCost) / 2;
    }
    return newCost;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="hero-gradient rounded-xl shadow-xl max-w-2xl w-full p-6 my-8 text-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-white">Import Inventory</h2>
            <p className="text-white/80 text-sm">Bulk import products with automatic cost calculations</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={handleImport} className="space-y-6">
          {/* Import Settings */}
          <div>
            <h3 className="text-white mb-3">Import Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/80 mb-2">Supplier Name</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                  placeholder="Supplier name"
                />
              </div>

              <div>
                <label className="block text-white/80 mb-2">Cost Adjustment Method</label>
                <select
                  value={costAdjustment}
                  onChange={(e) => setCostAdjustment(e.target.value)}
                  className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white"
                >
                  <option value="fixed">Fixed Amount</option>
                  <option value="percentage">Percentage</option>
                  <option value="weighted">Weighted Average</option>
                </select>
              </div>

              {(costAdjustment === 'fixed' || costAdjustment === 'percentage') && (
                <div className="col-span-2">
                  <label className="block text-white/80 mb-2">
                    Adjustment Value {costAdjustment === 'percentage' ? '(%)' : '($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustmentValue}
                    onChange={(e) => setAdjustmentValue(e.target.value)}
                    className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder-white/50"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Import Data */}
          <div>
            <label className="block text-white/80 mb-2">Import Data</label>
            <p className="text-white/60 text-sm mb-2">
              Enter data in CSV format: barcode, quantity, cost (one per line)
            </p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full px-4 py-2 border border-white/30 bg-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 font-mono text-sm text-white placeholder-white/50"
              rows={10}
              placeholder="1234567890123, 50, 8.50
1234567890124, 30, 6.00
1234567890125, 100, 12.00"
              required
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-4">
            <p className="text-blue-300 text-sm font-medium">Preview</p>
            <div className="mt-2 space-y-1 text-xs text-blue-200">
              <p>• Products will be matched by barcode</p>
              <p>• Existing products: stock will be updated</p>
              <p>• New products: will be created automatically</p>
              <p>• Cost calculations use selected adjustment method</p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-white/30 rounded-lg hover:bg-white/20 transition-colors text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Upload className="w-5 h-5" />
              <span>Import Inventory</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
