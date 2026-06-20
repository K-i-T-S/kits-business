export const INDUSTRIES = [
  'restaurant',
  'pharmacy',
  'supermarket',
  'fashion',
  'electronics',
  'mobile',
  'retail',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export type VerticalFeature =
  | 'table_management'
  | 'kds'
  | 'reservations'
  | 'menu_management'
  | 'delivery_integration'
  | 'drug_database'
  | 'prescriptions'
  | 'narcotics_register'
  | 'expiry_tracking'
  | 'insurance_copay'
  | 'department_management'
  | 'weight_items'
  | 'fifo_fefo'
  | 'shelf_life'
  | 'size_color_matrix'
  | 'layaway'
  | 'alteration_tickets'
  | 'serial_numbers'
  | 'warranty_management'
  | 'repair_orders'
  | 'imei_tracking'
  | 'carrier_management';

export const INDUSTRY_VERTICAL_FEATURES: Record<Industry, VerticalFeature[]> = {
  restaurant: ['table_management', 'kds', 'reservations', 'menu_management', 'delivery_integration'],
  pharmacy: ['drug_database', 'prescriptions', 'narcotics_register', 'expiry_tracking', 'insurance_copay'],
  supermarket: ['department_management', 'weight_items', 'fifo_fefo', 'shelf_life', 'expiry_tracking'],
  fashion: ['size_color_matrix', 'layaway', 'alteration_tickets'],
  electronics: ['serial_numbers', 'warranty_management', 'repair_orders'],
  mobile: ['imei_tracking', 'carrier_management', 'serial_numbers', 'warranty_management', 'repair_orders', 'layaway'],
  retail: [],
};

export interface IndustryConfig {
  key: Industry;
  labelKey: string;
  labelFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  emoji: string;
  gradient: string;
  borderColor: string;
}

export const INDUSTRY_CONFIGS: IndustryConfig[] = [
  {
    key: 'restaurant',
    labelKey: 'industry.restaurant',
    labelFallback: 'Restaurant / F&B',
    descriptionKey: 'industry.restaurantDesc',
    descriptionFallback: 'Tables, KDS, menus, delivery integration',
    emoji: '🍽️',
    gradient: 'from-orange-500/20 to-red-500/20',
    borderColor: 'border-orange-500/40',
  },
  {
    key: 'pharmacy',
    labelKey: 'industry.pharmacy',
    labelFallback: 'Pharmacy',
    descriptionKey: 'industry.pharmacyDesc',
    descriptionFallback: 'Drug database, prescriptions, FEFO tracking',
    emoji: '💊',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    borderColor: 'border-emerald-500/40',
  },
  {
    key: 'supermarket',
    labelKey: 'industry.supermarket',
    labelFallback: 'Supermarket / Grocery',
    descriptionKey: 'industry.supermarketDesc',
    descriptionFallback: 'Departments, FIFO, weight items, shelf-life',
    emoji: '🛒',
    gradient: 'from-green-500/20 to-lime-500/20',
    borderColor: 'border-green-500/40',
  },
  {
    key: 'fashion',
    labelKey: 'industry.fashion',
    labelFallback: 'Clothing & Fashion',
    descriptionKey: 'industry.fashionDesc',
    descriptionFallback: 'Size-colour matrix, seasons, markdowns',
    emoji: '👗',
    gradient: 'from-pink-500/20 to-purple-500/20',
    borderColor: 'border-pink-500/40',
  },
  {
    key: 'electronics',
    labelKey: 'industry.electronics',
    labelFallback: 'Electronics',
    descriptionKey: 'industry.electronicsDesc',
    descriptionFallback: 'Serial numbers, warranty, repair orders',
    emoji: '💻',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'border-blue-500/40',
  },
  {
    key: 'mobile',
    labelKey: 'industry.mobile',
    labelFallback: 'Phone Shop / Mobile',
    descriptionKey: 'industry.mobileDesc',
    descriptionFallback: 'IMEI tracking, carrier plans, SIM cards',
    emoji: '📱',
    gradient: 'from-violet-500/20 to-indigo-500/20',
    borderColor: 'border-violet-500/40',
  },
  {
    key: 'retail',
    labelKey: 'industry.retail',
    labelFallback: 'General Retail',
    descriptionKey: 'industry.retailDesc',
    descriptionFallback: 'Full platform, no vertical-specific features',
    emoji: '🏪',
    gradient: 'from-slate-500/20 to-gray-500/20',
    borderColor: 'border-slate-500/40',
  },
];

export const INDUSTRY_LABEL: Record<Industry, string> = {
  restaurant: 'Restaurant / F&B',
  pharmacy: 'Pharmacy',
  supermarket: 'Supermarket / Grocery',
  fashion: 'Clothing & Fashion',
  electronics: 'Electronics',
  mobile: 'Phone Shop / Mobile',
  retail: 'General Retail',
};
