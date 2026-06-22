import { X, Upload, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { TransactionManager } from '../utils/transactionManager';

interface ImportInventoryModalProps {
  onClose: () => void;
}

interface ImportResult {
  barcode: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  productId?: string;
}

export default function EnhancedImportInventoryModal({ onClose }: ImportInventoryModalProps) {
  const { products, setModalOpen } = useApp();
  const [supplier, setSupplier] = useState('');
  const [costAdjustment, setCostAdjustment] = useState('fixed');
  const [adjustmentValue, setAdjustmentValue] = useState('0');
  const [importData, setImportData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    setModalOpen(true);
    return () => setModalOpen(false);
  }, [setModalOpen]);

  const validateImportData = (lines: string[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const parts = line.split(',').map(s => s.trim());

      if (parts.length < 2) {
        errors.push(`Line ${index + 1}: Must have at least barcode and quantity`);
        return;
      }

      const [barcode, quantity, cost] = parts;

      if (!barcode) {
        errors.push(`Line ${index + 1}: Barcode is required`);
      }

      if (!quantity || isNaN(parseInt(quantity))) {
        errors.push(`Line ${index + 1}: Invalid quantity`);
      }

      if (cost && (isNaN(parseFloat(cost)) || parseFloat(cost) < 0)) {
        errors.push(`Line ${index + 1}: Invalid cost`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    const lines = importData.trim().split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      toast.error('No data to import');
      return;
    }

    const validation = validateImportData(lines);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      toast.error('Validation failed', {
        description: `${validation.errors.length} errors found`,
      });
      return;
    }

    setValidationErrors([]);
    setIsImporting(true);

    const results: ImportResult[] = lines.map(line => ({
      barcode: line.split(',')[0]?.trim() || '',
      status: 'pending' as const,
      message: 'Processing...',
    }));

    setImportResults(results);

    try {
      const operations = lines.map(line => {
        const [barcode, quantity, newCost] = line.split(',').map(s => s.trim());
        const product = products.find(p => p.barcode === barcode);

        if (product && product.variants[0]) {

          const baseCost = newCost ? parseFloat(newCost) : product.variants[0].cost;
          const calculatedCost = calculateNewCost(product.variants[0].cost, baseCost);

          return {
            type: 'update' as const,
            entity: 'product' as const,
            id: product.id,
            data: {
              variants: product.variants.map(v => ({
                ...v,
                cost: calculatedCost,
                costHistory: [
                  ...v.costHistory,
                  {
                    date: new Date().toISOString(),
                    cost: calculatedCost,
                    quantity: parseInt(quantity || '0'),
                  },
                ],
              })),
            },
          };
        } else {
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
                    quantity: parseInt(quantity || '0'),
                  },
                ],
                price: newCost ? parseFloat(newCost) * 1.5 : 0,
                stock: parseInt(quantity || '0'),
                reorderLevel: 10,
              },
            ],
          };

          return {
            type: 'create' as const,
            entity: 'product' as const,
            data: newProduct,
          };
        }
      }).filter(op => op !== null);

      const stockOperations = lines.map(line => {
        const [barcode, quantity] = line.split(',').map(s => s.trim());
        const product = products.find(p => p.barcode === barcode);

        if (product && product.variants[0]) {
          return {
            type: 'update' as const,
            entity: 'stock' as const,
            data: {
              productId: product.id,
              variantId: product.variants[0].id,
              quantity: (product.variants[0].stock || 0) + parseInt(quantity || '0'),
            },
          };
        }
        return null;
      }).filter(op => op !== null);

      const allOperations = [...operations, ...stockOperations];

      const transactionResult = await TransactionManager.executeTransaction(allOperations);

      if (transactionResult.success) {
        const updatedResults = lines.map((line, _index) => {
          const barcode = line.split(',')[0]?.trim() || '';
          const product = products.find(p => p.barcode === barcode);

          return {
            barcode,
            status: 'success' as const,
            message: product ? 'Updated successfully' : 'Created successfully',
            productId: product?.id,
          };
        });

        setImportResults(updatedResults);

        toast.success('Import completed', {
          description: `${operations.length} products processed successfully`,
        });

        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const errorResults = lines.map(line => ({
          barcode: line.split(',')[0]?.trim() || '',
          status: 'error' as const,
          message: typeof transactionResult.error === 'string' ? transactionResult.error : 'Transaction failed',
        }));

        setImportResults(errorResults);

        toast.error('Import failed', {
          description: transactionResult.error || 'Transaction failed',
        });
      }
    } catch (error) {
      console.error('Import failed:', error);

      const errorResults = lines.map(line => ({
        barcode: line.split(',')[0]?.trim() || '',
        status: 'error' as const,
        message: error instanceof Error ? error.message : 'Unknown error',
      }));

      setImportResults(errorResults);

      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const calculateNewCost = (currentCost: number, newCost: number) => {
    if (costAdjustment === 'fixed') {
      return newCost + parseFloat(adjustmentValue);
    } else if (costAdjustment === 'percentage') {
      return newCost * (1 + parseFloat(adjustmentValue) / 100);
    } else if (costAdjustment === 'weighted') {
      return (currentCost + newCost) / 2;
    }
    return newCost;
  };

  const getStatusIcon = (status: ImportResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="rounded-xl max-w-4xl w-full p-6 my-8" style={{
        backgroundColor: 'rgba(11, 15, 36, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '1.5rem',
        color: '#f8faff',
        boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
        backdropFilter: 'blur(28px)',
      }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-white">Enhanced Import Inventory</h2>
            <p className="text-white/80 text-sm">Bulk import with transaction safety and validation</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <form onSubmit={(e) => void handleImport(e)} className="space-y-6">
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
                  className="w-full px-4 py-2 border border-white/20 bg-slate-800 rounded-lg focus:outline-none focus:border-indigo-500 text-white"
                >
                  <option value="fixed" className="bg-slate-800">Fixed Amount</option>
                  <option value="percentage" className="bg-slate-800">Percentage</option>
                  <option value="weighted" className="bg-slate-800">Weighted Average</option>
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

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
              <p className="text-red-300 text-sm font-medium mb-2">Validation Errors</p>
              <div className="space-y-1">
                {validationErrors.map((error, index) => (
                  <p key={index} className="text-red-200 text-xs">{error}</p>
                ))}
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResults.length > 0 && (
            <div>
              <h3 className="text-white mb-3">Import Results</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {importResults.map((result, index) => (
                  <div key={index} className="flex items-center space-x-3 p-2 bg-white/10 rounded-lg">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <p className="text-white text-sm">{result.barcode}</p>
                      <p className="text-white/60 text-xs">{result.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-4">
            <p className="text-blue-300 text-sm font-medium">Enhanced Features</p>
            <div className="mt-2 space-y-1 text-xs text-blue-200">
              <p>• Transaction safety - all operations succeed or fail together</p>
              <p>• Data validation - checks for invalid input before processing</p>
              <p>• Race condition prevention - prevents concurrent stock updates</p>
              <p>• Real-time feedback - shows progress of each import item</p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="flex-1 px-4 py-3 border border-white/30 rounded-lg hover:bg-white/20 transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isImporting}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5" />
              <span>{isImporting ? 'Importing...' : 'Import Inventory'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
