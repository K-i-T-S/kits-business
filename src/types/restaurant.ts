export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export type TableSection = 'indoor' | 'terrace' | 'bar';
export type OrderStatus = 'open' | 'sent' | 'served' | 'paid' | 'cancelled';
export type CourseType = 'appetizers' | 'mains' | 'desserts';
export type ItemStatus = 'pending' | 'in_progress' | 'ready' | 'served';
export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'cancelled';

export interface RestaurantTable {
  id: string;
  tenant_id: string;
  number: number;
  name: string | null;
  section: TableSection;
  seats: number;
  x: number;
  y: number;
  status: TableStatus;
}

export interface TableOrder {
  id: string;
  tenant_id: string;
  table_id: string | null;
  status: OrderStatus;
  current_course: CourseType;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface OrderItemModifier {
  name: string;
  price_delta: number;
}

export interface RestaurantOrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  menu_item_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  modifiers: OrderItemModifier[];
  course: CourseType;
  status: ItemStatus;
  notes: string | null;
  sent_at: string | null;
  ready_at: string | null;
}

export interface Reservation {
  id: string;
  tenant_id: string;
  table_id: string | null;
  guest_name: string;
  guest_phone: string;
  party_size: number;
  reserved_at: string;
  notes: string | null;
  status: ReservationStatus;
  created_at: string;
}

export interface TableOrderWithItems extends TableOrder {
  items: RestaurantOrderItem[];
}

export const STATUS_COLORS: Record<TableStatus, { bg: string; border: string; text: string; dot: string }> = {
  available: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/50', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  occupied: { bg: 'bg-red-500/15', border: 'border-red-500/50', text: 'text-red-400', dot: 'bg-red-500' },
  reserved: { bg: 'bg-amber-500/15', border: 'border-amber-500/50', text: 'text-amber-400', dot: 'bg-amber-500' },
  cleaning: { bg: 'bg-slate-500/15', border: 'border-slate-500/30', text: 'text-slate-400', dot: 'bg-slate-500' },
};

export const COURSE_LABELS: Record<CourseType, string> = {
  appetizers: 'Appetizers',
  mains: 'Mains',
  desserts: 'Desserts',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  no_show: 'No Show',
  cancelled: 'Cancelled',
};

// ── Recipe & Ingredient System ────────────────────────────────

export interface RestaurantIngredient {
  id: string;
  tenant_id: string;
  supplier_id: string | null;
  name: string;
  name_ar: string | null;
  category: string;
  unit: string;
  cost_per_unit: number;
  current_stock: number;
  reorder_level: number;
  par_level: number;
  shelf_life_days: number | null;
  storage_location: string | null;
  is_active: boolean;
  last_restocked_at: string | null;
  created_at?: string;
}

export interface RestaurantRecipe {
  id: string;
  tenant_id: string;
  name: string;
  yield_quantity: number;
  yield_unit: string;
  notes: string | null;
  created_at?: string;
  ingredients?: RecipeIngredientLine[];
  total_cost?: number;
}

export interface RecipeIngredientLine {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  ingredient?: RestaurantIngredient;
  quantity: number;
  unit: string;
  waste_factor: number;
  line_cost?: number;
}

export interface IngredientSupplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface WasteLogEntry {
  id: string;
  tenant_id: string;
  ingredient_id: string;
  ingredient?: RestaurantIngredient;
  quantity: number;
  unit: string;
  reason: string | null;
  cost_value: number | null;
  logged_at: string;
}

export interface IngredientMovement {
  id: string;
  tenant_id: string;
  ingredient_id: string;
  movement_type: 'receive' | 'deduct' | 'waste' | 'adjustment' | 'transfer';
  quantity: number;
  unit_cost: number | null;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface MenuItemRecipe {
  menu_item_id: string;
  recipe_id: string;
  tenant_id: string;
}

/** Stock status derived from current_stock vs thresholds */
export type IngredientStockStatus = 'good' | 'low' | 'critical';

export function getIngredientStockStatus(ingredient: RestaurantIngredient): IngredientStockStatus {
  if (ingredient.current_stock <= ingredient.reorder_level) return 'critical';
  if (ingredient.current_stock <= ingredient.par_level) return 'low';
  return 'good';
}

/** Common ingredient categories for Lebanese/MENA restaurants */
export const INGREDIENT_CATEGORIES = [
  'meat',
  'poultry',
  'seafood',
  'dairy',
  'produce',
  'herbs',
  'spices',
  'grains',
  'legumes',
  'oils',
  'sauces',
  'beverages',
  'dry_goods',
  'frozen',
  'packaging',
  'general',
] as const;

export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

export const INGREDIENT_CATEGORY_LABELS: Record<string, string> = {
  meat: 'Meat',
  poultry: 'Poultry',
  seafood: 'Seafood',
  dairy: 'Dairy',
  produce: 'Produce & Vegetables',
  herbs: 'Fresh Herbs',
  spices: 'Spices & Seasoning',
  grains: 'Grains & Flour',
  legumes: 'Legumes',
  oils: 'Oils & Fats',
  sauces: 'Sauces & Condiments',
  beverages: 'Beverages',
  dry_goods: 'Dry Goods',
  frozen: 'Frozen',
  packaging: 'Packaging',
  general: 'General',
};

/** Suggested waste factors for common restaurant ingredients */
export const SUGGESTED_WASTE_FACTORS: Record<string, { factor: number; label: string }> = {
  fish: { factor: 1.35, label: 'Fish (35% butcher waste)' },
  shellfish: { factor: 1.50, label: 'Shellfish (50% shell waste)' },
  beef_bone_in: { factor: 1.25, label: 'Bone-in beef (25% bone)' },
  chicken_whole: { factor: 1.30, label: 'Whole chicken (30% bones/skin)' },
  leafy_greens: { factor: 1.20, label: 'Leafy greens (20% trim)' },
  onions: { factor: 1.10, label: 'Onions (10% skin)' },
  tomatoes: { factor: 1.05, label: 'Tomatoes (5% core)' },
  citrus: { factor: 1.40, label: 'Citrus for juice (40% peel/pith)' },
  no_waste: { factor: 1.00, label: 'No waste (liquids, pre-portioned)' },
};
// ── Restaurant Menu System ──────────────────────────────────────────────────

export interface RestaurantMenuCategory {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  icon: string;
  sort_order: number;
  active_breakfast: boolean;
  active_lunch: boolean;
  active_dinner: boolean;
  active_allday: boolean;
}

export interface RestaurantMenuItem {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  photo_url: string | null;
  base_price_usd: number;
  base_price_lbp: number | null;
  cost_price_usd: number | null;
  calories: number | null;
  allergens: string[];
  is_featured: boolean;
  is_chef_pick: boolean;
  is_eighty_sixd: boolean;
  active_breakfast: boolean;
  active_lunch: boolean;
  active_dinner: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface RestaurantModifierGroup {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  min_selections: number;
  max_selections: number;
  is_required: boolean;
}

export interface RestaurantModifier {
  id: string;
  group_id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  price_delta: number;
  sort_order: number;
}

export interface QRMenuTenant {
  id: string;
  name: string;
  brand_logo_url: string | null;
  brand_primary: string | null;
  qr_menu_palette: string;
  qr_menu_promotional_banner: string | null;
}

export interface QRMenuData {
  tenant: QRMenuTenant;
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  modifier_groups: RestaurantModifierGroup[];
  modifiers: RestaurantModifier[];
  item_modifier_links: Array<{ menu_item_id: string; modifier_group_id: string }>;
}

export interface QRCartItem {
  menuItemId: string;
  menuItem: RestaurantMenuItem;
  quantity: number;
  selectedModifiers: Record<string, string[]>;
  totalPrice: number;
  notes: string;
}
// ── Order Flow Engine ─────────────────────────────────────────────────────────

export type OrderFlow = 'direct' | 'waiter_confirm';
export type PaymentMode = 'customer_can_pay' | 'waiter_only';
export type SplitType = 'by_seat' | 'by_item' | 'equal';

export interface RestaurantSettings {
  id: string;
  tenant_id: string;
  default_order_flow: OrderFlow;
  default_payment_mode: PaymentMode;
  service_charge_enabled: boolean;
  service_charge_pct: number;
  vat_enabled: boolean;
  vat_pct: number;
  tip_pool_enabled: boolean;
  slow_service_threshold_minutes: number;
}

export interface PendingOrderItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  modifiers: Array<{ name: string; price_delta: number }>;
  notes: string;
  course: CourseType;
}

export interface PendingOrder {
  id: string;
  tenant_id: string;
  table_id: string;
  table_order_id: string | null;
  items: PendingOrderItem[];
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
  confirmed_at: string | null;
}

export interface BillSplitPart {
  label: string;
  items: string[];
  subtotal: number;
  tax: number;
  service_charge: number;
  total: number;
}

export interface BillSplit {
  id: string;
  order_id: string;
  split_type: SplitType;
  split_count: number;
  splits: BillSplitPart[];
}

/** Extended TableOrder with order flow columns from migration 000035 */
export interface TableOrderExtended extends TableOrder {
  order_flow: OrderFlow;
  payment_mode: PaymentMode;
  service_charge_pct: number;
  vat_pct: number;
  tip_amount_usd: number;
  discount_pct: number;
  paid_at: string | null;
  payment_method: string | null;
  waiter_id: string | null;
}
export interface KDSStation {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export interface KDSItemStation {
  tenant_id: string;
  station_id: string;
  item_identifier: string;
  identifier_type: 'category' | 'item';
}

// ── Argile ───────────────────────────────────────────────────
export type ArgileEventType = 'fa7em_request' | 'coal_delivered' | 'tobacco_refill' | 'session_closed';

export interface ArgileSession {
  id: string;
  tenant_id: string;
  table_id: string;
  table_order_id: string | null;
  tobacco_brand: string | null;
  tobacco_flavor: string | null;
  tobacco_flavor_ar: string | null;
  coal_type: 'natural' | 'quick_light';
  head_size: 'regular' | 'jumbo';
  status: 'active' | 'closed';
  opened_at: string;
  closed_at: string | null;
  tobacco_refill_count: number;
  coal_delivery_count: number;
  base_price_usd: number;
  refill_price_usd: number;
}

export interface ArgileEvent {
  id: string;
  tenant_id: string;
  session_id: string;
  table_id: string;
  event_type: ArgileEventType;
  notes: string | null;
  handled_by: string | null;
  created_at: string;
  handled_at: string | null;
}

export interface ArgileFlavor {
  id: string;
  tenant_id: string;
  brand: string;
  flavor: string;
  flavor_ar: string | null;
  base_price_usd: number;
  refill_price_usd: number;
  ingredient_id: string | null;
  is_active: boolean;
  sort_order: number;
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export type ShiftType = 'morning' | 'evening' | 'night' | 'split' | 'full';
export type StaffRole = 'waiter' | 'chef' | 'sous_chef' | 'cashier' | 'busboy' | 'argile' | 'manager' | 'host';

export interface RestaurantShift {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  shift_date: string;
  shift_type: ShiftType;
  start_time: string;
  end_time: string;
  is_closed: boolean;
  opened_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ShiftAssignment {
  id: string;
  tenant_id: string;
  shift_id: string;
  employee_id: string;
  role: StaffRole;
  section: string | null;
  station: string | null;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
}

// ── Slow Service Alerts ────────────────────────────────────────────────────────

export type SlowAlertType =
  | 'no_order_placed'
  | 'order_not_served'
  | 'table_not_cleared'
  | 'payment_waiting'
  | 'argile_not_serviced';

export interface SlowAlert {
  id: string;
  tenant_id: string;
  table_id: string;
  alert_type: SlowAlertType;
  threshold_minutes: number;
  elapsed_minutes: number;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ── Customer Feedback ─────────────────────────────────────────────────────────

export interface TableFeedback {
  id: string;
  tenant_id: string;
  table_id: string;
  table_order_id: string | null;
  overall_rating: number | null;
  food_rating: number | null;
  service_rating: number | null;
  comment: string | null;
  submitted_at: string;
}

// ── Waiter Performance ────────────────────────────────────────────────────────

export interface WaiterPerformanceStats {
  employee_id: string;
  employee_name: string;
  tables_served: number;
  total_revenue: number;
  avg_ticket: number;
  avg_rating: number;
  avg_service_minutes: number;
  period_score: number;
}

// ── Multi-Branch ──────────────────────────────────────────────────────────────

export interface RestaurantBranch {
  id: string;
  tenant_id: string;
  name: string;
  name_ar: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  manager_employee_id: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface BranchMetrics {
  branch_id: string;
  metric_date: string;
  total_revenue_usd: number;
  total_orders: number;
  total_covers: number;
  avg_ticket_usd: number;
  food_cost_pct: number | null;
  table_turnover_rate: number | null;
  avg_service_minutes: number | null;
  argile_revenue_usd: number;
  delivery_revenue_usd: number;
  customer_rating_avg: number | null;
}
