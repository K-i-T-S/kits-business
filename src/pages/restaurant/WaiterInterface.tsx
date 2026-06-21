/**
 * WaiterInterface — Mobile-first PWA screen for waiter service
 * Full-screen, no sidebar, touch-optimized.
 */
import {
  ArrowLeft,
  X,
  ChevronRight,
  Flame,
  Plus,
  ClipboardList,
  Receipt,
  StickyNote,
  AlertTriangle,
  Check,
  RefreshCw,
  Clock,
  Users,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import BillSplitter from '@/components/restaurant/BillSplitter';
import { useApp } from '@/context/AppContext';
import { useRestaurantOrder } from '@/hooks/useRestaurantOrder';
import type {
  RestaurantTable,
  TableOrder,
  RestaurantOrderItem,
  TableOrderExtended,
  CourseType,
  PendingOrder,
  PendingOrderItem,
  SplitType,
  BillSplitPart,
  RestaurantSettings,
} from '@/types/restaurant';
import { COURSE_LABELS } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

type DetailTab = 'orders' | 'bill' | 'notes';
const LBP_RATE = 89500;

// ── Utility ──────────────────────────────────────────────────────────────────

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface TableWithOrder {
  table: RestaurantTable;
  order: TableOrder | null;
  items: RestaurantOrderItem[];
  pendingCount: number;
}

// ── Table Tile ────────────────────────────────────────────────────────────────

interface TableTileProps {
  data: TableWithOrder;
  slowThreshold: number;
  onSelect: () => void;
}

function TableTile({ data, slowThreshold, onSelect }: TableTileProps) {
  const { t } = useTranslation();
  const { table, order, items, pendingCount } = data;
  const minutes = order ? minutesSince(order.opened_at) : 0;
  const isSlowService = order && minutes > slowThreshold;
  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  const tileStyle = (() => {
    if (!order) return 'border-white/10 bg-white/3';
    if (pendingCount > 0) return 'border-amber-500/50 bg-amber-500/10 animate-pulse-subtle';
    if (isSlowService) return 'border-orange-500/40 bg-orange-500/8';
    return 'border-indigo-500/30 bg-indigo-500/10';
  })();

  const dotColor = (() => {
    if (!order) return 'bg-slate-600';
    if (pendingCount > 0) return 'bg-amber-400 animate-pulse';
    if (isSlowService) return 'bg-orange-400 animate-pulse';
    return 'bg-indigo-400';
  })();

  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-col rounded-2xl border-2 p-4 text-start transition-all active:scale-95 touch-manipulation ${tileStyle}`}
      style={{ minHeight: 120 }}
      aria-label={`Table ${table.number} — ${order ? 'occupied' : 'available'}`}
    >
      {/* Status dot */}
      <div className={`absolute right-3 top-3 h-3 w-3 rounded-full ${dotColor}`} aria-hidden="true" />

      {/* Table number */}
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-white">{table.number}</span>
        {table.name && <span className="text-xs text-white/40">{table.name}</span>}
      </div>

      {/* Seats + section */}
      <div className="mb-2 flex items-center gap-1.5 text-xs text-white/50">
        <Users className="h-3 w-3" />
        <span>{table.seats}</span>
        <span className="text-white/20">·</span>
        <span className="capitalize">{table.section}</span>
      </div>

      {/* Order info */}
      {order ? (
        <div className="mt-auto space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-white/60">
            <Clock className="h-3 w-3" />
            <span>{minutes}m</span>
            {isSlowService && <span className="text-orange-400">· slow</span>}
          </div>
          <div className="text-sm font-bold text-white">${total.toFixed(2)}</div>
          {pendingCount > 0 && (
            <div className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              {pendingCount} waiting
            </div>
          )}
        </div>
      ) : (
        <div className="mt-auto text-xs text-white/30">{t('restaurant.available', 'Available')}</div>
      )}
    </button>
  );
}

// ── Item Status Badge ────────────────────────────────────────────────────────

function ItemBadge({ status }: { status: RestaurantOrderItem['status'] }) {
  const { t } = useTranslation();
  const styles: Record<RestaurantOrderItem['status'], string> = {
    pending: 'bg-white/10 text-white/50',
    in_progress: 'bg-amber-500/20 text-amber-400',
    ready: 'bg-emerald-500/20 text-emerald-400',
    served: 'bg-slate-500/20 text-slate-400',
  };
  const labels: Record<RestaurantOrderItem['status'], string> = {
    pending: t('restaurant.item.pending', 'Pending'),
    in_progress: t('restaurant.item.inProgress', 'In Progress'),
    ready: t('restaurant.item.ready', 'Ready'),
    served: t('restaurant.item.served', 'Served'),
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ── Pending Order Confirmation Modal ─────────────────────────────────────────

interface PendingOrderModalProps {
  pendingOrder: PendingOrder;
  onConfirm: (items: PendingOrderItem[]) => Promise<void>;
  onReject: () => Promise<void>;
  onClose: () => void;
}

function PendingOrderModal({ pendingOrder, onConfirm, onReject, onClose }: PendingOrderModalProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<PendingOrderItem[]>(pendingOrder.items);
  const [confirming, setConfirming] = useState(false);

  const updateQty = (idx: number, qty: number) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, qty) } : item));
  };

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm(items);
    setConfirming(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl border border-white/10 bg-slate-900 p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">{t('restaurant.pendingOrder.title', 'Customer Order')}</h2>
            <p className="text-xs text-white/40">
              {t('restaurant.pendingOrder.received', 'Received')} {minutesSince(pendingOrder.created_at)}m {t('common.ago', 'ago')}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/10 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Items */}
        <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 rounded-2xl bg-white/5 p-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{item.name}</p>
                {item.modifiers.length > 0 && (
                  <p className="mt-0.5 text-xs text-white/40">
                    {item.modifiers.map((m) => m.name).join(', ')}
                  </p>
                )}
                {item.notes && <p className="mt-0.5 text-xs text-amber-400">{item.notes}</p>}
                <p className="mt-1 text-xs text-white/50">
                  ${item.unit_price.toFixed(2)} · {item.course}
                </p>
              </div>
              {/* Qty stepper */}
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1">
                <button
                  onClick={() => updateQty(idx, item.quantity - 1)}
                  className="text-white/60 hover:text-white"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm font-bold text-white">{item.quantity}</span>
                <button
                  onClick={() => updateQty(idx, item.quantity + 1)}
                  className="text-white/60 hover:text-white"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => { void onReject(); onClose(); }}
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all"
          >
            <X className="mr-1.5 inline h-4 w-4" />
            {t('restaurant.pendingOrder.reject', 'Reject')}
          </button>
          <button
            onClick={() => { void handleConfirm(); onClose(); }}
            disabled={confirming}
            className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            <Check className="mr-1.5 inline h-4 w-4" />
            {t('restaurant.pendingOrder.confirmAll', 'Confirm All')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Table Detail (full-screen overlay) ───────────────────────────────────────

interface TableDetailProps {
  tableData: TableWithOrder;
  settings: RestaurantSettings | null;
  onClose: () => void;
  onOrderClosed: () => void;
}

function TableDetail({ tableData, settings, onClose, onOrderClosed }: TableDetailProps) {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const { table, order } = tableData;
  const tenantId = currentTenant?.id;

  const {
    items,
    pendingOrders,
    totals,
    addItem,
    removeItem,
    fireCourse,
    updateTip,
    updateDiscount,
    closeBill,
    confirmPendingOrder,
    rejectPendingOrder,
    splitEqual,
    splitBySeat,
    splitByItem,
    saveBillSplit,
  } = useRestaurantOrder(table.id, order?.id ?? null);

  const [activeTab, setActiveTab] = useState<DetailTab>('orders');
  const [selectedPendingOrder, setSelectedPendingOrder] = useState<PendingOrder | null>(null);

  // Add item state
  const [addingItem, setAddingItem] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    product_name: '',
    quantity: 1,
    unit_price: 0,
    course: 'mains' as CourseType,
    notes: '',
  });

  // Bill state
  const [tipInput, setTipInput] = useState(String(order ? ((order as TableOrderExtended).tip_amount_usd ?? 0) : 0));
  const [discountInput, setDiscountInput] = useState(String(order ? ((order as TableOrderExtended).discount_pct ?? 0) : 0));
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [closingBill, setClosingBill] = useState(false);

  // Split state
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [equalCount, setEqualCount] = useState(2);
  const [byItemAssignments, setByItemAssignments] = useState<Record<string, string[]>>({});

  // Notes state
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  const splits: BillSplitPart[] = (() => {
    if (splitType === 'equal') return splitEqual(equalCount);
    if (splitType === 'by_seat') return splitBySeat(table.seats);
    return splitByItem(byItemAssignments);
  })();

  const handleCloseBill = async () => {
    setClosingBill(true);
    try {
      await saveBillSplit(splitType, splits);
      await closeBill(paymentMethod);
      onOrderClosed();
      onClose();
    } finally {
      setClosingBill(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!order?.id) return;
    setSavingNotes(true);
    await supabase.from('table_orders').update({ notes }).eq('id', order.id);
    setSavingNotes(false);
    toast.success(t('restaurant.notesSaved', 'Notes saved'));
  };

  const handleAddItem = async () => {
    if (!newItemForm.product_name.trim()) {
      toast.error(t('restaurant.itemNameRequired', 'Item name required'));
      return;
    }
    await addItem(newItemForm);
    setNewItemForm({ product_name: '', quantity: 1, unit_price: 0, course: 'mains', notes: '' });
    setAddingItem(false);
  };

  const handlePrint = (split: BillSplitPart) => {
    // In a real PWA this would trigger window.print() with a receipt template
    toast.info(`${t('restaurant.split.printing', 'Printing receipt for')} ${split.label} — ${split.total.toFixed(2)} USD`);
  };

  const tabs: Array<{ key: DetailTab; label: string; icon: typeof ClipboardList; badge?: number }> = [
    { key: 'orders', label: t('restaurant.tab.orders', 'Orders'), icon: ClipboardList, badge: pendingOrders.length || undefined },
    { key: 'bill', label: t('restaurant.tab.bill', 'Bill'), icon: Receipt },
    { key: 'notes', label: t('restaurant.tab.notes', 'Notes'), icon: StickyNote },
  ];

  const courses: CourseType[] = ['appetizers', 'mains', 'desserts'];
  const minutesOpen = order ? minutesSince(order.opened_at) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* Header */}
      <div className="flex-none border-b border-white/10 bg-slate-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">
                {t('restaurant.tableNum', 'Table')} {table.number}
              </h2>
              {table.name && <span className="text-sm text-white/40">{table.name}</span>}
              <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs text-white/60 capitalize">{table.section}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{table.seats} seats</span>
              {order && (
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{minutesOpen}m · opened {formatTime(order.opened_at)}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/60 hover:text-white transition-all active:scale-90"
            aria-label="Close table detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pending orders banner */}
        {pendingOrders.length > 0 && (
          <button
            onClick={() => { setActiveTab('orders'); setSelectedPendingOrder(pendingOrders[0] ?? null); }}
            className="mt-2 flex w-full items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-start"
          >
            <AlertTriangle className="h-4 w-4 flex-none text-amber-400 animate-pulse" />
            <span className="text-sm font-semibold text-amber-400">
              {pendingOrders.length} {t('restaurant.pendingOrders.waiting', 'customer order(s) waiting for confirmation')}
            </span>
            <ChevronRight className="ml-auto h-4 w-4 text-amber-400/60" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-none border-b border-white/10 bg-slate-900">
        <div className="flex">
          {tabs.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-all ${
                activeTab === key
                  ? 'border-b-2 border-indigo-500 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="p-4 space-y-4">
            {!order ? (
              <div className="flex flex-col items-center justify-center py-16">
                <ClipboardList className="mb-3 h-10 w-10 text-white/20" />
                <p className="text-sm text-white/40">{t('restaurant.noOrder', 'No open order for this table')}</p>
                <button
                  onClick={() => {
                    void (async () => {
                      if (!tenantId) return;
                      const rsSettings = settings;
                      const { data, error } = await supabase.from('table_orders').insert({
                        tenant_id: tenantId,
                        table_id: table.id,
                        status: 'open',
                        current_course: 'mains',
                        order_flow: rsSettings?.default_order_flow ?? 'waiter_confirm',
                        payment_mode: rsSettings?.default_payment_mode ?? 'waiter_only',
                        service_charge_pct: rsSettings?.service_charge_pct ?? 10,
                        vat_pct: rsSettings?.vat_pct ?? 11,
                      }).select().single();
                      if (error) { toast.error(error.message); return; }
                      if (data) {
                        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id);
                        toast.success(t('restaurant.orderOpened', 'Order opened'));
                        onOrderClosed();
                        onClose();
                      }
                    })();
                  }}
                  className="mt-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-3 text-sm font-bold text-white"
                >
                  {t('restaurant.openOrder', 'Open New Order')}
                </button>
              </div>
            ) : (
              <>
                {/* Course sections */}
                {courses.map((course) => {
                  const courseItems = items.filter((i) => i.course === course);
                  const hasPending = courseItems.some((i) => i.status === 'pending');
                  return (
                    <div key={course}>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
                          {COURSE_LABELS[course]}
                        </h3>
                        {hasPending && (
                          <button
                            onClick={() => { void fireCourse(course); }}
                            className="flex items-center gap-1 rounded-xl bg-orange-500/20 px-3 py-1.5 text-xs font-bold text-orange-400 hover:bg-orange-500/30 active:scale-95 transition-all"
                          >
                            <Flame className="h-3.5 w-3.5" />
                            {t('restaurant.fireCourse', 'Fire')} {COURSE_LABELS[course]}
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {courseItems.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-white/10 py-3 text-center text-xs text-white/20">
                            {t('restaurant.noItemsInCourse', 'No items')}
                          </p>
                        ) : (
                          courseItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-white">{item.quantity}×</span>
                                  <span className="truncate text-sm text-white">{item.product_name}</span>
                                </div>
                                {item.modifiers && item.modifiers.length > 0 && (
                                  <p className="mt-0.5 text-xs text-white/40">
                                    {item.modifiers.map((m) => m.name).join(', ')}
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="mt-0.5 text-xs text-amber-400">{item.notes}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white/40">${(item.unit_price * item.quantity).toFixed(2)}</span>
                                <ItemBadge status={item.status} />
                                {item.status === 'pending' && (
                                  <button
                                    onClick={() => { void removeItem(item.id); }}
                                    className="rounded-lg p-1 text-white/20 hover:text-red-400 transition-colors"
                                    aria-label={`Remove ${item.product_name}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add item */}
                {addingItem ? (
                  <div className="rounded-2xl border border-indigo-500/20 bg-white/5 p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-white">{t('restaurant.addItem', 'Add Item')}</h4>
                    <input
                      type="text"
                      placeholder={t('restaurant.itemName', 'Item name')}
                      value={newItemForm.product_name}
                      onChange={(e) => setNewItemForm((p) => ({ ...p, product_name: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                      autoFocus
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min={1}
                        value={newItemForm.quantity}
                        onChange={(e) => setNewItemForm((p) => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-center text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                        aria-label="Quantity"
                        placeholder="Qty"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={newItemForm.unit_price}
                        onChange={(e) => setNewItemForm((p) => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))}
                        className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                        aria-label="Unit price"
                        placeholder="Price"
                      />
                      <select
                        value={newItemForm.course}
                        onChange={(e) => setNewItemForm((p) => ({ ...p, course: e.target.value as CourseType }))}
                        className="rounded-xl border border-white/20 bg-slate-800 px-2 py-2.5 text-xs text-white focus:outline-none"
                        aria-label="Course"
                      >
                        {courses.map((c) => (
                          <option key={c} value={c}>{COURSE_LABELS[c]}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder={t('restaurant.notes', 'Special notes')}
                      value={newItemForm.notes}
                      onChange={(e) => setNewItemForm((p) => ({ ...p, notes: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { void handleAddItem(); }}
                        className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-bold text-white"
                      >
                        {t('restaurant.addItem', 'Add Item')}
                      </button>
                      <button
                        onClick={() => setAddingItem(false)}
                        className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/40 hover:bg-white/5 transition-all"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingItem(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 py-4 text-sm text-white/40 hover:border-indigo-500/30 hover:text-indigo-400 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    {t('restaurant.addItem', 'Add Item')}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* BILL TAB */}
        {activeTab === 'bill' && order && (
          <div className="p-4 space-y-4">
            {/* Bill summary */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/60">{t('restaurant.bill.subtotal', 'Subtotal')}</span>
                <span className="text-white">${totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-400">{t('restaurant.bill.discount', 'Discount')}</span>
                  <span className="text-emerald-400">−${totals.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white/60">{t('restaurant.bill.serviceCharge', 'Service Charge')} ({(order as TableOrderExtended).service_charge_pct ?? 10}%)</span>
                <span className="text-white">${totals.service_charge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">{t('restaurant.bill.vat', 'VAT')} ({(order as TableOrderExtended).vat_pct ?? 11}%)</span>
                <span className="text-white">${totals.vat.toFixed(2)}</span>
              </div>
              {totals.tip > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">{t('restaurant.bill.tip', 'Tip')}</span>
                  <span className="text-white">${totals.tip.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2">
                <div className="flex justify-between">
                  <span className="text-base font-bold text-white">{t('restaurant.bill.total', 'Total')}</span>
                  <div className="text-end">
                    <p className="text-base font-black text-white">${totals.total.toFixed(2)}</p>
                    <p className="text-xs text-white/40">{Math.round(totals.total * LBP_RATE).toLocaleString()} L.L.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tip + Discount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs text-white/50">{t('restaurant.bill.tip', 'Tip (USD)')}</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={tipInput}
                  onChange={(e) => setTipInput(e.target.value)}
                  onBlur={() => { void updateTip(parseFloat(tipInput) || 0); }}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                  aria-label="Tip amount in USD"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/50">{t('restaurant.bill.discount', 'Discount (%)')}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  onBlur={() => { void updateDiscount(parseFloat(discountInput) || 0); }}
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
                  aria-label="Discount percentage"
                />
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="mb-1.5 block text-xs text-white/50">{t('restaurant.bill.paymentMethod', 'Payment Method')}</label>
              <div className="flex gap-2">
                {(['cash', 'card', 'bank_transfer'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-semibold capitalize transition-all ${
                      paymentMethod === m
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {t(`restaurant.bill.${m}`, m.replace('_', ' '))}
                  </button>
                ))}
              </div>
            </div>

            {/* Split bill */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="mb-3 text-sm font-semibold text-white">{t('restaurant.split.title', 'Split Bill')}</h4>
              <BillSplitter
                items={items}
                splits={splits}
                splitType={splitType}
                seatCount={table.seats}
                onSplitTypeChange={setSplitType}
                onEqualCountChange={setEqualCount}
                equalCount={equalCount}
                onByItemAssign={setByItemAssignments}
                onPrint={handlePrint}
                lbpRate={LBP_RATE}
              />
            </div>

            {/* Close bill button */}
            <button
              onClick={() => { void handleCloseBill(); }}
              disabled={closingBill}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-base font-black text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              <Receipt className="h-5 w-5" />
              {closingBill
                ? t('restaurant.bill.closing', 'Closing...')
                : t('restaurant.bill.closePrint', 'Close & Print Bill')}
            </button>
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="p-4 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                {t('restaurant.notes.label', 'Table Notes')}
              </label>
              <p className="mb-3 text-xs text-white/40">
                {t('restaurant.notes.desc', 'Allergies, VIP info, special requests — visible to all staff')}
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-indigo-500/40 focus:outline-none"
                placeholder={t('restaurant.notes.placeholder', 'e.g. Allergic to nuts, Birthday celebration, VIP — comps dessert')}
              />
            </div>
            <button
              onClick={() => { void handleSaveNotes(); }}
              disabled={savingNotes}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {savingNotes ? t('common.saving', 'Saving...') : t('restaurant.notes.save', 'Save Notes')}
            </button>
          </div>
        )}
      </div>

      {/* Pending order modal */}
      {selectedPendingOrder && (
        <PendingOrderModal
          pendingOrder={selectedPendingOrder}
          onConfirm={(editedItems) => confirmPendingOrder(selectedPendingOrder.id, editedItems)}
          onReject={() => rejectPendingOrder(selectedPendingOrder.id)}
          onClose={() => setSelectedPendingOrder(null)}
        />
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WaiterInterface() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTenant, currentEmployee } = useApp();
  const tenantId = currentTenant?.id;
  const now = useClock();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [allItems, setAllItems] = useState<RestaurantOrderItem[]>([]);
  const [pendingOrderCounts, setPendingOrderCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [filterSection, setFilterSection] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [tRes, oRes, oiRes, poRes, sRes] = await Promise.all([
        supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId).order('number'),
        supabase.from('table_orders').select('*').eq('tenant_id', tenantId).eq('status', 'open'),
        supabase.from('restaurant_order_items').select('*').eq('tenant_id', tenantId).neq('status', 'served'),
        supabase.from('restaurant_pending_orders').select('table_id').eq('tenant_id', tenantId).eq('status', 'pending'),
        supabase.from('restaurant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
      ]);
      if (tRes.data) setTables(tRes.data as RestaurantTable[]);
      if (oRes.data) setOrders(oRes.data as TableOrder[]);
      if (oiRes.data) setAllItems(oiRes.data as RestaurantOrderItem[]);
      if (poRes.data) {
        const counts: Record<string, number> = {};
        (poRes.data as Array<{ table_id: string }>).forEach(({ table_id }) => {
          counts[table_id] = (counts[table_id] ?? 0) + 1;
        });
        setPendingOrderCounts(counts);
      }
      if (sRes.data) setSettings(sRes.data as RestaurantSettings);
    } catch (err) {
      console.error('[WaiterInterface] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
    // Auto-refresh every 30s
    refreshIntervalRef.current = setInterval(() => { void loadData(); }, 30000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const tableDataList: TableWithOrder[] = tables
    .filter((t) => filterSection === 'all' || t.section === filterSection)
    .map((table) => {
      const order = orders.find((o) => o.table_id === table.id) ?? null;
      const items = order ? allItems.filter((i) => i.order_id === order.id) : [];
      return {
        table,
        order,
        items,
        pendingCount: pendingOrderCounts[table.id] ?? 0,
      };
    });

  const selectedTableData = tableDataList.find((d) => d.table.id === selectedTableId) ?? null;
  const sections = ['all', ...Array.from(new Set(tables.map((t) => t.section)))];
  const slowThreshold = settings?.slow_service_threshold_minutes ?? 15;

  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const totalPending = Object.values(pendingOrderCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* Top bar */}
      <header className="flex-none border-b border-white/10 bg-slate-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { void navigate(-1); }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
                aria-label={t('common.back', 'Back')}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500">
                <span className="text-xs font-black text-white">
                  {currentEmployee?.name?.slice(0, 2).toUpperCase() ?? 'W'}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">{currentEmployee?.name ?? t('restaurant.waiter', 'Waiter')}</p>
                <p className="text-[10px] text-white/40">{currentTenant?.name ?? ''}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-end">
              <p className="text-sm font-bold text-white">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-[10px] text-white/40">{occupiedCount}/{tables.length} {t('restaurant.tablesOccupied', 'occupied')}</p>
            </div>
            {totalPending > 0 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 animate-bounce">
                <span className="text-xs font-black text-white">{totalPending}</span>
              </div>
            )}
            <button
              onClick={() => { void handleRefresh(); }}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:text-white transition-all disabled:opacity-50"
              aria-label="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Section filter */}
      {sections.length > 2 && (
        <div className="flex-none overflow-x-auto border-b border-white/10 bg-slate-900 px-4 py-2">
          <div className="flex gap-2">
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSection(s)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                  filterSection === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {s === 'all' ? t('common.all', 'All') : t(`restaurant.section.${s}`, s)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table grid */}
      <main className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
          </div>
        ) : tableDataList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ClipboardList className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">{t('restaurant.noTables', 'No tables configured')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {tableDataList.map((data) => (
              <TableTile
                key={data.table.id}
                data={data}
                slowThreshold={slowThreshold}
                onSelect={() => setSelectedTableId(data.table.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Table detail overlay */}
      {selectedTableId && selectedTableData && (
        <TableDetail
          tableData={selectedTableData}
          settings={settings}
          onClose={() => setSelectedTableId(null)}
          onOrderClosed={() => { void loadData(); }}
        />
      )}
    </div>
  );
}
