// Advanced Inventory Management Types

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  tax_id?: string;
  payment_terms?: string;
  lead_time_days?: number;
  min_order_amount?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  tenant_id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  location_type?: 'warehouse' | 'store' | 'storage';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductBatch {
  id: string;
  tenant_id: string;
  product_id: string;
  location_id: string;
  batch_number: string;
  supplier_id?: string;
  quantity: number;
  quantity_reserved: number;
  quantity_available: number;
  unit_cost: number;
  manufacture_date?: string;
  expiration_date?: string;
  received_date: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  product_name?: string;
  location_name?: string;
  supplier_name?: string;
  days_until_expiration?: number;
  is_expiring?: boolean;
  is_expired?: boolean;
}

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  supplier_id: string;
  location_id?: string;
  order_number: string;
  status: 'draft' | 'sent' | 'confirmed' | 'partial' | 'received' | 'cancelled';
  order_date: string;
  expected_date?: string;
  received_date?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_terms?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  supplier_name?: string;
  location_name?: string;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
  batch_number?: string;
  manufacture_date?: string;
  expiration_date?: string;
  notes?: string;
  created_at: string;
  // Joined fields
  product_name?: string;
  product_sku?: string;
  remaining_quantity: number;
  received_percentage: number;
}

export interface StockTransfer {
  id: string;
  tenant_id: string;
  transfer_number: string;
  from_location_id: string;
  to_location_id: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  transfer_date: string;
  completed_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  from_location_name?: string;
  to_location_name?: string;
  items?: StockTransferItem[];
}

export interface StockTransferItem {
  id: string;
  stock_transfer_id: string;
  product_id: string;
  batch_id?: string;
  quantity: number;
  notes?: string;
  created_at: string;
  // Joined fields
  product_name?: string;
  product_sku?: string;
  batch_number?: string;
  from_location_name?: string;
  to_location_name?: string;
}

export interface ReorderPoint {
  id: string;
  tenant_id: string;
  product_id: string;
  location_id: string;
  min_stock_level: number;
  max_stock_level: number;
  reorder_point: number;
  reorder_quantity: number;
  lead_time_days: number;
  safety_stock: number;
  is_active: boolean;
  last_calculated: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  product_name?: string;
  product_sku?: string;
  location_name?: string;
  current_stock?: number;
  stock_status?: 'overstock' | 'optimal' | 'low_stock' | 'out_of_stock';
  days_of_stock?: number;
}

export interface ReorderAlert {
  product_id: string;
  location_id: string;
  current_stock: number;
  reorder_point: number;
  suggested_order_quantity: number;
  product_name?: string;
  product_sku?: string;
  location_name?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExpirationAlert {
  product_id: string;
  product_name: string;
  batch_number: string;
  location_name: string;
  expiration_date: string;
  days_until_expiration: number;
  quantity_available: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface BatchReservation {
  id: string;
  batch_id: string;
  quantity: number;
  reserved_for_type: 'sale' | 'transfer' | 'production';
  reserved_for_id: string;
  reserved_date: string;
  expires_date?: string;
  notes?: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: 'sale' | 'purchase' | 'adjustment' | 'return' | 'transfer_in' | 'transfer_out';
  quantity: number;
  reference_id?: string;
  batch_id?: string;
  location_id?: string;
  transfer_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  // Joined fields
  product_name?: string;
  batch_number?: string;
  location_name?: string;
  reference_type?: string;
  reference_number?: string;
}

export interface InventorySummary {
  total_products: number;
  total_value: number;
  low_stock_items: number;
  out_of_stock_items: number;
  expiring_items: number;
  expired_items: number;
  pending_transfers: number;
  pending_purchase_orders: number;
}

export interface InventoryAnalytics {
  product_id: string;
  product_name: string;
  location_id: string;
  location_name: string;
  current_stock: number;
  stock_value: number;
  cost_of_goods_sold: number;
  days_of_supply: number;
  turnover_rate: number;
  last_sold_date?: string;
  last_received_date?: string;
  reorder_frequency: number;
  stock_status: 'overstock' | 'optimal' | 'low_stock' | 'out_of_stock';
}

export interface BatchTrackingSettings {
  track_batches: boolean;
  track_expiration: boolean;
  default_location_id?: string;
  auto_reserve_stock: boolean;
  allow_partial_shipments: boolean;
  enforce_fifo: boolean;
  expiration_warning_days: number;
}

export interface PurchaseOrderSettings {
  auto_generate_numbers: boolean;
  require_approval: boolean;
  approval_threshold: number;
  default_payment_terms: string;
  auto_receive_items: boolean;
  track_by_batch: boolean;
}

export interface StockTransferSettings {
  auto_generate_numbers: boolean;
  require_approval: boolean;
  allow_partial_transfers: boolean;
  track_by_batch: boolean;
  enforce_location_validation: boolean;
}

export interface ReorderSettings {
  auto_calculate: boolean;
  calculation_method: 'fixed' | 'historical' | 'forecast';
  safety_stock_method: 'fixed' | 'percentage' | 'statistical';
  lead_time_variance: number;
  demand_variance: number;
  service_level: number;
}

// Form types for creating/updating
export interface CreateSupplierForm {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  tax_id?: string;
  payment_terms?: string;
  lead_time_days?: number;
  min_order_amount?: number;
}

export interface CreateLocationForm {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  location_type?: 'warehouse' | 'store' | 'storage';
}

export interface CreatePurchaseOrderForm {
  supplier_id: string;
  location_id?: string;
  expected_date?: string;
  payment_terms?: string;
  notes?: string;
  items: Omit<PurchaseOrderItem, 'id' | 'purchase_order_id' | 'created_at'>[];
}

export interface CreateStockTransferForm {
  from_location_id: string;
  to_location_id: string;
  notes?: string;
  items: Omit<StockTransferItem, 'id' | 'stock_transfer_id' | 'created_at'>[];
}

export interface CreateBatchForm {
  product_id: string;
  location_id: string;
  batch_number: string;
  supplier_id?: string;
  quantity: number;
  unit_cost: number;
  manufacture_date?: string;
  expiration_date?: string;
  notes?: string;
}

export interface UpdateReorderPointForm {
  min_stock_level: number;
  max_stock_level: number;
  reorder_point: number;
  reorder_quantity: number;
  lead_time_days: number;
  safety_stock: number;
  is_active: boolean;
}

// Filter and search types
export interface InventoryFilters {
  location_id?: string;
  supplier_id?: string;
  category?: string;
  low_stock_only?: boolean;
  expiring_only?: boolean;
  batch_tracked_only?: boolean;
  date_range?: {
    start: string;
    end: string;
  };
}

export interface PurchaseOrderFilters {
  supplier_id?: string;
  location_id?: string;
  status?: PurchaseOrder['status'];
  date_range?: {
    start: string;
    end: string;
  };
}

export interface StockTransferFilters {
  from_location_id?: string;
  to_location_id?: string;
  status?: StockTransfer['status'];
  date_range?: {
    start: string;
    end: string;
  };
}

// Report types
export interface InventoryValuationReport {
  location_id: string;
  location_name: string;
  total_value: number;
  total_quantity: number;
  categories: {
    category: string;
    value: number;
    quantity: number;
    percentage: number;
  }[];
  expiring_value: number;
  expired_value: number;
}

export interface SupplierPerformanceReport {
  supplier_id: string;
  supplier_name: string;
  total_orders: number;
  total_value: number;
  on_time_delivery_rate: number;
  quality_score: number;
  average_lead_time: number;
  last_order_date: string;
}

export interface StockMovementReport {
  product_id: string;
  product_name: string;
  location_id: string;
  location_name: string;
  movements: {
    date: string;
    type: string;
    quantity: number;
    reference: string;
  }[];
  net_change: number;
  opening_balance: number;
  closing_balance: number;
}
