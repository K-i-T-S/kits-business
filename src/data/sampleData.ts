import type { DiscountCoupon, Promotion, LoyaltyProgram, ReceiptTemplate } from '../types/pos';

// Sample discount coupons
export const sampleCoupons: DiscountCoupon[] = [
  {
    id: 'coupon-1',
    code: 'WELCOME10',
    type: 'percentage',
    value: 10,
    minPurchaseAmount: 50,
    maxDiscountAmount: 25,
    usageLimit: 100,
    usedCount: 15,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    isActive: true,
  },
  {
    id: 'coupon-2',
    code: 'SAVE20',
    type: 'fixed',
    value: 20,
    minPurchaseAmount: 100,
    usageLimit: 50,
    usedCount: 8,
    startDate: '2024-06-01',
    endDate: '2024-12-31',
    isActive: true,
  },
  {
    id: 'coupon-3',
    code: 'BOGO',
    type: 'bogo',
    value: 50,
    applicableCategories: ['electronics', 'clothing'],
    usageLimit: 30,
    usedCount: 5,
    startDate: '2024-11-01',
    endDate: '2024-12-31',
    isActive: true,
  },
  {
    id: 'coupon-4',
    code: 'HOLIDAY25',
    type: 'percentage',
    value: 25,
    minPurchaseAmount: 200,
    maxDiscountAmount: 50,
    usageLimit: 200,
    usedCount: 45,
    startDate: '2024-11-15',
    endDate: '2024-12-31',
    isActive: true,
  },
];

// Sample promotions
export const samplePromotions: Promotion[] = [
  {
    id: 'promo-1',
    name: 'Weekend Special',
    description: 'Extra 15% off on all electronics this weekend',
    type: 'percentage',
    value: 15,
    conditions: {
      minAmount: 100,
      applicableCategories: ['electronics'],
    },
    startDate: '2024-12-20',
    endDate: '2024-12-31',
    isActive: true,
  },
  {
    id: 'promo-2',
    name: 'Bundle Deal',
    description: 'Buy 2 or more items and get $10 off',
    type: 'fixed',
    value: 10,
    conditions: {
      minQuantity: 2,
    },
    startDate: '2024-12-01',
    endDate: '2024-12-31',
    isActive: true,
  },
  {
    id: 'promo-3',
    name: 'Free Shipping',
    description: 'Free shipping on orders over $75',
    type: 'free_shipping',
    value: 0,
    conditions: {
      minAmount: 75,
    },
    startDate: '2024-12-01',
    endDate: '2024-12-31',
    isActive: true,
  },
  {
    id: 'promo-4',
    name: 'Holiday Bundle',
    description: 'Special holiday bundle discount',
    type: 'bundle',
    value: 25,
    conditions: {
      minAmount: 150,
      minQuantity: 3,
    },
    startDate: '2024-12-15',
    endDate: '2024-12-31',
    isActive: true,
  },
];

// Sample loyalty program
export const sampleLoyaltyProgram: LoyaltyProgram = {
  id: 'loyalty-1',
  name: 'Rewards Plus',
  pointsPerDollar: 1,
  redemptionRate: 0.01, // 100 points = $1
  tiers: [
    {
      id: 'tier-1',
      name: 'Bronze',
      minPoints: 0,
      benefits: ['1 point per dollar', 'Birthday rewards'],
      discountRate: 0,
    },
    {
      id: 'tier-2',
      name: 'Silver',
      minPoints: 500,
      benefits: ['1.25 points per dollar', 'Birthday rewards', 'Free shipping on orders over $50'],
      discountRate: 5,
    },
    {
      id: 'tier-3',
      name: 'Gold',
      minPoints: 1500,
      benefits: ['1.5 points per dollar', 'Birthday rewards', 'Free shipping on all orders', 'Exclusive access to sales'],
      discountRate: 10,
    },
    {
      id: 'tier-4',
      name: 'Platinum',
      minPoints: 3000,
      benefits: ['2 points per dollar', 'Birthday rewards', 'Free shipping on all orders', 'Exclusive access to sales', 'Personal shopper service'],
      discountRate: 15,
    },
  ],
  rewards: [
    {
      id: 'reward-1',
      name: '$5 Off',
      pointsCost: 500,
      type: 'discount',
      value: 5,
      description: '$5 discount on your next purchase',
    },
    {
      id: 'reward-2',
      name: '$10 Off',
      pointsCost: 900,
      type: 'discount',
      value: 10,
      description: '$10 discount on your next purchase',
    },
    {
      id: 'reward-3',
      name: 'Free Shipping',
      pointsCost: 200,
      type: 'discount',
      value: 0,
      description: 'Free shipping on your next order',
    },
    {
      id: 'reward-4',
      name: 'Product Upgrade',
      pointsCost: 1500,
      type: 'upgrade',
      value: 0,
      description: 'Free upgrade to premium version of selected products',
    },
  ],
};

// Sample receipt templates
export const sampleReceiptTemplates: ReceiptTemplate[] = [
  {
    id: 'template-1',
    name: 'Standard Receipt',
    header: 'Thank you for shopping with us!',
    footer: 'Please come again soon!\nFollow us on social media for updates',
    includeLogo: true,
    includeBarcode: true,
    includeQrCode: false,
    customFields: [
      {
        id: 'field-1',
        label: 'Store Location',
        type: 'text',
        value: 'Main Street Store',
        position: 'header',
      },
      {
        id: 'field-2',
        label: 'Cashier',
        type: 'text',
        value: '',
        position: 'footer',
      },
    ],
    isActive: true,
  },
  {
    id: 'template-2',
    name: 'Minimal Receipt',
    header: 'Thank you!',
    footer: 'Visit us again',
    includeLogo: false,
    includeBarcode: true,
    includeQrCode: false,
    customFields: [],
    isActive: false,
  },
  {
    id: 'template-3',
    name: 'Premium Receipt',
    header: 'Thank you for your purchase!\nWe appreciate your business',
    footer: 'Customer Service: 1-800-123-4567\nEmail: support@store.com\nWebsite: www.store.com\nFollow us @storename',
    includeLogo: true,
    includeBarcode: true,
    includeQrCode: true,
    customFields: [
      {
        id: 'field-3',
        label: 'Store Phone',
        type: 'text',
        value: '1-800-123-4567',
        position: 'footer',
      },
      {
        id: 'field-4',
        label: 'Website',
        type: 'text',
        value: 'www.store.com',
        position: 'footer',
      },
      {
        id: 'field-5',
        label: 'Order Number',
        type: 'custom',
        value: '',
        position: 'header',
      },
      {
        id: 'field-6',
        label: 'Return Policy',
        type: 'text',
        value: '30-day return policy with receipt',
        position: 'footer',
      },
    ],
    isActive: false,
  },
];

// Sample products for testing
export const sampleProducts = [
  {
    productId: 'prod-1',
    variantId: 'var-1',
    productName: 'Wireless Headphones',
    quantity: 1,
    price: 89.99,
    cost: 45.00,
    category: 'electronics',
  },
  {
    productId: 'prod-2',
    variantId: 'var-1',
    productName: 'Coffee Mug',
    quantity: 2,
    price: 12.99,
    cost: 6.50,
    category: 'kitchen',
  },
  {
    productId: 'prod-3',
    variantId: 'var-1',
    productName: 'T-Shirt',
    quantity: 1,
    price: 24.99,
    cost: 12.00,
    category: 'clothing',
  },
  {
    productId: 'prod-4',
    variantId: 'var-1',
    productName: 'Notebook Set',
    quantity: 3,
    price: 8.99,
    cost: 4.50,
    category: 'office',
  },
  {
    productId: 'prod-5',
    variantId: 'var-1',
    productName: 'Smart Watch',
    quantity: 1,
    price: 199.99,
    cost: 120.00,
    category: 'electronics',
  },
];

// Helper functions for testing
export const getRandomProduct = () => {
  return sampleProducts[Math.floor(Math.random() * sampleProducts.length)];
};

export const getRandomCoupon = () => {
  return sampleCoupons[Math.floor(Math.random() * sampleCoupons.length)];
};

export const getRandomPromotion = () => {
  return samplePromotions[Math.floor(Math.random() * samplePromotions.length)];
};
