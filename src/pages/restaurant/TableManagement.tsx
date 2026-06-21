import {
  Plus, X, Receipt, Send, Users, ChevronRight, Trash2, Utensils, SplitSquareVertical, Calculator,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Layout from '@/components/Layout';
import FloorPlan from '@/components/restaurant/FloorPlan';
import MenuEditor from '@/components/restaurant/MenuEditor';
import { useApp } from '@/context/AppContext';
import type {
  RestaurantTable,
  TableOrder,
  RestaurantOrderItem,
  CourseType,
  TableStatus,
} from '@/types/restaurant';
import { COURSE_LABELS, STATUS_COLORS } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

type Tab = 'floor' | 'menu';
type SplitMode = 'equal' | 'by_seat' | 'percentage';

interface NewItemForm {
  product_name: string;
  quantity: number;
  unit_price: number;
  course: CourseType;
  notes: string;
}

const DEFAULT_FORM: NewItemForm = {
  product_name: '',
  quantity: 1,
  unit_price: 0,
  course: 'mains',
  notes: '',
};

export default function TableManagement() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [tab, setTab] = useState<Tab>('floor');
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [orderItems, setOrderItems] = useState<RestaurantOrderItem[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [newTableForm, setNewTableForm] = useState({ number: 1, seats: 4, section: 'indoor', name: '' });
  const [itemForm, setItemForm] = useState<NewItemForm>(DEFAULT_FORM);
  const [addingItem, setAddingItem] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [splitCount, setSplitCount] = useState(2);
  const [showBill, setShowBill] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [tRes, oRes, oiRes] = await Promise.all([
        supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId).order('number'),
        supabase.from('table_orders').select('*').eq('tenant_id', tenantId).eq('status', 'open').order('opened_at'),
        supabase.from('restaurant_order_items').select('*').eq('tenant_id', tenantId).neq('status', 'served').order('id'),
      ]);
      if (tRes.data) setTables(tRes.data as RestaurantTable[]);
      if (oRes.data) setOrders(oRes.data as TableOrder[]);
      if (oiRes.data) setOrderItems(oiRes.data as RestaurantOrderItem[]);
    } catch (err) {
      console.error('[TableManagement] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;
  const selectedOrder = orders.find((o) => o.table_id === selectedTableId) ?? null;
  const selectedOrderItems = selectedOrder
    ? orderItems.filter((i) => i.order_id === selectedOrder.id)
    : [];

  const activeOrdersByTable: Record<string, number> = orders.reduce<Record<string, number>>((acc, o) => {
    if (o.table_id) acc[o.table_id] = (acc[o.table_id] ?? 0) + 1;
    return acc;
  }, {});

  const handleAddTable = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase.from('restaurant_tables').insert({
      tenant_id: tenantId,
      number: newTableForm.number,
      seats: newTableForm.seats,
      section: newTableForm.section,
      name: newTableForm.name || null,
      x: 10 + (tables.length % 5) * 18,
      y: 10 + Math.floor(tables.length / 5) * 22,
      status: 'available',
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) setTables((prev) => [...prev, data as RestaurantTable]);
    setAddTableOpen(false);
    setNewTableForm({ number: tables.length + 2, seats: 4, section: 'indoor', name: '' });
    toast.success(t('restaurant.tableAdded', 'Table added'));
  };

  const handleMoveTable = async (id: string, x: number, y: number) => {
    setTables((prev) => prev.map((t) => t.id === id ? { ...t, x, y } : t));
    await supabase.from('restaurant_tables').update({ x, y }).eq('id', id);
  };

  const handleStatusChange = async (tableId: string, status: TableStatus) => {
    setTables((prev) => prev.map((t) => t.id === tableId ? { ...t, status } : t));
    await supabase.from('restaurant_tables').update({ status }).eq('id', tableId);
  };

  const handleOpenOrder = async () => {
    if (!tenantId || !selectedTableId) return;
    const { data, error } = await supabase.from('table_orders').insert({
      tenant_id: tenantId,
      table_id: selectedTableId,
      status: 'open',
      current_course: 'mains',
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      setOrders((prev) => [...prev, data as TableOrder]);
      await handleStatusChange(selectedTableId, 'occupied');
    }
  };

  const handleAddItem = async () => {
    if (!tenantId || !selectedOrder) return;
    if (!itemForm.product_name.trim()) { toast.error(t('restaurant.itemNameRequired', 'Item name required')); return; }
    const { data, error } = await supabase.from('restaurant_order_items').insert({
      tenant_id: tenantId,
      order_id: selectedOrder.id,
      product_name: itemForm.product_name.trim(),
      quantity: itemForm.quantity,
      unit_price: itemForm.unit_price,
      course: itemForm.course,
      notes: itemForm.notes || null,
      modifiers: [],
      status: 'pending',
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) setOrderItems((prev) => [...prev, data as RestaurantOrderItem]);
    setItemForm(DEFAULT_FORM);
    setAddingItem(false);
    toast.success(t('restaurant.itemAdded', 'Item added'));
  };

  const handleSendToKDS = async () => {
    if (!selectedOrder) return;
    const pendingIds = selectedOrderItems.filter((i) => i.status === 'pending').map((i) => i.id);
    if (pendingIds.length === 0) { toast.info(t('restaurant.noItemsToSend', 'No pending items to send')); return; }
    await supabase.from('restaurant_order_items').update({ status: 'in_progress', sent_at: new Date().toISOString() }).in('id', pendingIds);
    setOrderItems((prev) => prev.map((i) => pendingIds.includes(i.id) ? { ...i, status: 'in_progress', sent_at: new Date().toISOString() } : i));
    toast.success(`${t('restaurant.sentToKDS', 'Sent to kitchen')} — ${pendingIds.length} ${t('restaurant.items', 'items')}`);
  };

  const handleDeleteItem = async (itemId: string) => {
    await supabase.from('restaurant_order_items').delete().eq('id', itemId);
    setOrderItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleCloseOrder = async () => {
    if (!selectedOrder || !selectedTableId) return;
    await supabase.from('table_orders').update({ status: 'paid', closed_at: new Date().toISOString() }).eq('id', selectedOrder.id);
    setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id));
    setOrderItems((prev) => prev.filter((i) => i.order_id !== selectedOrder.id));
    await handleStatusChange(selectedTableId, 'cleaning');
    setSelectedTableId(null);
    setShowBill(false);
    toast.success(t('restaurant.orderClosed', 'Order paid and closed'));
  };

  const orderTotal = selectedOrderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const splitAmount = splitMode === 'equal' ? orderTotal / splitCount : 0;

  return (
    <Layout>
      <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">

          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{t('restaurant.tableManagement', 'Table Management')}</h1>
              <p className="mt-1 text-sm text-white/40">{t('restaurant.tableManagementDesc', 'Manage your floor plan, orders, and billing')}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTab('floor')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${tab === 'floor' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
              >
                {t('restaurant.floorPlan', 'Floor Plan')}
              </button>
              <button
                onClick={() => setTab('menu')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${tab === 'menu' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
              >
                {t('restaurant.menuManagement', 'Menu')}
              </button>
            </div>
          </div>

          {tab === 'menu' ? (
            <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-6">
              <MenuEditor />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* Left: Floor Plan */}
              <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-4">
                {loading ? (
                  <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-500" />
                  </div>
                ) : (
                  <FloorPlan
                    tables={tables}
                    selectedTableId={selectedTableId}
                    onSelectTable={setSelectedTableId}
                    onMoveTable={(id, x, y) => { void handleMoveTable(id, x, y); }}
                    onAddTable={() => setAddTableOpen(true)}
                    activeOrdersByTable={activeOrdersByTable}
                  />
                )}
              </div>

              {/* Right: Order Panel */}
              <div className="flex flex-col gap-4">
                {!selectedTable ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-800/50 p-8 text-center">
                    <Utensils className="mb-3 h-8 w-8 text-white/20" />
                    <p className="text-sm text-white/40">{t('restaurant.selectTable', 'Select a table on the floor plan')}</p>
                  </div>
                ) : (
                  <>
                    {/* Table info card */}
                    <div className={`rounded-2xl border-2 p-4 ${STATUS_COLORS[selectedTable.status].bg} ${STATUS_COLORS[selectedTable.status].border}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-bold text-white">
                            {t('restaurant.tableNum', 'Table')} {selectedTable.number}
                            {selectedTable.name && <span className="ml-2 text-sm font-normal text-white/50">{selectedTable.name}</span>}
                          </h2>
                          <p className="text-sm text-white/50">
                            {selectedTable.seats} {t('restaurant.seats', 'seats')} · {selectedTable.section}
                          </p>
                        </div>
                        <button onClick={() => setSelectedTableId(null)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {/* Status buttons */}
                      <div className="flex flex-wrap gap-1.5">
                        {(['available', 'occupied', 'reserved', 'cleaning'] as TableStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => { void handleStatusChange(selectedTable.id, s); }}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-all ${
                              selectedTable.status === s
                                ? `${STATUS_COLORS[s].bg} ${STATUS_COLORS[s].border} ${STATUS_COLORS[s].text} border`
                                : 'bg-white/5 text-white/30 hover:bg-white/10'
                            }`}
                          >
                            {t(`restaurant.status.${s}`, s)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Order section */}
                    {!selectedOrder ? (
                      <button
                        onClick={() => { void handleOpenOrder(); }}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 py-4 text-sm font-semibold text-indigo-400 transition-all hover:bg-indigo-500/20"
                      >
                        <Plus className="h-4 w-4" />
                        {t('restaurant.openOrder', 'Open New Order')}
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-slate-800/50 overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                          <h3 className="text-sm font-semibold text-white">{t('restaurant.activeOrder', 'Active Order')}</h3>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { void handleSendToKDS(); }}
                              className="flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-2.5 py-1.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/30 transition-all"
                            >
                              <Send className="h-3 w-3" />
                              {t('restaurant.sendKDS', 'Send KDS')}
                            </button>
                            <button
                              onClick={() => setShowBill(!showBill)}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-all"
                            >
                              <Receipt className="h-3 w-3" />
                              {t('restaurant.bill', 'Bill')}
                            </button>
                          </div>
                        </div>

                        {/* Items list */}
                        <div className="max-h-64 overflow-y-auto p-3 space-y-1.5">
                          {selectedOrderItems.length === 0 && (
                            <p className="py-4 text-center text-xs text-white/30">{t('restaurant.noItems', 'No items yet')}</p>
                          )}
                          {(['appetizers', 'mains', 'desserts'] as CourseType[]).map((course) => {
                            const courseItems = selectedOrderItems.filter((i) => i.course === course);
                            if (courseItems.length === 0) return null;
                            return (
                              <div key={course}>
                                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/30">
                                  {COURSE_LABELS[course]}
                                </div>
                                {courseItems.map((item) => (
                                  <div key={item.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                                    <span className="flex-1 text-xs text-white">
                                      {item.quantity}× {item.product_name}
                                    </span>
                                    <span className="text-xs text-white/50">${(item.unit_price * item.quantity).toFixed(2)}</span>
                                    <span className={`rounded px-1.5 text-[9px] font-semibold uppercase ${
                                      item.status === 'pending' ? 'bg-white/10 text-white/40'
                                        : item.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400'
                                          : item.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'bg-slate-500/20 text-slate-400'
                                    }`}>{item.status}</span>
                                    <button
                                      onClick={() => { void handleDeleteItem(item.id); }}
                                      className="rounded p-0.5 text-white/20 hover:text-red-400 transition-colors"
                                      aria-label={`Remove ${item.product_name}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>

                        {/* Add item form */}
                        {addingItem ? (
                          <div className="border-t border-white/10 p-3 space-y-2">
                            <input
                              type="text"
                              placeholder={t('restaurant.itemName', 'Item name')}
                              value={itemForm.product_name}
                              onChange={(e) => setItemForm((p) => ({ ...p, product_name: e.target.value }))}
                              className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                            />
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min={1}
                                value={itemForm.quantity}
                                onChange={(e) => setItemForm((p) => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                                className="w-20 rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                placeholder="Qty"
                                aria-label="Quantity"
                              />
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={itemForm.unit_price}
                                onChange={(e) => setItemForm((p) => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))}
                                className="flex-1 rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                                placeholder="Price $"
                                aria-label="Unit price"
                              />
                              <select
                                value={itemForm.course}
                                onChange={(e) => setItemForm((p) => ({ ...p, course: e.target.value as CourseType }))}
                                className="rounded-xl bg-slate-800 border border-white/10 px-2 py-2 text-xs text-white focus:outline-none"
                                aria-label="Course"
                              >
                                {(['appetizers', 'mains', 'desserts'] as CourseType[]).map((c) => (
                                  <option key={c} value={c}>{COURSE_LABELS[c]}</option>
                                ))}
                              </select>
                            </div>
                            <input
                              type="text"
                              placeholder={t('restaurant.notes', 'Special notes (optional)')}
                              value={itemForm.notes}
                              onChange={(e) => setItemForm((p) => ({ ...p, notes: e.target.value }))}
                              className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => { void handleAddItem(); }}
                                className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all"
                              >
                                {t('restaurant.addItem', 'Add Item')}
                              </button>
                              <button
                                onClick={() => { setAddingItem(false); setItemForm(DEFAULT_FORM); }}
                                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/40 hover:bg-white/5 transition-all"
                              >
                                {t('common.cancel', 'Cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="border-t border-white/10 p-3">
                            <button
                              onClick={() => setAddingItem(true)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2 text-xs text-white/40 hover:border-indigo-500/30 hover:text-indigo-400 transition-all"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {t('restaurant.addItem', 'Add Item')}
                            </button>
                          </div>
                        )}

                        {/* Bill section */}
                        {showBill && (
                          <div className="border-t border-white/10 bg-slate-900/50 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-white/60">{t('restaurant.total', 'Total')}</span>
                              <span className="text-lg font-bold text-white">${orderTotal.toFixed(2)}</span>
                            </div>

                            {/* Split mode */}
                            <div className="flex gap-1.5">
                              {([
                                { key: 'equal', label: t('restaurant.split.equal', 'Equal'), icon: Users },
                                { key: 'by_seat', label: t('restaurant.split.bySeat', 'By Seat'), icon: SplitSquareVertical },
                                { key: 'percentage', label: t('restaurant.split.percent', '%'), icon: Calculator },
                              ] as const).map((mode) => {
                                const ModeIcon = mode.icon;
                                return (
                                  <button
                                    key={mode.key}
                                    onClick={() => setSplitMode(mode.key as SplitMode)}
                                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                                      splitMode === mode.key ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                    }`}
                                  >
                                    <ModeIcon className="h-3 w-3" />
                                    {mode.label}
                                  </button>
                                );
                              })}
                            </div>

                            {splitMode === 'equal' && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-white/50">{t('restaurant.split.ways', 'Ways')}</span>
                                  <input
                                    type="number"
                                    min={2}
                                    max={20}
                                    value={splitCount}
                                    onChange={(e) => setSplitCount(Math.max(2, parseInt(e.target.value) || 2))}
                                    className="w-16 rounded-lg bg-slate-800 border border-white/10 px-2 py-1 text-sm text-white text-center"
                                    aria-label="Split count"
                                  />
                                </div>
                                <div className="rounded-xl bg-white/5 px-3 py-2.5 text-center">
                                  <span className="text-lg font-bold text-white">${splitAmount.toFixed(2)}</span>
                                  <span className="ml-2 text-sm text-white/40">{t('restaurant.split.perPerson', 'per person')}</span>
                                </div>
                              </div>
                            )}

                            {splitMode === 'by_seat' && (
                              <div className="rounded-xl bg-white/5 p-3 space-y-1.5">
                                {Array.from({ length: selectedTable.seats }).map((_, i) => (
                                  <div key={i} className="flex items-center justify-between">
                                    <span className="text-xs text-white/50">{t('restaurant.seat', 'Seat')} {i + 1}</span>
                                    <span className="text-sm font-semibold text-white">${(orderTotal / selectedTable.seats).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {splitMode === 'percentage' && (
                              <p className="text-xs text-white/30 text-center">{t('restaurant.split.percentDesc', 'Enter custom percentages per guest at checkout')}</p>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={() => { void handleCloseOrder(); }}
                                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
                              >
                                <ChevronRight className="inline h-4 w-4" />
                                {t('restaurant.markPaid', 'Mark Paid')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Table Modal */}
      {addTableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h2 className="mb-4 text-lg font-bold text-white">{t('restaurant.addTable', 'Add Table')}</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-white/50">{t('restaurant.tableNumber', 'Table Number')}</label>
                <input
                  type="number"
                  min={1}
                  value={newTableForm.number}
                  onChange={(e) => setNewTableForm((p) => ({ ...p, number: parseInt(e.target.value) || 1 }))}
                  className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">{t('restaurant.tableName', 'Table Name (optional)')}</label>
                <input
                  type="text"
                  placeholder="e.g. Window Seat, Bar 1"
                  value={newTableForm.name}
                  onChange={(e) => setNewTableForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t('restaurant.seats', 'Seats')}</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newTableForm.seats}
                    onChange={(e) => setNewTableForm((p) => ({ ...p, seats: parseInt(e.target.value) || 2 }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/50">{t('restaurant.section', 'Section')}</label>
                  <select
                    value={newTableForm.section}
                    onChange={(e) => setNewTableForm((p) => ({ ...p, section: e.target.value }))}
                    className="w-full rounded-xl bg-slate-800 border border-white/20 px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="indoor">{t('restaurant.section.indoor', 'Indoor')}</option>
                    <option value="terrace">{t('restaurant.section.terrace', 'Terrace')}</option>
                    <option value="bar">{t('restaurant.section.bar', 'Bar')}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { void handleAddTable(); }}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
              >
                {t('restaurant.addTable', 'Add Table')}
              </button>
              <button
                onClick={() => setAddTableOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:bg-white/5 transition-all"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
