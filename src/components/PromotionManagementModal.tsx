import { Tag, Percent, DollarSign, Gift, Plus, Edit, Trash2, Calendar, Users, Package } from 'lucide-react';
import { useState } from 'react';

import type { Promotion } from '../types/pos';

interface PromotionManagementModalProps {
  isOpen: boolean;
  promotions: Promotion[];
  onCreatePromotion: (promotion: Omit<Promotion, 'id'>) => void;
  onUpdatePromotion: (promotion: Promotion) => void;
  onDeletePromotion: (promotionId: string) => void;
  onCancel: () => void;
}

export default function PromotionManagementModal({
  isOpen,
  promotions,
  onCreatePromotion,
  onUpdatePromotion,
  onDeletePromotion,
  onCancel,
}: PromotionManagementModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'percentage' as Promotion['type'],
    value: 0,
    minQuantity: 0,
    minAmount: 0,
    startDate: '',
    endDate: '',
    isActive: true,
    conditions: {
      minQuantity: 0,
      minAmount: 0,
      applicableProducts: [] as string[],
      applicableCategories: [] as string[],
      customerSegment: [] as string[],
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'percentage',
      value: 0,
      minQuantity: 0,
      minAmount: 0,
      startDate: '',
      endDate: '',
      isActive: true,
      conditions: {
        minQuantity: 0,
        minAmount: 0,
        applicableProducts: [],
        applicableCategories: [],
        customerSegment: [],
      },
    });
    setEditingPromotion(null);
    setIsCreating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const promotionData = {
      ...formData,
      startDate: formData.startDate || new Date().toISOString().split('T')[0],
      endDate: formData.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      conditions: {
        minQuantity: formData.minQuantity,
        minAmount: formData.minAmount,
        applicableProducts: formData.conditions.applicableProducts || [],
        applicableCategories: formData.conditions.applicableCategories || [],
        customerSegment: formData.conditions.customerSegment || [],
      },
    } as Omit<Promotion, 'id'>;

    if (editingPromotion) {
      onUpdatePromotion({ ...editingPromotion, ...promotionData });
    } else {
      onCreatePromotion(promotionData);
    }

    resetForm();
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      description: promotion.description,
      type: promotion.type,
      value: promotion.value,
      minQuantity: promotion.conditions.minQuantity || 0,
      minAmount: promotion.conditions.minAmount || 0,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      isActive: promotion.isActive,
      conditions: {
        minQuantity: promotion.conditions.minQuantity || 0,
        minAmount: promotion.conditions.minAmount || 0,
        applicableProducts: promotion.conditions.applicableProducts || [],
        applicableCategories: promotion.conditions.applicableCategories || [],
        customerSegment: promotion.conditions.customerSegment || [],
      },
    });
    setIsCreating(true);
  };

  const getPromotionIcon = (type: Promotion['type']) => {
    switch (type) {
      case 'percentage':
        return Percent;
      case 'fixed':
        return DollarSign;
      case 'bundle':
      case 'free_shipping':
        return Gift;
      default:
        return Tag;
    }
  };

  const getPromotionDescription = (promotion: Promotion) => {
    switch (promotion.type) {
      case 'percentage':
        return `${promotion.value}% off`;
      case 'fixed':
        return `$${promotion.value} off`;
      case 'bundle':
        return `Bundle deal - $${promotion.value} off`;
      case 'free_shipping':
        return 'Free shipping';
      default:
        return 'Special promotion';
    }
  };

  const isPromotionActive = (promotion: Promotion) => {
    const now = new Date();
    const start = new Date(promotion.startDate);
    const end = new Date(promotion.endDate);
    return promotion.isActive && now >= start && now <= end;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6" style={{
        backgroundColor: 'rgba(11, 15, 36, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '1.5rem',
        color: '#f8faff',
        boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
        backdropFilter: 'blur(28px)'
      }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Promotion Management</h2>
          <div className="flex gap-2">
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="p-2 rounded-lg border border-emerald-400 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onCancel}
              className="p-2 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30"
            >
              ×
            </button>
          </div>
        </div>

        {isCreating ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/60 mb-1">Promotion Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                  placeholder="Enter promotion name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Promotion['type'] })}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="percentage" className="bg-slate-800">Percentage Off</option>
                  <option value="fixed" className="bg-slate-800">Fixed Amount Off</option>
                  <option value="bundle" className="bg-slate-800">Bundle Deal</option>
                  <option value="free_shipping" className="bg-slate-800">Free Shipping</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                rows={2}
                placeholder="Describe the promotion"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-white/60 mb-1">Value</label>
                <div className="flex items-center gap-2">
                  {formData.type === 'percentage' ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                        className="flex-1 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                        required
                      />
                      <span className="text-white/60">%</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 text-white/60" />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                        className="flex-1 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                        required
                      />
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1">Min Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={formData.minQuantity}
                  onChange={(e) => setFormData({ ...formData, minQuantity: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-1">Min Amount</label>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-white/60" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minAmount}
                    onChange={(e) => setFormData({ ...formData, minAmount: parseFloat(e.target.value) || 0 })}
                    className="flex-1 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/60 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white text-sm focus:border-white/50 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-white/30 bg-white/20"
              />
              <label htmlFor="isActive" className="text-sm text-white/80">
                Promotion is active
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-lime-400 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40"
              >
                {editingPromotion ? 'Update' : 'Create'} Promotion
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {promotions.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No promotions found</p>
                <p className="text-xs mt-1">Create your first promotion to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {promotions.map((promotion) => {
                  const Icon = getPromotionIcon(promotion.type);
                  const isActive = isPromotionActive(promotion);

                  return (
                    <div key={promotion.id} className="p-4 rounded-lg border border-white/30 bg-white/10">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Icon className="w-5 h-5 text-white/80 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-white">{promotion.name}</h3>
                              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                            </div>
                            <p className="text-sm text-white/80 mb-2">{promotion.description}</p>
                            <div className="text-sm text-emerald-300 mb-2">
                              {getPromotionDescription(promotion)}
                            </div>

                            <div className="flex flex-wrap gap-4 text-xs text-white/60">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(promotion.startDate).toLocaleDateString()} - {new Date(promotion.endDate).toLocaleDateString()}
                              </div>

                              {promotion.conditions.minQuantity && promotion.conditions.minQuantity > 0 && (
                                <div className="flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  Min {promotion.conditions.minQuantity} items
                                </div>
                              )}

                              {promotion.conditions.minAmount && promotion.conditions.minAmount > 0 && (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  Min ${promotion.conditions.minAmount.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(promotion)}
                            className="p-2 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeletePromotion(promotion.id)}
                            className="p-2 rounded-lg border border-rose-200/50 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
