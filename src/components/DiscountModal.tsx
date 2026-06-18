import { Tag, Percent, DollarSign, Gift, Check, X } from 'lucide-react';
import { useState } from 'react';

import type { DiscountCoupon } from '../types/pos';
import { POSCalculator, CouponValidator } from '../utils/posCalculations';

interface DiscountModalProps {
  isOpen: boolean;
  subtotal: number;
  cartItems: Array<{ productId: string; category?: string; price: number; quantity: number }>;
  availableCoupons: DiscountCoupon[];
  onApplyCoupon: (coupon: DiscountCoupon) => void;
  onRemoveCoupon: () => void;
  onCancel: () => void;
  appliedCoupon?: DiscountCoupon;
}

export default function DiscountModal({
  isOpen,
  subtotal,
  cartItems,
  availableCoupons,
  onApplyCoupon,
  onRemoveCoupon,
  onCancel,
  appliedCoupon,
}: DiscountModalProps) {
  const [couponCode, setCouponCode] = useState('');
  const [selectedCoupon, setSelectedCoupon] = useState<DiscountCoupon | null>(null);
  const [validationError, setValidationError] = useState('');

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode?.trim() || '';
    const coupon = availableCoupons.find(c => c.code.toLowerCase() === code.toLowerCase());

    if (!coupon) {
      setValidationError('Coupon code not found');
      return;
    }

    const validation = CouponValidator.validateCoupon(coupon);
    if (!validation.isValid) {
      setValidationError(validation.errors[0] || 'Invalid coupon');
      return;
    }

    const discount = POSCalculator.calculateCouponDiscount(subtotal, coupon, cartItems);
    if (discount === 0) {
      setValidationError('Coupon is not applicable to this order');
      return;
    }

    setSelectedCoupon(coupon);
    setValidationError('');
  };

  const handleApplyCoupon = () => {
    if (selectedCoupon) {
      onApplyCoupon(selectedCoupon);
    }
  };

  const calculateDiscount = (coupon: DiscountCoupon) => {
    return POSCalculator.calculateCouponDiscount(subtotal, coupon, cartItems);
  };

  const getCouponIcon = (type: DiscountCoupon['type']) => {
    switch (type) {
      case 'percentage':
        return Percent;
      case 'fixed':
        return DollarSign;
      case 'bogo':
      case 'buy_x_get_y':
        return Gift;
      default:
        return Tag;
    }
  };

  const getCouponDescription = (coupon: DiscountCoupon) => {
    switch (coupon.type) {
      case 'percentage':
        return `${coupon.value}% off`;
      case 'fixed':
        return `$${coupon.value} off`;
      case 'bogo':
        return 'Buy One Get One';
      case 'buy_x_get_y':
        return `Buy ${Math.floor(coupon.value)} Get ${Math.floor(coupon.value / 2)} Free`;
      default:
        return 'Special discount';
    }
  };

  if (!isOpen) return null;

  const applicableCoupons = availableCoupons.filter(coupon =>
    calculateDiscount(coupon) > 0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(10, 14, 26, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg overflow-y-auto p-6" style={{
        backgroundColor: 'rgba(11, 15, 36, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '1.5rem',
        color: '#f8faff',
        boxShadow: '0 35px 85px rgba(2, 3, 12, 0.6)',
        backdropFilter: 'blur(28px)',
      }}>
        <h2 className="text-xl font-semibold text-white mb-6">Apply Discount</h2>

        {appliedCoupon ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-emerald-400 bg-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-300" />
                  <span className="font-semibold text-emerald-300">Coupon Applied</span>
                </div>
                <button
                  onClick={onRemoveCoupon}
                  className="p-1 rounded border border-rose-200/50 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-white">
                <div className="font-semibold">{appliedCoupon.code}</div>
                <div className="text-sm text-white/80">{getCouponDescription(appliedCoupon)}</div>
                <div className="text-sm text-emerald-300">-${calculateDiscount(appliedCoupon).toFixed(2)}</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Coupon Code Input */}
            <form onSubmit={handleCodeSubmit} className="space-y-3">
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-white/60" />
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setValidationError('');
                  }}
                  placeholder="Enter coupon code..."
                  className="flex-1 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-white placeholder-white/50 text-sm focus:border-white/50 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-emerald-400 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30"
                >
                  Apply
                </button>
              </div>
              {validationError && (
                <div className="p-2 rounded border border-rose-200/50 bg-rose-500/20 text-rose-300 text-sm">
                  {validationError}
                </div>
              )}
            </form>

            {/* Available Coupons */}
            {applicableCoupons.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">Available Coupons</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {applicableCoupons.map((coupon) => {
                    const Icon = getCouponIcon(coupon.type);
                    const discount = calculateDiscount(coupon);
                    const isSelected = selectedCoupon?.id === coupon.id;

                    return (
                      <button
                        key={coupon.id}
                        onClick={() => setSelectedCoupon(coupon)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-500/20'
                            : 'border-white/30 bg-white/10 hover:border-white/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Icon className="w-5 h-5 text-white/80 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-semibold text-white">{coupon.code}</div>
                              <div className="text-sm text-white/80">{getCouponDescription(coupon)}</div>
                              {coupon.minPurchaseAmount && (
                                <div className="text-xs text-white/60">
                                  Min purchase: ${coupon.minPurchaseAmount.toFixed(2)}
                                </div>
                              )}
                              {coupon.usageLimit && (
                                <div className="text-xs text-white/60">
                                  {coupon.usageLimit - coupon.usedCount} uses left
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-emerald-300">-${discount.toFixed(2)}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {applicableCoupons.length === 0 && !validationError && (
              <div className="text-center py-8 text-white/60">
                <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No applicable coupons available</p>
                <p className="text-xs mt-1">Try entering a coupon code above</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-white/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCoupon}
                disabled={!selectedCoupon}
                className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-lime-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply Coupon
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
