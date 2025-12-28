import type { DiscountCoupon, Promotion, LoyaltyProgram, CustomerLoyalty, SplitPayment, TipInfo } from '../types/pos';

export class POSCalculator {
  // Discount Calculations
  static calculateCouponDiscount(
    subtotal: number,
    coupon: DiscountCoupon,
    cartItems: Array<{ productId: string; category?: string; price: number; quantity: number }>,
  ): number {
    if (!coupon.isActive) return 0;

    const now = new Date();
    const startDate = new Date(coupon.startDate);
    const endDate = new Date(coupon.endDate);

    if (now < startDate || now > endDate) return 0;
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return 0;
    if (coupon.minPurchaseAmount && subtotal < coupon.minPurchaseAmount) return 0;

    let applicableAmount = 0;

    if (coupon.applicableProducts?.length || coupon.applicableCategories?.length) {
      // Calculate discount only on applicable items
      cartItems.forEach(item => {
        const isApplicableProduct = coupon.applicableProducts?.includes(item.productId);
        const isApplicableCategory = coupon.applicableCategories?.includes(item.category || '');

        if (isApplicableProduct || isApplicableCategory) {
          applicableAmount += item.price * item.quantity;
        }
      });
    } else {
      applicableAmount = subtotal;
    }

    let discount = 0;

    switch (coupon.type) {
      case 'percentage':
        discount = applicableAmount * (coupon.value / 100);
        if (coupon.maxDiscountAmount) {
          discount = Math.min(discount, coupon.maxDiscountAmount);
        }
        break;
      case 'fixed':
        discount = Math.min(coupon.value, applicableAmount);
        break;
      case 'bogo':
        // Buy one get one - 50% off on applicable items
        discount = applicableAmount * 0.5;
        break;
      case 'buy_x_get_y':
        // Buy X get Y free - simplified as percentage discount
        discount = applicableAmount * (coupon.value / 100);
        break;
    }

    return discount;
  }

  static calculatePromotionDiscount(
    subtotal: number,
    promotion: Promotion,
    cartItems: Array<{ productId: string; category?: string; price: number; quantity: number; totalAmount: number }>,
  ): number {
    if (!promotion.isActive) return 0;

    const now = new Date();
    const startDate = new Date(promotion.startDate);
    const endDate = new Date(promotion.endDate);

    if (now < startDate || now > endDate) return 0;

    // Check conditions
    if (promotion.conditions.minAmount && subtotal < promotion.conditions.minAmount) return 0;
    if (promotion.conditions.minQuantity) {
      const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQuantity < promotion.conditions.minQuantity) return 0;
    }

    let applicableAmount = 0;

    if (promotion.conditions.applicableProducts?.length || promotion.conditions.applicableCategories?.length) {
      cartItems.forEach(item => {
        const isApplicableProduct = promotion.conditions.applicableProducts?.includes(item.productId);
        const isApplicableCategory = promotion.conditions.applicableCategories?.includes(item.category || '');

        if (isApplicableProduct || isApplicableCategory) {
          applicableAmount += item.totalAmount;
        }
      });
    } else {
      applicableAmount = subtotal;
    }

    let discount = 0;

    switch (promotion.type) {
      case 'percentage':
        discount = applicableAmount * (promotion.value / 100);
        break;
      case 'fixed':
        discount = Math.min(promotion.value, applicableAmount);
        break;
      case 'bundle':
        // Bundle discount - simplified as fixed amount off
        discount = promotion.value;
        break;
      case 'free_shipping':
        // Free shipping - would be handled separately
        discount = 0;
        break;
    }

    return discount;
  }

  // Tip Calculations
  static calculateTip(subtotal: number, tipInfo: TipInfo): number {
    switch (tipInfo.type) {
      case 'percentage':
        return subtotal * (tipInfo.percentage! / 100);
      case 'fixed':
        return tipInfo.amount;
      case 'custom':
        return tipInfo.amount;
      default:
        return 0;
    }
  }

  // Loyalty Points Calculations
  static calculateLoyaltyPointsEarned(
    amount: number,
    program: LoyaltyProgram,
  ): number {
    return Math.floor(amount * program.pointsPerDollar);
  }

  static calculateLoyaltyDiscount(
    pointsToRedeem: number,
    program: LoyaltyProgram,
  ): number {
    return pointsToRedeem * program.redemptionRate;
  }

  static canRedeemPoints(
    pointsToRedeem: number,
    customerLoyalty: CustomerLoyalty,
  ): boolean {
    return customerLoyalty.currentPoints >= pointsToRedeem;
  }

  // Split Payment Validation
  static validateSplitPayments(payments: SplitPayment[], totalAmount: number): {
    isValid: boolean;
    error?: string;
  } {
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

    if (Math.abs(totalPaid - totalAmount) > 0.01) {
      return {
        isValid: false,
        error: `Payment amounts must equal total. Required: $${totalAmount.toFixed(2)}, Paid: $${totalPaid.toFixed(2)}`,
      };
    }

    if (payments.some(payment => payment.amount <= 0)) {
      return {
        isValid: false,
        error: 'All payment amounts must be greater than 0',
      };
    }

    return { isValid: true };
  }

  // Tax Calculation (simplified - would integrate with real tax rates)
  static calculateTax(subtotal: number, taxRate: number = 0.08): number {
    return subtotal * taxRate;
  }

  // Final Total Calculation
  static calculateFinalTotal(
    subtotal: number,
    tax: number,
    discounts: number,
    tips: number,
  ): number {
    return Math.max(0, subtotal + tax - discounts + tips);
  }
}

export class CouponValidator {
  static validateCoupon(coupon: DiscountCoupon): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!coupon.code || coupon.code.trim().length === 0) {
      errors.push('Coupon code is required');
    }

    if (coupon.value <= 0) {
      errors.push('Coupon value must be greater than 0');
    }

    if (coupon.type === 'percentage' && coupon.value > 100) {
      errors.push('Percentage discount cannot exceed 100%');
    }

    if (coupon.minPurchaseAmount && coupon.minPurchaseAmount <= 0) {
      errors.push('Minimum purchase amount must be greater than 0');
    }

    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount <= 0) {
      errors.push('Maximum discount amount must be greater than 0');
    }

    if (coupon.usageLimit && coupon.usageLimit <= 0) {
      errors.push('Usage limit must be greater than 0');
    }

    if (new Date(coupon.startDate) >= new Date(coupon.endDate)) {
      errors.push('End date must be after start date');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
