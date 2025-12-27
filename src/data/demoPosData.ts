// Demo data for enhanced POS features
import type { DiscountCoupon, LoyaltyProgram, CustomerLoyalty, ReceiptTemplate } from '../types/pos';

export const demoCoupons: DiscountCoupon[] = [
  {
    id: '1',
    code: 'SAVE10',
    type: 'percentage',
    value: 10,
    minPurchaseAmount: 50,
    maxDiscountAmount: 25,
    usageLimit: 100,
    usedCount: 15,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    isActive: true
  },
  {
    id: '2',
    code: 'WELCOME20',
    type: 'percentage',
    value: 20,
    minPurchaseAmount: 25,
    usageLimit: 50,
    usedCount: 8,
    startDate: '2024-01-01',
    endDate: '2024-06-30',
    isActive: true
  },
  {
    id: '3',
    code: 'FLAT5',
    type: 'fixed',
    value: 5,
    minPurchaseAmount: 10,
    usageLimit: 200,
    usedCount: 45,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    isActive: true
  },
  {
    id: '4',
    code: 'BOGO',
    type: 'bogo',
    value: 50,
    minPurchaseAmount: 20,
    usageLimit: 30,
    usedCount: 5,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    isActive: true
  }
];

export const demoLoyaltyProgram: LoyaltyProgram = {
  id: '1',
  name: 'Rewards Plus',
  pointsPerDollar: 1,
  redemptionRate: 0.01, // 100 points = $1
  tiers: [
    {
      id: 'bronze',
      name: 'Bronze Member',
      minPoints: 0,
      benefits: ['1 point per dollar', 'Birthday rewards'],
      discountRate: 0
    },
    {
      id: 'silver',
      name: 'Silver Member',
      minPoints: 500,
      benefits: ['1.2 points per dollar', 'Birthday rewards', 'Early access to sales'],
      discountRate: 5
    },
    {
      id: 'gold',
      name: 'Gold Member',
      minPoints: 1500,
      benefits: ['1.5 points per dollar', 'Birthday rewards', 'Early access to sales', 'Free shipping'],
      discountRate: 10
    },
    {
      id: 'platinum',
      name: 'Platinum Member',
      minPoints: 3000,
      benefits: ['2 points per dollar', 'Birthday rewards', 'Early access to sales', 'Free shipping', 'Exclusive events'],
      discountRate: 15
    }
  ],
  rewards: [
    {
      id: '1',
      name: '$5 Off',
      pointsCost: 500,
      type: 'discount',
      value: 5,
      description: '$5 discount on your next purchase'
    },
    {
      id: '2',
      name: '$10 Off',
      pointsCost: 900,
      type: 'discount',
      value: 10,
      description: '$10 discount on your next purchase'
    },
    {
      id: '3',
      name: 'Free Coffee',
      pointsCost: 200,
      type: 'free_product',
      value: 0,
      description: 'Free coffee with any purchase'
    },
    {
      id: '4',
      name: 'Free Shipping',
      pointsCost: 300,
      type: 'discount',
      value: 5,
      description: 'Free shipping on your next order'
    }
  ]
};

export const demoCustomerLoyalty: CustomerLoyalty = {
  customerId: '1',
  programId: '1',
  currentPoints: 750,
  tierId: 'silver',
  totalEarned: 1200,
  totalRedeemed: 450,
  joinDate: '2024-01-15',
  lastActivity: '2024-03-10'
};

export const demoReceiptTemplates: ReceiptTemplate[] = [
  {
    id: '1',
    name: 'Standard Receipt',
    header: 'Thank you for shopping with us!',
    footer: 'Please come again soon!\nVisit our website for more deals.',
    includeLogo: true,
    includeBarcode: true,
    includeQrCode: false,
    customFields: [
      {
        id: '1',
        label: 'Cashier',
        type: 'text',
        value: 'Employee Name',
        position: 'footer'
      },
      {
        id: '2',
        label: 'Store Location',
        type: 'text',
        value: 'Main Street',
        position: 'footer'
      }
    ],
    isActive: true
  },
  {
    id: '2',
    name: 'Detailed Receipt',
    header: '=== DETAILED RECEIPT ===\nCustomer Copy\nThank you for your business!',
    footer: '=== TERMS & CONDITIONS ===\nAll sales are final\nReturn policy: 30 days with receipt\nFor questions, call 1-800-SHOP-HERE',
    includeLogo: true,
    includeBarcode: true,
    includeQrCode: true,
    customFields: [
      {
        id: '3',
        label: 'Order Number',
        type: 'text',
        value: 'ORD-',
        position: 'header'
      },
      {
        id: '4',
        label: 'Transaction Time',
        type: 'date',
        value: 'full',
        position: 'body'
      },
      {
        id: '5',
        label: 'Tax ID',
        type: 'text',
        value: 'TAX-12345',
        position: 'footer'
      },
      {
        id: '6',
        label: 'Customer Service',
        type: 'text',
        value: 'support@store.com',
        position: 'footer'
      }
    ],
    isActive: true
  },
  {
    id: '3',
    name: 'Minimal Receipt',
    header: 'Thanks!',
    footer: 'See you again!',
    includeLogo: false,
    includeBarcode: false,
    includeQrCode: false,
    customFields: [],
    isActive: false
  }
];
