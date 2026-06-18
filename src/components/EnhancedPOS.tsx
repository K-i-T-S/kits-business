import { ShoppingCart, CreditCard, DollarSign, Tag, Star, Settings, Receipt, Plus, Minus, X } from 'lucide-react';
import { useState, useEffect } from 'react';

import type {
  SplitPayment,
  TipInfo,
  DiscountCoupon,
  Promotion,
  LoyaltyProgram,
  CustomerLoyalty,
  ReceiptTemplate,
  EnhancedSale,
  SaleItem,
} from '../types/pos';
import { log } from '../utils/logger';
import { POSCalculator } from '../utils/posCalculations';

import DiscountModal from './DiscountModal';
import LoyaltyModal from './LoyaltyModal';
import ReceiptCustomizationModal from './ReceiptCustomizationModal';
import SplitPaymentModal from './SplitPaymentModal';
import TipsModal from './TipsModal';

interface EnhancedPOSProps {
  customerId?: string;
  employeeId: string;
  availableCoupons: DiscountCoupon[];
  availablePromotions: Promotion[];
  loyaltyPrograms: LoyaltyProgram[];
  receiptTemplates: ReceiptTemplate[];
  onCompleteSale: (sale: EnhancedSale) => void;
}

export default function EnhancedPOS({
  customerId,
  employeeId,
  availableCoupons,
  availablePromotions,
  loyaltyPrograms,
  receiptTemplates,
  onCompleteSale,
}: EnhancedPOSProps) {
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [showReceiptCustomization, setShowReceiptCustomization] = useState(false);

  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCoupon | undefined>();
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | undefined>();
  const [tipInfo, setTipInfo] = useState<TipInfo | undefined>();
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [loyaltyPointsRedeemed, setLoyaltyPointsRedeemed] = useState(0);
  const [selectedReceiptTemplate, setSelectedReceiptTemplate] = useState<ReceiptTemplate | undefined>();

  const [customerLoyalty, setCustomerLoyalty] = useState<CustomerLoyalty | undefined>();
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | undefined>();

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = POSCalculator.calculateTax(subtotal);
  const couponDiscount = appliedCoupon ? POSCalculator.calculateCouponDiscount(subtotal, appliedCoupon, cartItems.map(item => ({ ...item, totalAmount: item.price * item.quantity }))) : 0;
  const promotionDiscount = appliedPromotion ? POSCalculator.calculatePromotionDiscount(subtotal, appliedPromotion, cartItems.map(item => ({ ...item, totalAmount: item.price * item.quantity }))) : 0;
  const loyaltyDiscount = loyaltyPointsRedeemed && loyaltyProgram ? POSCalculator.calculateLoyaltyDiscount(loyaltyPointsRedeemed, loyaltyProgram) : 0;
  const totalDiscounts = couponDiscount + promotionDiscount + loyaltyDiscount;
  const tipAmount = tipInfo ? POSCalculator.calculateTip(subtotal, tipInfo) : 0;
  const total = POSCalculator.calculateFinalTotal(subtotal, tax, totalDiscounts, tipAmount);

  useEffect(() => {
    if (customerId && loyaltyPrograms.length > 0) {
      // In a real app, this would fetch customer loyalty data
      const mockCustomerLoyalty: CustomerLoyalty = {
        customerId,
        programId: loyaltyPrograms[0]?.id || '',
        currentPoints: 250,
        tierId: loyaltyPrograms[0]?.tiers[0]?.id || '',
        totalEarned: 500,
        totalRedeemed: 250,
        joinDate: '2024-01-01',
        lastActivity: '2024-12-20',
      };
      setCustomerLoyalty(mockCustomerLoyalty);
      setLoyaltyProgram(loyaltyPrograms[0]);
    }
  }, [customerId, loyaltyPrograms]);

  const addToCart = (item: SaleItem) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.productId === item.productId);
      if (existing) {
        return prev.map(i =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i,
        );
      }
      return [...prev, item];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(prev => prev.filter(item => item.productId !== productId));
    } else {
      setCartItems(prev => prev.map(item =>
        item.productId === productId ? { ...item, quantity } : item,
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.productId !== productId));
  };

  const handleSplitPaymentComplete = (payments: SplitPayment[]) => {
    setSplitPayments(payments);
    setShowSplitPayment(false);
    completeSale(payments);
  };

  const handleTipComplete = (tip: TipInfo) => {
    setTipInfo(tip);
    setShowTips(false);
  };

  const handleCouponApply = (coupon: DiscountCoupon) => {
    setAppliedCoupon(coupon);
    setShowDiscount(false);
  };

  const handleCouponRemove = () => {
    setAppliedCoupon(undefined);
  };

  const handleLoyaltyRedeem = (points: number) => {
    setLoyaltyPointsRedeemed(points);
    setShowLoyalty(false);
  };

  const completeSale = (payments?: SplitPayment[]) => {
    const finalPayments = payments || splitPayments;
    const loyaltyPointsEarned = loyaltyProgram ? POSCalculator.calculateLoyaltyPointsEarned(subtotal, loyaltyProgram) : 0;

    const sale: EnhancedSale = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      items: cartItems,
      subtotal,
      tax,
      discounts: totalDiscounts,
      tips: tipAmount,
      total,
      payments: finalPayments,
      tipInfo,
      appliedCoupon,
      appliedPromotion,
      loyaltyPointsEarned,
      loyaltyPointsRedeemed: loyaltyPointsRedeemed,
      employeeId,
      customerId,
      receiptTemplate: selectedReceiptTemplate?.id,
    };

    onCompleteSale(sale);
    resetSale();
  };

  const resetSale = () => {
    setCartItems([]);
    setAppliedCoupon(undefined);
    setAppliedPromotion(undefined);
    setTipInfo(undefined);
    setSplitPayments([]);
    setLoyaltyPointsRedeemed(0);
  };

  const mockProduct: SaleItem = {
    productId: 'prod-1',
    variantId: 'var-1',
    productName: 'Sample Product',
    quantity: 1,
    price: 10.00,
    cost: 5.00,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-lime-400 bg-clip-text text-transparent">
            Enhanced POS System
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowReceiptCustomization(true)}
              className="p-2 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30"
            >
              <Receipt className="w-5 h-5" />
            </button>
            <button
              onClick={() => addToCart(mockProduct)}
              className="p-2 rounded-lg border border-emerald-400 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Shopping Cart
                </h2>
                <span className="text-sm text-white/60">
                  {cartItems.length} items
                </span>
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Cart is empty</p>
                  <p className="text-sm mt-1">Add items to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between p-3 rounded-lg border border-white/30 bg-white/10">
                      <div className="flex-1">
                        <div className="font-medium text-white">{item.productName}</div>
                        <div className="text-sm text-white/60">${item.price.toFixed(2)} each</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="p-1 rounded border border-white/30 bg-white/20 text-white/80 hover:bg-white/30"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-white">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="p-1 rounded border border-white/30 bg-white/20 text-white/80 hover:bg-white/30"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="p-1 rounded border border-rose-200/50 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 ms-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-end ms-4">
                        <div className="font-semibold text-white">
                          ${(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setShowSplitPayment(true)}
                disabled={cartItems.length === 0}
                className="flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30 disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                Split Payment
              </button>
              <button
                onClick={() => setShowTips(true)}
                disabled={cartItems.length === 0}
                className="flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30 disabled:opacity-50"
              >
                <DollarSign className="w-4 h-4" />
                Add Tip
              </button>
              <button
                onClick={() => setShowDiscount(true)}
                disabled={cartItems.length === 0}
                className="flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30 disabled:opacity-50"
              >
                <Tag className="w-4 h-4" />
                Discount
              </button>
              <button
                onClick={() => setShowLoyalty(true)}
                disabled={cartItems.length === 0 || !customerLoyalty}
                className="flex items-center justify-center gap-2 p-3 rounded-lg border border-white/30 bg-white/20 text-white/80 hover:bg-white/30 disabled:opacity-50"
              >
                <Star className="w-4 h-4" />
                Loyalty
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <div className="glass-panel p-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

              <div className="space-y-3">
                <div className="flex justify-between text-white/80">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-white/80">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>

                {totalDiscounts > 0 && (
                  <div className="flex justify-between text-emerald-300">
                    <span>Discounts</span>
                    <span>-${totalDiscounts.toFixed(2)}</span>
                  </div>
                )}

                {tipAmount > 0 && (
                  <div className="flex justify-between text-blue-300">
                    <span>Tip</span>
                    <span>${tipAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t border-white/30 pt-3">
                  <div className="flex justify-between text-lg font-bold text-white">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Applied Items */}
              <div className="mt-4 space-y-2">
                {appliedCoupon && (
                  <div className="p-2 rounded border border-emerald-400 bg-emerald-500/20 text-emerald-300 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Coupon: {appliedCoupon.code}</span>
                      <button onClick={handleCouponRemove} className="text-rose-300 hover:text-rose-200">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {tipInfo && (
                  <div className="p-2 rounded border border-blue-400 bg-blue-500/20 text-blue-300 text-sm">
                    Tip: {tipInfo.type === 'percentage' ? `${tipInfo.percentage}%` : `$${tipInfo.amount.toFixed(2)}`}
                  </div>
                )}

                {loyaltyPointsRedeemed > 0 && (
                  <div className="p-2 rounded border border-amber-400 bg-amber-500/20 text-amber-300 text-sm">
                    {loyaltyPointsRedeemed} points redeemed
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowSplitPayment(true)}
                disabled={cartItems.length === 0}
                className="w-full mt-6 rounded-lg bg-gradient-to-r from-emerald-500 to-lime-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Complete Sale
              </button>
            </div>

            {/* Customer Info */}
            {customerId && customerLoyalty && (
              <div className="glass-panel p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-amber-300" />
                  <span className="font-medium text-white">Customer Loyalty</span>
                </div>
                <div className="text-sm text-white/80">
                  <div>Points: {customerLoyalty.currentPoints}</div>
                  <div>Program: {loyaltyProgram?.name}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showSplitPayment && (
        <SplitPaymentModal
          isOpen={showSplitPayment}
          totalAmount={total}
          onComplete={handleSplitPaymentComplete}
          onCancel={() => setShowSplitPayment(false)}
        />
      )}

      {showTips && (
        <TipsModal
          isOpen={showTips}
          subtotal={subtotal}
          onComplete={handleTipComplete}
          onCancel={() => setShowTips(false)}
        />
      )}

      {showDiscount && (
        <DiscountModal
          isOpen={showDiscount}
          subtotal={subtotal}
          cartItems={cartItems}
          availableCoupons={availableCoupons}
          onApplyCoupon={handleCouponApply}
          onRemoveCoupon={handleCouponRemove}
          onCancel={() => setShowDiscount(false)}
          appliedCoupon={appliedCoupon}
        />
      )}

      {showLoyalty && (
        <LoyaltyModal
          isOpen={showLoyalty}
          subtotal={subtotal}
          customerLoyalty={customerLoyalty}
          loyaltyProgram={loyaltyProgram}
          onRedeemPoints={handleLoyaltyRedeem}
          onCancel={() => setShowLoyalty(false)}
        />
      )}

      {showReceiptCustomization && (
        <ReceiptCustomizationModal
          isOpen={showReceiptCustomization}
          templates={receiptTemplates}
          currentTemplate={selectedReceiptTemplate}
          onSelectTemplate={setSelectedReceiptTemplate}
          onSaveTemplate={(template) => {
            // In a real app, this would save to backend
            log.info('Save template', { template });
          }}
          onCancel={() => setShowReceiptCustomization(false)}
        />
      )}
    </div>
  );
}
