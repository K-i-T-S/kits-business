export type SupermarketDepartment = {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  emoji: string;
  color: string;
  shrinkage_target: number;
  created_at: string;
};

export type GroceryLot = {
  id: string;
  tenant_id: string;
  product_id: string;
  department_id: string | null;
  lot_number: string;
  expiry_date: string;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost_usd: number;
  received_at: string;
  created_at: string;
  product_name?: string;
  department_name?: string;
};

export type PluCode = {
  id: string;
  tenant_id: string;
  plu_code: string;
  product_id: string | null;
  name: string;
  price_per_kg: number;
  department_id: string | null;
  active: boolean;
  created_at: string;
};

export type BulkPricingRule = {
  id: string;
  tenant_id: string;
  product_id: string;
  rule_type: 'qty_break' | 'bogo' | 'case_price';
  min_quantity: number;
  discount_percent: number | null;
  fixed_price_usd: number | null;
  free_qty: number | null;
  active: boolean;
  created_at: string;
  product_name?: string;
};

export type WasteReason = 'expired' | 'damaged' | 'shrinkage' | 'recall' | 'other';

export type WasteRecord = {
  id: string;
  tenant_id: string;
  product_id: string;
  lot_id: string | null;
  department_id: string | null;
  quantity: number;
  reason: WasteReason;
  cost_usd: number;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
  product_name?: string;
  department_name?: string;
};

export type TillReconciliation = {
  id: string;
  tenant_id: string;
  till_name: string;
  cashier_name: string;
  date: string;
  lbp_100k_count: number;
  lbp_50k_count: number;
  lbp_20k_count: number;
  lbp_10k_count: number;
  lbp_5k_count: number;
  lbp_1k_count: number;
  usd_100_count: number;
  usd_50_count: number;
  usd_20_count: number;
  usd_10_count: number;
  usd_5_count: number;
  usd_1_count: number;
  whish_amount_usd: number;
  card_amount_usd: number;
  expected_cash_usd: number;
  expected_cash_lbp: number;
  safe_drop_usd: number;
  notes: string | null;
  status: 'pending' | 'approved' | 'flagged';
  created_at: string;
};

export type DepartmentStats = {
  dept: SupermarketDepartment;
  product_count: number;
  total_stock_value: number;
  lot_count: number;
  expiring_soon: number;
  waste_cost_month: number;
};

export const GROCERY_DEPARTMENT_DEFAULTS = [
  { code: 'PRODUCE', name: 'Produce', emoji: '🥬', color: '#22c55e', shrinkage_target: 5.0 },
  { code: 'DAIRY', name: 'Dairy', emoji: '🥛', color: '#60a5fa', shrinkage_target: 2.0 },
  { code: 'MEAT', name: 'Meat', emoji: '🥩', color: '#ef4444', shrinkage_target: 3.0 },
  { code: 'BAKERY', name: 'Bakery', emoji: '🍞', color: '#f59e0b', shrinkage_target: 4.0 },
  { code: 'DRY_GOODS', name: 'Dry Goods', emoji: '🌾', color: '#d97706', shrinkage_target: 1.0 },
  { code: 'FROZEN', name: 'Frozen', emoji: '❄️', color: '#06b6d4', shrinkage_target: 1.5 },
  { code: 'BEVERAGES', name: 'Beverages', emoji: '🧃', color: '#8b5cf6', shrinkage_target: 1.0 },
  { code: 'HBC', name: 'Health & Beauty', emoji: '🧴', color: '#ec4899', shrinkage_target: 0.5 },
] as const;

export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  expired: 'Expired',
  damaged: 'Damaged',
  shrinkage: 'Shrinkage / Theft',
  recall: 'Product Recall',
  other: 'Other',
};

export const WASTE_REASON_COLORS: Record<WasteReason, string> = {
  expired: 'text-red-400 bg-red-500/10 border-red-500/20',
  damaged: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  shrinkage: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  recall: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  other: 'text-white/50 bg-white/5 border-white/10',
};

export const LBP_DENOMINATIONS = [
  { key: 'lbp_100k_count' as const, label: '100,000 LL', value: 100000 },
  { key: 'lbp_50k_count' as const, label: '50,000 LL', value: 50000 },
  { key: 'lbp_20k_count' as const, label: '20,000 LL', value: 20000 },
  { key: 'lbp_10k_count' as const, label: '10,000 LL', value: 10000 },
  { key: 'lbp_5k_count' as const, label: '5,000 LL', value: 5000 },
  { key: 'lbp_1k_count' as const, label: '1,000 LL', value: 1000 },
];

export const USD_DENOMINATIONS = [
  { key: 'usd_100_count' as const, label: '$100', value: 100 },
  { key: 'usd_50_count' as const, label: '$50', value: 50 },
  { key: 'usd_20_count' as const, label: '$20', value: 20 },
  { key: 'usd_10_count' as const, label: '$10', value: 10 },
  { key: 'usd_5_count' as const, label: '$5', value: 5 },
  { key: 'usd_1_count' as const, label: '$1', value: 1 },
];

export function computeTillTotals(rec: TillReconciliation, lbpRate: number) {
  const totalLbp =
    rec.lbp_100k_count * 100000 +
    rec.lbp_50k_count * 50000 +
    rec.lbp_20k_count * 20000 +
    rec.lbp_10k_count * 10000 +
    rec.lbp_5k_count * 5000 +
    rec.lbp_1k_count * 1000;

  const totalUsdCash =
    rec.usd_100_count * 100 +
    rec.usd_50_count * 50 +
    rec.usd_20_count * 20 +
    rec.usd_10_count * 10 +
    rec.usd_5_count * 5 +
    rec.usd_1_count * 1;

  const totalLbpInUsd = totalLbp / lbpRate;
  const totalUsd = totalUsdCash + totalLbpInUsd + rec.whish_amount_usd + rec.card_amount_usd - rec.safe_drop_usd;
  const expectedUsd = rec.expected_cash_usd + rec.expected_cash_lbp / lbpRate;
  const variance = totalUsd - expectedUsd;

  return { totalLbp, totalUsdCash, totalLbpInUsd, totalUsd, expectedUsd, variance };
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(daysLeft: number): 'expired' | 'critical' | 'warning' | 'ok' {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 3) return 'critical';
  if (daysLeft <= 7) return 'warning';
  return 'ok';
}

export const EXPIRY_STATUS_CONFIG = {
  expired: { label: 'Expired', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', markdownPct: 100 },
  critical: { label: '1–3 days', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', markdownPct: 50 },
  warning: { label: '4–7 days', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', markdownPct: 30 },
  ok: { label: 'Good', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', markdownPct: 0 },
} as const;
