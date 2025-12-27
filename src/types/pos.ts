// Enhanced POS Types for Split Payments, Tips, Discounts, and Loyalty

export interface SplitPayment {
  id: string;
  method: 'cash' | 'card' | 'digital';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  transactionId?: string;
}

export interface TipInfo {
  amount: number;
  percentage?: number;
  type: 'percentage' | 'fixed' | 'custom';
}

export interface DiscountCoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'buy_x_get_y';
  value: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  usageLimit?: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed' | 'bundle' | 'free_shipping';
  value: number;
  conditions: {
    minQuantity?: number;
    minAmount?: number;
    applicableProducts?: string[];
    applicableCategories?: string[];
    customerSegment?: string[];
  };
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  pointsPerDollar: number;
  redemptionRate: number; // points to dollar conversion
  tiers: LoyaltyTier[];
  rewards: LoyaltyReward[];
}

export interface LoyaltyTier {
  id: string;
  name: string;
  minPoints: number;
  benefits: string[];
  discountRate: number;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  pointsCost: number;
  type: 'discount' | 'free_product' | 'upgrade';
  value: number;
  description: string;
}

export interface CustomerLoyalty {
  customerId: string;
  programId: string;
  currentPoints: number;
  tierId: string;
  totalEarned: number;
  totalRedeemed: number;
  joinDate: string;
  lastActivity: string;
}

export interface ReceiptTemplate {
  id: string;
  name: string;
  header: string;
  footer: string;
  includeLogo: boolean;
  includeBarcode: boolean;
  includeQrCode: boolean;
  customFields: ReceiptField[];
  isActive: boolean;
}

export interface ReceiptField {
  id: string;
  label: string;
  type: 'text' | 'date' | 'amount' | 'custom';
  value: string;
  position: 'header' | 'body' | 'footer';
}

export interface EnhancedSale {
  id: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discounts: number;
  tips: number;
  total: number;
  payments: SplitPayment[];
  tipInfo?: TipInfo;
  appliedCoupon?: DiscountCoupon;
  appliedPromotion?: Promotion;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  employeeId: string;
  customerId?: string;
  receiptTemplate?: string;
  notes?: string;
}

export interface SaleItem {
  productId: string;
  variantId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
  discounts?: number;
  loyaltyPoints?: number;
}
