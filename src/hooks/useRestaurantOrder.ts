/**
 * useRestaurantOrder
 * Central hook for managing a single table's order lifecycle.
 * Provides: addItem, fireCourse, closeBill, splitBill, confirmPendingOrder
 */
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import { useApp } from '@/context/AppContext';
import type {
  RestaurantOrderItem,
  TableOrderExtended,
  CourseType,
  PendingOrder,
  PendingOrderItem,
  SplitType,
  BillSplitPart,
} from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

interface AddItemParams {
  product_name: string;
  quantity: number;
  unit_price: number;
  course: CourseType;
  notes?: string;
  modifiers?: Array<{ name: string; price_delta: number }>;
  menu_item_id?: string;
}

interface BillTotals {
  subtotal: number;
  service_charge: number;
  vat: number;
  tip: number;
  discount: number;
  total: number;
}

interface UseRestaurantOrderReturn {
  order: TableOrderExtended | null;
  items: RestaurantOrderItem[];
  pendingOrders: PendingOrder[];
  loading: boolean;
  totals: BillTotals;
  addItem: (params: AddItemParams) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  fireCourse: (course: CourseType) => Promise<void>;
  sendToKitchen: () => Promise<void>;
  updateTip: (tipUsd: number) => Promise<void>;
  updateDiscount: (pct: number) => Promise<void>;
  closeBill: (paymentMethod: string) => Promise<void>;
  confirmPendingOrder: (pendingOrderId: string, items: PendingOrderItem[]) => Promise<void>;
  rejectPendingOrder: (pendingOrderId: string) => Promise<void>;
  splitEqual: (count: number) => BillSplitPart[];
  splitBySeat: (seatCount: number) => BillSplitPart[];
  splitByItem: (assignments: Record<string, string[]>) => BillSplitPart[];
  saveBillSplit: (splitType: SplitType, splits: BillSplitPart[]) => Promise<void>;
  refreshPendingOrders: () => Promise<void>;
}

export function useRestaurantOrder(
  tableId: string | null,
  orderId: string | null,
): UseRestaurantOrderReturn {
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [order, setOrder] = useState<TableOrderExtended | null>(null);
  const [items, setItems] = useState<RestaurantOrderItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Load order + items ───────────────────────────────────────────────────
  const loadOrder = useCallback(async () => {
    if (!orderId || !tenantId) return;
    setLoading(true);
    try {
      const [orderRes, itemsRes] = await Promise.all([
        supabase
          .from('table_orders')
          .select('*')
          .eq('id', orderId)
          .eq('tenant_id', tenantId)
          .single(),
        supabase
          .from('restaurant_order_items')
          .select('*')
          .eq('order_id', orderId)
          .eq('tenant_id', tenantId)
          .order('id'),
      ]);
      if (orderRes.data) setOrder(orderRes.data as TableOrderExtended);
      if (itemsRes.data) setItems(itemsRes.data as RestaurantOrderItem[]);
    } catch (err) {
      console.error('[useRestaurantOrder] loadOrder error:', err);
    } finally {
      setLoading(false);
    }
  }, [orderId, tenantId]);

  // ── Load pending orders for this table ───────────────────────────────────
  const refreshPendingOrders = useCallback(async () => {
    if (!tableId || !tenantId) return;
    try {
      const { data } = await supabase
        .from('restaurant_pending_orders')
        .select('*')
        .eq('table_id', tableId)
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at');
      if (data) setPendingOrders(data as PendingOrder[]);
    } catch (err) {
      console.error('[useRestaurantOrder] refreshPendingOrders error:', err);
    }
  }, [tableId, tenantId]);

  useEffect(() => {
    void loadOrder();
    void refreshPendingOrders();
  }, [loadOrder, refreshPendingOrders]);

  // ── Realtime: reload order items on any change to this order's items ────────
  useEffect(() => {
    if (!orderId || !tenantId) return;

    const channel = supabase
      .channel(`order-items-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_order_items',
          filter: `order_id=eq.${orderId}`,
        },
        () => { void loadOrder(); },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [orderId, tenantId, loadOrder]);

  // ── Computed totals ──────────────────────────────────────────────────────
  const totals: BillTotals = (() => {
    const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const serviceChargePct = order?.service_charge_pct ?? 10;
    const vatPct = order?.vat_pct ?? 11;
    const discountPct = order?.discount_pct ?? 0;
    const tipUsd = order?.tip_amount_usd ?? 0;

    const afterDiscount = subtotal * (1 - discountPct / 100);
    const service_charge = afterDiscount * (serviceChargePct / 100);
    const vat = (afterDiscount + service_charge) * (vatPct / 100);
    const total = afterDiscount + service_charge + vat + tipUsd;

    return {
      subtotal,
      service_charge,
      vat,
      tip: tipUsd,
      discount: subtotal * (discountPct / 100),
      total,
    };
  })();

  // ── Add item ─────────────────────────────────────────────────────────────
  const addItem = useCallback(async (params: AddItemParams) => {
    if (!orderId || !tenantId) return;
    const { data, error } = await supabase
      .from('restaurant_order_items')
      .insert({
        tenant_id: tenantId,
        order_id: orderId,
        menu_item_id: params.menu_item_id ?? null,
        product_name: params.product_name,
        quantity: params.quantity,
        unit_price: params.unit_price,
        course: params.course,
        notes: params.notes ?? null,
        modifiers: params.modifiers ?? [],
        status: 'pending',
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    if (data) setItems((prev) => [...prev, data as RestaurantOrderItem]);
  }, [orderId, tenantId]);

  // ── Remove item ──────────────────────────────────────────────────────────
  const removeItem = useCallback(async (itemId: string) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from('restaurant_order_items')
      .delete()
      .eq('id', itemId)
      .eq('tenant_id', tenantId);
    if (error) { console.error('[removeItem]', error); return; }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, [tenantId]);

  // ── Fire course ──────────────────────────────────────────────────────────
  // Moves all pending items in the given course to in_progress (sends to KDS)
  const fireCourse = useCallback(async (course: CourseType) => {
    if (!orderId) return;
    const pendingIds = items
      .filter((i) => i.course === course && i.status === 'pending')
      .map((i) => i.id);
    if (pendingIds.length === 0) {
      toast.info('No pending items in this course');
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('restaurant_order_items')
      .update({ status: 'in_progress', sent_at: now })
      .in('id', pendingIds);
    if (error) { toast.error(error.message); return; }
    setItems((prev) =>
      prev.map((i) =>
        pendingIds.includes(i.id)
          ? { ...i, status: 'in_progress' as const, sent_at: now }
          : i,
      ),
    );
    // Update current_course to signal progression
    const courseOrder: CourseType[] = ['appetizers', 'mains', 'desserts'];
    const nextCourse = courseOrder[courseOrder.indexOf(course) + 1];
    if (nextCourse && orderId && tenantId) {
      await supabase
        .from('table_orders')
        .update({ current_course: nextCourse })
        .eq('id', orderId)
        .eq('tenant_id', tenantId);
      setOrder((prev) => prev ? { ...prev, current_course: nextCourse } : prev);
    }
    toast.success(`Fired ${course} to kitchen — ${pendingIds.length} item${pendingIds.length > 1 ? 's' : ''}`);
  }, [orderId, tenantId, items]);

  // ── Send all pending+unsent items to kitchen ────────────────────────────
  // Updates all items with status='pending' and sent_at IS NULL to in_progress
  const sendToKitchen = useCallback(async () => {
    if (!orderId || !tenantId) return;
    const { error } = await supabase
      .from('restaurant_order_items')
      .update({ status: 'in_progress', sent_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .is('sent_at', null);
    if (error) console.error('[sendToKitchen]', error);
    void loadOrder();
  }, [orderId, tenantId, loadOrder]);

  // ── Update tip ───────────────────────────────────────────────────────────
  const updateTip = useCallback(async (tipUsd: number) => {
    if (!orderId || !tenantId) return;
    await supabase.from('table_orders').update({ tip_amount_usd: tipUsd }).eq('id', orderId).eq('tenant_id', tenantId);
    setOrder((prev) => prev ? { ...prev, tip_amount_usd: tipUsd } : prev);
  }, [orderId, tenantId]);

  // ── Update discount ──────────────────────────────────────────────────────
  const updateDiscount = useCallback(async (pct: number) => {
    if (!orderId || !tenantId) return;
    await supabase.from('table_orders').update({ discount_pct: pct }).eq('id', orderId).eq('tenant_id', tenantId);
    setOrder((prev) => prev ? { ...prev, discount_pct: pct } : prev);
  }, [orderId, tenantId]);

  // ── Close bill ───────────────────────────────────────────────────────────
  const closeBill = useCallback(async (paymentMethod: string) => {
    if (!orderId) return;
    // fn_close_restaurant_bill closes the order, sets table to cleaning,
    // and writes a sales + sale_items record into the main platform ledger.
    const { data: saleId, error } = await supabase.rpc('fn_close_restaurant_bill', {
      p_order_id: orderId,
      p_payment_method: paymentMethod,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Bill closed · Sale #${String(saleId).slice(-6).toUpperCase()} recorded`);
  }, [orderId]);

  // ── Confirm pending order ────────────────────────────────────────────────
  const confirmPendingOrder = useCallback(async (
    pendingOrderId: string,
    pendingItems: PendingOrderItem[],
  ) => {
    if (!orderId || !tenantId) return;
    const now = new Date().toISOString();

    // Insert items into restaurant_order_items
    const inserts = pendingItems.map((item) => ({
      tenant_id: tenantId,
      order_id: orderId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      course: item.course,
      notes: item.notes || null,
      modifiers: item.modifiers,
      status: 'pending' as const,
    }));

    const { data: inserted, error } = await supabase
      .from('restaurant_order_items')
      .insert(inserts)
      .select();
    if (error) { toast.error(error.message); return; }
    if (inserted) setItems((prev) => [...prev, ...(inserted as RestaurantOrderItem[])]);

    // Mark pending order as confirmed
    await supabase
      .from('restaurant_pending_orders')
      .update({ status: 'confirmed', confirmed_at: now })
      .eq('id', pendingOrderId)
      .eq('tenant_id', tenantId);

    setPendingOrders((prev) => prev.filter((p) => p.id !== pendingOrderId));
    toast.success('Customer order confirmed and added');
  }, [orderId, tenantId]);

  // ── Reject pending order ─────────────────────────────────────────────────
  const rejectPendingOrder = useCallback(async (pendingOrderId: string) => {
    if (!tenantId) return;
    await supabase
      .from('restaurant_pending_orders')
      .update({ status: 'rejected' })
      .eq('id', pendingOrderId)
      .eq('tenant_id', tenantId);
    setPendingOrders((prev) => prev.filter((p) => p.id !== pendingOrderId));
    toast.success('Order rejected');
  }, [tenantId]);

  // ── Split helpers ────────────────────────────────────────────────────────
  const splitEqual = useCallback((count: number): BillSplitPart[] => {
    const perPerson = totals.total / count;
    return Array.from({ length: count }, (_, i) => ({
      label: `Person ${i + 1}`,
      items: items.map((item) => item.id),
      subtotal: totals.subtotal / count,
      tax: totals.vat / count,
      service_charge: totals.service_charge / count,
      total: perPerson,
    }));
  }, [totals, items]);

  const splitBySeat = useCallback((seatCount: number): BillSplitPart[] => {
    const perSeat = totals.total / seatCount;
    return Array.from({ length: seatCount }, (_, i) => ({
      label: `Seat ${i + 1}`,
      items: [],
      subtotal: totals.subtotal / seatCount,
      tax: totals.vat / seatCount,
      service_charge: totals.service_charge / seatCount,
      total: perSeat,
    }));
  }, [totals]);

  const splitByItem = useCallback((
    assignments: Record<string, string[]>,
  ): BillSplitPart[] => {
    return Object.entries(assignments).map(([label, itemIds]) => {
      const assignedItems = items.filter((i) => itemIds.includes(i.id));
      const sub = assignedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const sc = sub * ((order?.service_charge_pct ?? 10) / 100);
      const vat = (sub + sc) * ((order?.vat_pct ?? 11) / 100);
      return {
        label,
        items: itemIds,
        subtotal: sub,
        tax: vat,
        service_charge: sc,
        total: sub + sc + vat,
      };
    });
  }, [items, order]);

  const saveBillSplit = useCallback(async (splitType: SplitType, splits: BillSplitPart[]) => {
    if (!orderId || !tenantId) return;
    await supabase.from('restaurant_bill_splits').insert({
      tenant_id: tenantId,
      order_id: orderId,
      split_type: splitType,
      split_count: splits.length,
      splits,
    });
  }, [orderId, tenantId]);

  return {
    order,
    items,
    pendingOrders,
    loading,
    totals,
    addItem,
    removeItem,
    fireCourse,
    sendToKitchen,
    updateTip,
    updateDiscount,
    closeBill,
    confirmPendingOrder,
    rejectPendingOrder,
    splitEqual,
    splitBySeat,
    splitByItem,
    saveBillSplit,
    refreshPendingOrders,
  };
}
