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
