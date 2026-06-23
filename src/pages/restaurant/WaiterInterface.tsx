/**
 * WaiterInterface — Mobile-first PWA screen for waiter service
 * Full-screen, no sidebar, touch-optimized.
 *
 * Phase 0 Features:
 * - Send to Kitchen FAB with item count
 * - Pending Orders Badge in header
 * - Close Bill Modal with dual-currency support
 *
 * Layout: Thumb-zone optimised — bottom navigation + FAB above nav
 */
import { AnimatePresence, motion } from 'framer-motion';
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
  Search,
  Minus,
  UtensilsCrossed,
  ShoppingCart,
  ListOrdered,
  Bell,
  LayoutGrid,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import BillSplitter from '@/components/restaurant/BillSplitter';
import { BillSplitModal } from '@/components/restaurant/BillSplitModal';
import CloseBillModal from '@/components/restaurant/CloseBillModal';
import { useApp } from '@/context/AppContext';
import { useRestaurantOrder } from '@/hooks/useRestaurantOrder';
import { useUpsellRules } from '@/hooks/useUpsellRules';
import { supabase } from '@/utils/supabaseClient';
import type {
  RestaurantTable,
  TableOrder,
  RestaurantOrderItem,
  RestaurantSettings,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantModifierGroup,
  RestaurantModifier,
  CourseType,
  SplitType,
  BillSplitPart,
  PendingOrder,
  PendingOrderItem,
  TableOrderExtended,
} from '@/types/restaurant';
import { COURSE_LABELS } from '@/types/restaurant';

type DetailTab = 'orders' | 'bill' | 'notes';
type MainTab = 'tables' | 'orders' | 'queue' | 'pending';
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
  unsentItemCount: number;
}

// ── Table Tile ────────────────────────────────────────────────────────────────

interface TableTileProps {
  data: TableWithOrder;
  slowThreshold: number;
  onSelect: () => void;
  onMarkAvailable?: (tableId: string) => Promise<void>;
}

function TableTile({ data, slowThreshold, onSelect, onMarkAvailable }: TableTileProps) {
  const { t } = useTranslation();
  const { table, order, items, pendingCount, unsentItemCount } = data;
  const minutes = order ? minutesSince(order.opened_at) : 0;
  const isSlowService = order && minutes > slowThreshold;
  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const isCleaning = table.status === 'cleaning';

  const tileStyle = (() => {
    if (isCleaning) return 'border-slate-500/30 bg-slate-500/10';
    if (!order) return 'border-white/10 bg-white/3';
    if (pendingCount > 0) return 'border-amber-500/50 bg-amber-500/10 animate-pulse-subtle';
    if (isSlowService) return 'border-orange-500/40 bg-orange-500/8';
    return 'border-indigo-500/30 bg-indigo-500/10';
  })();

  const dotColor = (() => {
    if (isCleaning) return 'bg-slate-500';
    if (!order) return 'bg-slate-600';
    if (pendingCount > 0) return 'bg-amber-400 animate-pulse';
    if (isSlowService) return 'bg-orange-400 animate-pulse';
    return 'bg-indigo-400';
  })();

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-4 transition-all ${tileStyle}`}
      style={{ minHeight: 120 }}
    >
      {/* Status dot */}
      <div className={`absolute right-3 top-3 h-3 w-3 rounded-full ${dotColor}`} aria-hidden="true" />

      {/* Cleaning overlay */}
      {isCleaning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-slate-900/60 backdrop-blur-[2px]">
          <Sparkles className="mb-1.5 h-5 w-5 text-slate-400" aria-hidden="true" />
          <span className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t('restaurant.status.cleaning', 'Cleaning')}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void onMarkAvailable?.(table.id);
            }}
            className="rounded-lg bg-emerald-600/80 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600 active:scale-95 transition-all touch-manipulation"
            aria-label={`Mark Table ${table.number} as available`}
          >
            <Check className="mr-1 inline h-3 w-3" />
            {t('restaurant.markReady', 'Ready')}
          </button>
        </div>
      )}

      {/* Clickable area for non-cleaning tables */}
      <button
        onClick={onSelect}
        disabled={isCleaning}
        className="absolute inset-0 rounded-2xl touch-manipulation"
        aria-label={`Table ${table.number} — ${table.status}`}
        tabIndex={isCleaning ? -1 : 0}
      />

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
              {pendingCount} {t('restaurant.tile.qrWaiting', 'QR waiting')}
            </div>
          )}
          {unsentItemCount > 0 && (
            <div className="rounded-lg bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
              {unsentItemCount} {t('restaurant.tile.unsentItems', 'unsent')}
            </div>
          )}
        </div>
      ) : (
        !isCleaning && (
          <div className="mt-auto text-xs text-white/30">{t('restaurant.available', 'Available')}</div>
        )
      )}
    </div>
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

// ── Quick Add Modal ───────────────────────────────────────────────────────────

interface ModifierGroupWithModifiers extends RestaurantModifierGroup {
  modifiers_list: RestaurantModifier[];
}

interface QuickAddModalProps {
  item: RestaurantMenuItem;
  currentOrderItemIds: string[];
  allMenuItems: RestaurantMenuItem[];
  tenantId: string | null | undefined;
  onClose: () => void;
  onConfirm: (qty: number, notes: string, unitPrice: number, modifiers: Array<{ name: string; price_delta: number }>) => void;
  onUpsellAdd?: (item: RestaurantMenuItem, qty: number) => void;
}

function QuickAddModal({
  item,
  currentOrderItemIds,
  allMenuItems,
  tenantId,
  onClose,
  onConfirm,
  onUpsellAdd,
}: QuickAddModalProps) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupWithModifiers[]>([]);
  // selectedModifiers: groupId → array of modifier ids
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [loadingModifiers, setLoadingModifiers] = useState(false);
  const { suggestion } = useUpsellRules(tenantId, currentOrderItemIds, allMenuItems);

  // Fetch modifier groups for this menu item
  useEffect(() => {
    if (!tenantId || !item.id) return;
    const fetch = async () => {
      setLoadingModifiers(true);
      try {
        // Step 1: get modifier group ids linked to this menu item
        const { data: links } = await supabase
          .from('restaurant_menu_item_modifier_groups')
          .select('modifier_group_id')
          .eq('menu_item_id', item.id)
          .eq('tenant_id', tenantId);

        if (!links || links.length === 0) {
          setModifierGroups([]);
          return;
        }

        const groupIds = (links as Array<{ modifier_group_id: string }>).map((l) => l.modifier_group_id);

        // Step 2: fetch the groups
        const { data: groups } = await supabase
          .from('restaurant_modifier_groups')
          .select('*')
          .in('id', groupIds)
          .eq('tenant_id', tenantId)
          .order('name');

        if (!groups || groups.length === 0) {
          setModifierGroups([]);
          return;
        }

        // Step 3: fetch all modifiers for those groups
        const { data: modifiers } = await supabase
          .from('restaurant_modifiers')
          .select('*')
          .in('group_id', groupIds)
          .eq('tenant_id', tenantId)
          .order('sort_order');

        const modifiersByGroup: Record<string, RestaurantModifier[]> = {};
        if (modifiers) {
          (modifiers as RestaurantModifier[]).forEach((m) => {
            if (!modifiersByGroup[m.group_id]) modifiersByGroup[m.group_id] = [];
            (modifiersByGroup[m.group_id] ??= []).push(m);
          });
        }

        const combined: ModifierGroupWithModifiers[] = (groups as RestaurantModifierGroup[]).map((g) => ({
          ...g,
          modifiers_list: modifiersByGroup[g.id] ?? [],
        }));

        setModifierGroups(combined);

        // Auto-select defaults for single-option required groups
        const defaults: Record<string, string[]> = {};
        combined.forEach((g) => {
          if (g.is_required && g.max_selections === 1 && g.modifiers_list.length === 1) {
            const firstId = g.modifiers_list[0]?.id;
            if (firstId) defaults[g.id] = [firstId];
          }
        });
        if (Object.keys(defaults).length > 0) setSelectedModifiers(defaults);
      } catch (err) {
        console.error('[QuickAddModal] modifier fetch error:', err);
      } finally {
        setLoadingModifiers(false);
      }
    };
    void fetch();
  }, [item.id, tenantId]);

  const toggleModifier = (group: ModifierGroupWithModifiers, modifierId: string) => {
    setSelectedModifiers((prev) => {
      const current = prev[group.id] ?? [];
      if (group.max_selections === 1) {
        // Radio — toggle off if same, otherwise replace
        return { ...prev, [group.id]: current[0] === modifierId ? [] : [modifierId] };
      }
      // Checkbox — add/remove, respecting max
      if (current.includes(modifierId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== modifierId) };
      }
      if (current.length >= group.max_selections) return prev; // at max
      return { ...prev, [group.id]: [...current, modifierId] };
    });
  };

  // Compute whether all required groups have selections
  const requiredGroupsMet = modifierGroups
    .filter((g) => g.is_required || g.min_selections > 0)
    .every((g) => (selectedModifiers[g.id] ?? []).length >= Math.max(1, g.min_selections));

  // Compute selected modifier objects and price delta
  const allSelectedModifiers: RestaurantModifier[] = modifierGroups.flatMap((g) =>
    (selectedModifiers[g.id] ?? []).map((id) => g.modifiers_list.find((m) => m.id === id)).filter((m): m is RestaurantModifier => m !== undefined),
  );
  const modifierPriceDelta = allSelectedModifiers.reduce((sum, m) => sum + m.price_delta, 0);
  const unitPrice = item.base_price_usd + modifierPriceDelta;

  const handleConfirm = () => {
    const notesWithModifiers = [
      allSelectedModifiers.map((m) => m.name).join(', '),
      notes,
    ].filter(Boolean).join(' · ');

    const modifierPayload = allSelectedModifiers.map((m) => ({ name: m.name, price_delta: m.price_delta }));
    onConfirm(qty, notesWithModifiers, unitPrice, modifierPayload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-slate-900 p-5 pb-safe max-h-[90dvh] overflow-y-auto">
        {/* Item header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">{item.name}</h3>
            {item.name_ar && <p className="text-sm text-white/40" dir="rtl">{item.name_ar}</p>}
            <p className="mt-0.5 text-lg font-black text-emerald-400">${unitPrice.toFixed(2)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-white/40 hover:bg-white/10 transition-all"
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Allergens */}
        {item.allergens.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {item.allergens.map((a) => (
              <span key={a} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/60">
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Modifier groups */}
        {loadingModifiers ? (
          <div className="mb-4 flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-indigo-400" />
          </div>
        ) : modifierGroups.length > 0 && (
          <div className="mb-4 space-y-4">
            {modifierGroups.map((group) => {
              const selected = selectedModifiers[group.id] ?? [];
              const isRequired = group.is_required || group.min_selections > 0;
              const isSatisfied = !isRequired || selected.length >= Math.max(1, group.min_selections);
              return (
                <div key={group.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                      {group.name}
                    </span>
                    {isRequired && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${isSatisfied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {t('restaurant.modifier.required', 'required')}
                      </span>
                    )}
                    {group.max_selections > 1 && (
                      <span className="ml-auto text-[9px] text-white/30">
                        {t('restaurant.modifier.selectUpTo', 'up to {{n}}', { n: group.max_selections })}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.modifiers_list.map((mod) => {
                      const isSelected = selected.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          onClick={() => toggleModifier(group, mod.id)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
                            isSelected
                              ? 'border-indigo-500/70 bg-indigo-600/30 text-white'
                              : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 flex-none" />}
                          <span>{mod.name}</span>
                          {mod.price_delta > 0 && (
                            <span className={`${isSelected ? 'text-emerald-300' : 'text-emerald-400/70'}`}>
                              +${mod.price_delta.toFixed(2)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quantity stepper */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-white/40">
            {t('restaurant.quantity', 'Quantity')}
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white active:scale-95 transition-all"
              aria-label="Decrease quantity"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="w-12 text-center text-2xl font-black text-white">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white active:scale-95 transition-all"
              aria-label="Increase quantity"
            >
              <Plus className="h-5 w-5" />
            </button>
            <span className="ml-2 text-sm text-white/40">= ${(unitPrice * qty).toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-white/40">
            {t('restaurant.specialNotes', 'Special Notes')}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('restaurant.notesPlaceholder', 'e.g. no onions, extra spicy…')}
            className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
            autoComplete="off"
          />
        </div>

        {/* AI Upsell Banner */}
        {suggestion && suggestion.suggestedItem && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-3"
          >
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 flex-none text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-400">
                  💡 {t('restaurant.upsell.suggestion', 'Guests who order {{item}} also love {{suggestion}}', {
                    item: item.name,
                    suggestion: suggestion.suggestedItem.name,
                  })}
                </p>
                <p className="mt-1 text-xs text-amber-300/80">${suggestion.suggestedItem.base_price_usd.toFixed(2)}</p>
              </div>
              <button
                onClick={() => {
                  onUpsellAdd?.(suggestion.suggestedItem!, 1);
                  void onClose();
                }}
                className="flex-none rounded-lg bg-amber-500/30 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/40 transition-all active:scale-95"
              >
                {t('restaurant.upsell.addToOrder', 'Add')}
              </button>
            </div>
          </motion.div>
        )}

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          disabled={!requiredGroupsMet}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 py-4 text-sm font-bold text-white active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
          {t('restaurant.addToOrder', 'Add to Order')} · ${(unitPrice * qty).toFixed(2)}
        </button>
        {!requiredGroupsMet && (
          <p className="mt-2 text-center text-xs text-red-400">
            {t('restaurant.modifier.pleaseSelect', 'Please complete all required selections')}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Menu Browser Sheet ────────────────────────────────────────────────────────

interface MenuBrowserSheetProps {
  categories: RestaurantMenuCategory[];
  items: RestaurantMenuItem[];
  onClose: () => void;
  onSelect: (item: RestaurantMenuItem) => void;
}

function MenuBrowserSheet({ categories, items, onClose, onSelect }: MenuBrowserSheetProps) {
  const { t } = useTranslation();
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');

  const displayed = items.filter((i) => {
    if (!i.is_active) return false;
    if (selectedCat !== 'all' && i.category_id !== selectedCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !(i.name_ar ?? '').includes(search)) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950">
      {/* Header */}
      <div className="flex-none border-b border-white/10 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="text-base font-bold text-white">{t('restaurant.menu', 'Menu')}</h2>
          <span className="ml-auto rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">{displayed.length}</span>
        </div>
        {/* Search */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <Search className="h-4 w-4 flex-none text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('restaurant.searchMenu', 'Search menu…')}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"
            autoComplete="off"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-white/30 hover:text-white/60">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex-none overflow-x-auto border-b border-white/10 bg-slate-900">
        <div className="flex gap-2 px-4 pb-3 pt-2" style={{ width: 'max-content' }}>
          <button
            onClick={() => setSelectedCat('all')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
              selectedCat === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/15'
            }`}
          >
            {t('common.all', 'All')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCat === cat.id
                  ? 'bg-amber-500/80 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Item grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <UtensilsCrossed className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">{t('restaurant.noItemsFound', 'No items found')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {displayed.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                disabled={!!item.is_eighty_sixd}
                className={`relative flex flex-col rounded-2xl border text-start transition-all active:scale-95 ${
                  item.is_eighty_sixd
                    ? 'cursor-not-allowed border-white/5 bg-white/3 opacity-50'
                    : 'border-white/10 bg-white/5 hover:border-amber-500/30 hover:bg-white/8'
                }`}
              >
                {/* Photo / placeholder */}
                <div className="relative h-24 w-full overflow-hidden rounded-t-2xl bg-white/5">
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl opacity-30">🍽️</div>
                  )}
                  {item.is_eighty_sixd && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-black text-red-400 uppercase tracking-widest">
                      86&apos;d
                    </div>
                  )}
                  {item.is_featured && !item.is_eighty_sixd && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">⭐</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col p-2.5">
                  <p className="text-xs font-semibold leading-tight text-white line-clamp-2">{item.name}</p>
                  {item.name_ar && (
                    <p className="mt-0.5 text-[10px] text-white/40 line-clamp-1" dir="rtl">{item.name_ar}</p>
                  )}
                  <p className="mt-1.5 text-sm font-black text-emerald-400">${item.base_price_usd.toFixed(2)}</p>
                  {item.allergens.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {item.allergens.slice(0, 3).map((a) => (
                        <span key={a} className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/50">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Table Detail (full-screen overlay) ───────────────────────────────────────

interface TableDetailProps {
  tableData: TableWithOrder;
  settings: RestaurantSettings | null;
  menuCategories: RestaurantMenuCategory[];
  menuItems: RestaurantMenuItem[];
  onClose: () => void;
  onOrderClosed: () => void;
}

function TableDetail({ tableData, settings, menuCategories, menuItems, onClose, onOrderClosed }: TableDetailProps) {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const { table, order } = tableData;
  const tenantId = currentTenant?.id;

  const {
    order: _hookOrder,
    items,
    pendingOrders,
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
  } = useRestaurantOrder(table.id, order?.id ?? null);

  const [activeTab, setActiveTab] = useState<DetailTab>('orders');
  const [selectedPendingOrder, setSelectedPendingOrder] = useState<PendingOrder | null>(null);

  // Menu browser state
  const [showMenuBrowser, setShowMenuBrowser] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<RestaurantMenuItem | null>(null);

  // Bill state
  const [tipInput, setTipInput] = useState('0');
  const [discountInput, setDiscountInput] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [_closingBill, setClosingBill] = useState(false);
  const [showCloseBillModal, setShowCloseBillModal] = useState(false);
  const [splitBillOpen, setSplitBillOpen] = useState(false);

  // Split state
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [equalCount, setEqualCount] = useState(2);
  const [byItemAssignments, setByItemAssignments] = useState<Record<string, string[]>>({});

  // Notes state
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  // Phase 0 Feature 1: Send to Kitchen
  // Only count items that are truly unsent (pending AND sent_at is null)
  const unsentItems = items.filter((i) => i.status === 'pending' && i.sent_at === null);
  const [sendingKitchen, setSendingKitchen] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  const handleSendToKitchen = async () => {
    if (unsentItems.length === 0) return;
    setSendingKitchen(true);
    try {
      await sendToKitchen();
      toast.success(t('restaurant.sentToKitchen', `Sent ${unsentItems.length} item${unsentItems.length > 1 ? 's' : ''} to kitchen`));
      setSentOk(true);
      setTimeout(() => setSentOk(false), 1500);
    } catch (err) {
      console.error('[Send to Kitchen] error:', err);
      toast.error(t('common.error', 'Error sending to kitchen'));
    } finally {
      setSendingKitchen(false);
    }
  };

  const splits: BillSplitPart[] = (() => {
    if (splitType === 'equal') return splitEqual(equalCount);
    if (splitType === 'by_seat') return splitBySeat(table.seats);
    return splitByItem(byItemAssignments);
  })();

  const _handleCloseBill = async () => {
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

  // Called by CloseBillModal after tip & discount have already been persisted.
  // Receives the already-mapped payment method string (cash/card/other).
  const handleCloseBillConfirm = async (mappedPaymentMethod: string) => {
    if (!order?.id) return;
    // closeBill calls fn_close_restaurant_bill(p_order_id, p_payment_method)
    // which reads tip/discount from the order row — already updated by the modal
    await closeBill(mappedPaymentMethod);
    setShowCloseBillModal(false);
    onOrderClosed();
    onClose();
  };

  const handleSaveNotes = async () => {
    if (!order?.id || !tenantId) return;
    setSavingNotes(true);
    await supabase.from('table_orders').update({ notes }).eq('id', order.id).eq('tenant_id', tenantId);
    setSavingNotes(false);
    toast.success(t('restaurant.notesSaved', 'Notes saved'));
  };

  const handlePrint = (split: BillSplitPart) => {
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

                {/* Add item via menu browser */}
                <button
                  onClick={() => setShowMenuBrowser(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-500/30 bg-indigo-500/5 py-4 text-sm font-semibold text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 active:scale-[0.98] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  {t('restaurant.addFromMenu', 'Add from Menu')}
                </button>

                {/* Phase 0 Feature 1: Send to Kitchen — primary action after adding items */}
                {unsentItems.length > 0 && (
                  <button
                    onClick={() => { void handleSendToKitchen(); }}
                    disabled={sendingKitchen || sentOk}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black text-white transition-all active:scale-95 disabled:opacity-60 ${
                      sentOk
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90'
                    }`}
                  >
                    {sentOk ? (
                      <>
                        <Check className="h-5 w-5" />
                        {t('restaurant.sentKitchen', 'Sent ✓')}
                      </>
                    ) : sendingKitchen ? (
                      <>
                        <Flame className="h-5 w-5 animate-pulse" />
                        {t('restaurant.sendingKitchen', 'Sending...')}
                      </>
                    ) : (
                      <>
                        <Flame className="h-5 w-5" />
                        {t('restaurant.sendKitchen', 'Send to Kitchen')}
                        <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-sm font-bold">
                          {unsentItems.length}
                        </span>
                      </>
                    )}
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

            {/* Split Bill + Close Bill actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setSplitBillOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 py-4 text-sm font-black text-white transition-all hover:bg-violet-500 active:scale-95"
              >
                <Users className="h-4 w-4" />
                {t('restaurant.bill.split', 'Split Bill')}
              </button>
              <button
                onClick={() => setShowCloseBillModal(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-sm font-black text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                <Receipt className="h-4 w-4" />
                {t('restaurant.bill.closePrint', 'Close & Print')}
              </button>
            </div>
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

      {/* Close Bill Modal */}
      {showCloseBillModal && order && (
        <CloseBillModal
          tableNumber={table.number}
          tableId={table.id}
          order={order as TableOrderExtended}
          items={items}
          onUpdateTip={updateTip}
          onUpdateDiscount={updateDiscount}
          onConfirm={handleCloseBillConfirm}
          onClose={() => setShowCloseBillModal(false)}
        />
      )}

      {/* Split Bill Modal */}
      <BillSplitModal
        isOpen={splitBillOpen}
        onClose={() => setSplitBillOpen(false)}
        tableNumber={table.number}
        items={items}
        totals={totals}
        splitEqual={splitEqual}
        splitBySeat={splitBySeat}
        splitByItem={splitByItem}
        saveBillSplit={saveBillSplit}
        onConfirm={() => setSplitBillOpen(false)}
      />

      {/* Menu browser */}
      {showMenuBrowser && (
        <MenuBrowserSheet
          categories={menuCategories}
          items={menuItems}
          onClose={() => setShowMenuBrowser(false)}
          onSelect={(item) => {
            setSelectedMenuItem(item);
            setShowMenuBrowser(false);
          }}
        />
      )}

      {/* Quick add modal */}
      {selectedMenuItem && (
        <QuickAddModal
          item={selectedMenuItem}
          currentOrderItemIds={items.map((i) => i.menu_item_id).filter((id): id is string => id !== null && id !== selectedMenuItem.id)}
          allMenuItems={menuItems}
          tenantId={tenantId}
          onClose={() => setSelectedMenuItem(null)}
          onConfirm={(qty, notes, unitPrice, modifiers) => {
            void addItem({
              product_name: selectedMenuItem.name,
              quantity: qty,
              unit_price: unitPrice,
              course: 'mains',
              notes: notes || undefined,
              menu_item_id: selectedMenuItem.id,
              modifiers,
            });
          }}
          onUpsellAdd={(upsellItem) => {
            void addItem({
              product_name: upsellItem.name,
              quantity: 1,
              unit_price: upsellItem.base_price_usd,
              course: 'mains',
              menu_item_id: upsellItem.id,
            });
          }}
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

  // ── State ──────────────────────────────────────────────────────────────────
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<TableOrder[]>([]);
  const [allItems, setAllItems] = useState<RestaurantOrderItem[]>([]);
  const [pendingOrderCounts, setPendingOrderCounts] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [menuCategories, setMenuCategories] = useState<RestaurantMenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<RestaurantMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [filterSection, setFilterSection] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Thumb-zone bottom navigation tab
  const [activeTab, setActiveTab] = useState<MainTab>('tables');

  // Tab-specific state
  const [queueItems, setQueueItems] = useState<RestaurantOrderItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [selectedPendingOrder, setSelectedPendingOrder] = useState<PendingOrder | null>(null);
  const [queueRefreshing, setQueueRefreshing] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [tRes, oRes, oiRes, poRes, sRes, catRes, miRes] = await Promise.all([
        supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId).order('number'),
        supabase.from('table_orders').select('*').eq('tenant_id', tenantId).eq('status', 'open'),
        supabase.from('restaurant_order_items').select('*').eq('tenant_id', tenantId).neq('status', 'served'),
        supabase.from('restaurant_pending_orders').select('table_id').eq('tenant_id', tenantId).eq('status', 'pending'),
        supabase.from('restaurant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
        supabase.from('restaurant_menu_categories').select('*').eq('tenant_id', tenantId).order('sort_order'),
        supabase.from('restaurant_menu_items').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order'),
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
      if (catRes.data) setMenuCategories(catRes.data as RestaurantMenuCategory[]);
      if (miRes.data) setMenuItems(miRes.data as RestaurantMenuItem[]);
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

  const markTableAvailable = useCallback(async (tableId: string) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from('restaurant_tables')
      .update({ status: 'available' })
      .eq('id', tableId)
      .eq('tenant_id', tenantId);
    if (error) { toast.error(error.message); return; }
    // Optimistic local update
    setTables((prev) => prev.map((tbl) => tbl.id === tableId ? { ...tbl, status: 'available' } : tbl));
    toast.success(t('restaurant.tableReady', 'Table marked as available'));
  }, [tenantId, t]);

  // Load queue items when queue tab is active
  useEffect(() => {
    if (activeTab !== 'queue') return;
    if (!tenantId) return;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('restaurant_order_items')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'in_progress')
          .order('sent_at', { ascending: true });
        if (data) setQueueItems(data as RestaurantOrderItem[]);
      } catch (err) {
        console.error('[WaiterInterface] queue fetch error:', err);
      }
    };
    void fetch();
  }, [activeTab, tenantId]);

  const handleQueueRefresh = async () => {
    if (!tenantId) return;
    setQueueRefreshing(true);
    try {
      const { data } = await supabase
        .from('restaurant_order_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'in_progress')
        .order('sent_at', { ascending: true });
      if (data) setQueueItems(data as RestaurantOrderItem[]);
    } catch (err) {
      console.error('[WaiterInterface] queue refresh error:', err);
    } finally {
      setQueueRefreshing(false);
    }
  };

  // Load full pending orders when pending tab is active
  useEffect(() => {
    if (activeTab !== 'pending') return;
    if (!tenantId) return;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('restaurant_pending_orders')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        if (data) setPendingOrders(data as PendingOrder[]);
      } catch (err) {
        console.error('[WaiterInterface] pending fetch error:', err);
      }
    };
    void fetch();
  }, [activeTab, tenantId]);

  const handleConfirmPendingOrder = async (order: PendingOrder, editedItems: PendingOrderItem[]) => {
    if (!tenantId) return;
    try {
      const tableOrder = orders.find((o) => o.table_id === order.table_id);
      if (!tableOrder) {
        toast.error(t('restaurant.pending.noOpenOrder', 'No open order for this table'));
        return;
      }
      const now = new Date().toISOString();
      const itemRows = editedItems.map((item) => ({
        tenant_id: tenantId,
        order_id: tableOrder.id,
        table_id: order.table_id,
        product_name: item.name,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        course: item.course,
        notes: item.notes || null,
        modifiers: item.modifiers,
        status: 'pending' as const,
        sent_at: null,
      }));
      const { error: insErr } = await supabase.from('restaurant_order_items').insert(itemRows);
      if (insErr) throw insErr;
      const { error: updErr } = await supabase
        .from('restaurant_pending_orders')
        .update({ status: 'confirmed', confirmed_at: now })
        .eq('id', order.id)
        .eq('tenant_id', tenantId);
      if (updErr) throw updErr;
      setPendingOrders((prev) => prev.filter((p) => p.id !== order.id));
      setPendingOrderCounts((prev) => {
        const next = { ...prev };
        next[order.table_id] = Math.max(0, (next[order.table_id] ?? 1) - 1);
        return next;
      });
      toast.success(t('restaurant.pending.confirmed', 'Order confirmed'));
    } catch (err) {
      console.error('[WaiterInterface] confirm pending error:', err);
      toast.error(t('common.error', 'Failed to confirm order'));
    }
  };

  const handleRejectPendingOrder = async (order: PendingOrder) => {
    if (!tenantId) return;
    try {
      const { error } = await supabase
        .from('restaurant_pending_orders')
        .update({ status: 'rejected' })
        .eq('id', order.id)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      setPendingOrders((prev) => prev.filter((p) => p.id !== order.id));
      setPendingOrderCounts((prev) => {
        const next = { ...prev };
        next[order.table_id] = Math.max(0, (next[order.table_id] ?? 1) - 1);
        return next;
      });
      toast.success(t('restaurant.pending.rejected', 'Order rejected'));
    } catch (err) {
      console.error('[WaiterInterface] reject pending error:', err);
      toast.error(t('common.error', 'Failed to reject order'));
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const tableDataList: TableWithOrder[] = tables
    .filter((tbl) => filterSection === 'all' || tbl.section === filterSection)
    .map((table) => {
      const order = orders.find((o) => o.table_id === table.id) ?? null;
      const items = order ? allItems.filter((i) => i.order_id === order.id) : [];
      const unsentItemCount = items.filter((i) => i.sent_at === null && i.status === 'pending').length;
      return {
        table,
        order,
        items,
        pendingCount: pendingOrderCounts[table.id] ?? 0,
        unsentItemCount,
      };
    });

  const selectedTableData = tableDataList.find((d) => d.table.id === selectedTableId) ?? null;
  const sections = ['all', ...Array.from(new Set(tables.map((tbl) => tbl.section)))];
  const slowThreshold = settings?.slow_service_threshold_minutes ?? 15;

  const occupiedCount = tables.filter((tbl) => tbl.status === 'occupied').length;
  const totalPending = Object.values(pendingOrderCounts).reduce((a, b) => a + b, 0);

  // ── Bottom nav tab definitions ─────────────────────────────────────────────
  const mainTabs: Array<{
    key: MainTab;
    label: string;
    icon: typeof LayoutGrid;
    badge?: number;
  }> = [
    { key: 'tables', label: t('restaurant.nav.tables', 'Tables'), icon: LayoutGrid },
    { key: 'orders', label: t('restaurant.nav.orders', 'Orders'), icon: ShoppingCart, badge: orders.length || undefined },
    { key: 'queue', label: t('restaurant.nav.queue', 'Queue'), icon: ListOrdered },
    { key: 'pending', label: t('restaurant.nav.pending', 'Pending'), icon: Bell, badge: totalPending || undefined },
  ];

  // ── Tab content ────────────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'tables':
        return (
          <motion.div
            key="tables"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col"
          >
            {/* Section filter — only rendered when there are multiple sections */}
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
            <div className="p-4">
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
                      onMarkAvailable={markTableAvailable}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'orders': {
        const openOrders = orders.map((order) => {
          const table = tables.find((tbl) => tbl.id === order.table_id);
          const items = allItems.filter((i) => i.order_id === order.id);
          const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
          const mins = minutesSince(order.opened_at);
          return { order, table, items, subtotal, mins };
        });
        return (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col"
          >
            <div className="flex-none border-b border-white/10 bg-slate-900 px-4 py-3">
              <p className="text-xs text-white/40">
                {openOrders.length} {t('restaurant.orders.openTables', 'open tables')}
              </p>
            </div>
            <div className="p-4 space-y-3">
              {openOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <ShoppingCart className="mb-3 h-10 w-10 text-white/20" />
                  <p className="text-sm text-white/40">{t('restaurant.orders.none', 'No open orders')}</p>
                </div>
              ) : (
                openOrders.map(({ order, table, items, subtotal, mins }) => {
                  const cardStyle =
                    mins < 30
                      ? 'border-indigo-500/30 bg-indigo-500/10'
                      : mins < 60
                        ? 'border-amber-500/30 bg-amber-500/10'
                        : 'border-red-500/30 bg-red-500/10';
                  const timeBg =
                    mins < 30
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : mins < 60
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-red-500/15 text-red-400';
                  return (
                    <button
                      key={order.id}
                      onClick={() => {
                        if (table) setSelectedTableId(table.id);
                        setActiveTab('tables');
                      }}
                      className={`w-full rounded-2xl border p-4 text-start transition-all active:scale-[0.98] ${cardStyle}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-white">
                            {table?.number ?? '—'}
                          </span>
                          {table?.name && (
                            <span className="text-xs text-white/40">{table.name}</span>
                          )}
                          {table?.section && (
                            <span className="rounded-lg bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50 capitalize">
                              {table.section}
                            </span>
                          )}
                        </div>
                        <div className="text-end">
                          <p className="text-base font-black text-white">${subtotal.toFixed(2)}</p>
                          <p className="text-[10px] text-white/40">
                            {items.length} {t('restaurant.orders.items', 'items')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${timeBg}`}>
                          <Clock className="h-3 w-3" />
                          {mins}m
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            order.status === 'open'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-white/10 text-white/50'
                          }`}
                        >
                          {order.status}
                        </span>
                        <ChevronRight className="ml-auto h-4 w-4 text-white/30" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        );
      }

      case 'queue': {
        const grouped = queueItems.reduce<Record<string, RestaurantOrderItem[]>>((acc, item) => {
          const key = item.order_id;
          if (!acc[key]) acc[key] = [];
          acc[key]!.push(item);
          return acc;
        }, {});
        return (
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col"
          >
            <div className="flex-none border-b border-white/10 bg-slate-900 px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-white/40">
                {queueItems.length} {t('restaurant.queue.itemsInProgress', 'items in progress')}
              </p>
              <button
                onClick={() => { void handleQueueRefresh(); }}
                disabled={queueRefreshing}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/10 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${queueRefreshing ? 'animate-spin' : ''}`} />
                {t('common.refresh', 'Refresh')}
              </button>
            </div>
            <div className="p-4 space-y-4">
              {queueItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <ListOrdered className="mb-3 h-10 w-10 text-white/20" />
                  <p className="text-sm text-white/40">{t('restaurant.queue.empty', 'No items in progress')}</p>
                </div>
              ) : (
                Object.entries(grouped).map(([orderId, groupedItems]) => {
                  const order = orders.find((o) => o.id === orderId);
                  const table = order ? tables.find((tbl) => tbl.id === order.table_id) : null;
                  return (
                    <div key={orderId} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2.5">
                        <span className="text-sm font-black text-white">
                          {t('restaurant.tableNum', 'Table')} {table?.number ?? '—'}
                        </span>
                        {table?.section && (
                          <span className="rounded-lg bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50 capitalize">
                            {table.section}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-white/40">
                          {groupedItems.length} {t('restaurant.queue.items', 'items')}
                        </span>
                      </div>
                      <div className="divide-y divide-white/5">
                        {groupedItems.map((item) => {
                          const sentMins = item.sent_at ? minutesSince(item.sent_at) : 0;
                          const timeColor =
                            sentMins < 8
                              ? 'text-emerald-400'
                              : sentMins < 15
                                ? 'text-amber-400'
                                : 'text-red-400';
                          return (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white">
                                  {item.quantity}× {item.product_name}
                                </p>
                                {item.notes && (
                                  <p className="mt-0.5 text-xs text-amber-400">{item.notes}</p>
                                )}
                                {item.modifiers && item.modifiers.length > 0 && (
                                  <p className="mt-0.5 text-xs text-white/40">
                                    {(item.modifiers as Array<{ name: string }>).map((m) => m.name).join(', ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className={`h-3.5 w-3.5 ${timeColor}`} />
                                <span className={`text-xs font-bold ${timeColor}`}>{sentMins}m</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        );
      }

      case 'pending': {
        return (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col"
          >
            <div className="flex-none border-b border-white/10 bg-slate-900 px-4 py-3">
              <p className="text-xs text-white/40">
                {pendingOrders.length} {t('restaurant.pending.waiting', 'orders waiting')}
              </p>
            </div>
            <div className="p-4 space-y-3">
              {pendingOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Bell className="mb-3 h-10 w-10 text-white/20" />
                  <p className="text-sm text-white/40">{t('restaurant.pending.none', 'No pending QR orders')}</p>
                </div>
              ) : (
                pendingOrders.map((po) => {
                  const table = tables.find((tbl) => tbl.id === po.table_id);
                  const mins = minutesSince(po.created_at);
                  const subtotal = po.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
                  return (
                    <div
                      key={po.id}
                      className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-white">
                            {table
                              ? `${t('restaurant.tableNum', 'Table')} ${table.number}`
                              : t('restaurant.walkIn', 'Walk-in')}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-white/50">
                            <Clock className="h-3 w-3" />
                            {mins}m {t('common.ago', 'ago')}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-black text-white">${subtotal.toFixed(2)}</p>
                          <p className="text-[10px] text-white/40">
                            {po.items.length} {t('restaurant.orders.items', 'items')}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {po.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-white/80">{item.quantity}×</span>
                            <span className="flex-1 text-white/70">{item.name}</span>
                            <span className="text-white/40">${(item.unit_price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { void handleRejectPendingOrder(po); }}
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all active:scale-95"
                        >
                          <X className="mr-1 inline h-3.5 w-3.5" />
                          {t('restaurant.pendingOrder.reject', 'Reject')}
                        </button>
                        <button
                          onClick={() => setSelectedPendingOrder(po)}
                          className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2 text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
                        >
                          <Check className="mr-1 inline h-3.5 w-3.5" />
                          {t('restaurant.pendingOrder.confirmAll', 'Confirm')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {selectedPendingOrder && (
              <PendingOrderModal
                pendingOrder={selectedPendingOrder}
                onConfirm={(editedItems) => handleConfirmPendingOrder(selectedPendingOrder, editedItems)}
                onReject={() => handleRejectPendingOrder(selectedPendingOrder)}
                onClose={() => setSelectedPendingOrder(null)}
              />
            )}
          </motion.div>
        );
      }
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* ── Fixed top bar ── */}
      <header className="flex-none border-b border-white/10 bg-slate-900 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: back + identity */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => { void navigate(-1); }}
              whileTap={{ scale: 0.9 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
              aria-label={t('common.back', 'Back')}
            >
              <ArrowLeft className="h-4 w-4" />
            </motion.button>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500">
              <span className="text-xs font-black text-white">
                {currentEmployee?.name?.slice(0, 2).toUpperCase() ?? 'W'}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                {currentTenant?.name ?? t('restaurant.restaurant', 'Restaurant')}
              </p>
              <p className="text-[10px] text-white/40">
                {currentEmployee?.name ?? t('restaurant.waiter', 'Waiter')}
              </p>
            </div>
          </div>

          {/* Right: clock + badges + refresh */}
          <div className="flex items-center gap-2">
            <div className="text-end">
              <p className="text-sm font-bold text-white">
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-[10px] text-white/40">
                {occupiedCount}/{tables.length} {t('restaurant.tablesOccupied', 'occupied')}
              </p>
            </div>

            {/* Pending QR badge */}
            {totalPending > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-amber-500 px-1.5 animate-bounce"
              >
                <span className="text-xs font-black text-white">{totalPending}</span>
              </motion.div>
            )}

            {/* Refresh */}
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

      {/* ── Scrollable main content area ── */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <AnimatePresence mode="wait">
          {renderTabContent()}
        </AnimatePresence>
      </main>

      {/* ── FAB — fixed above bottom nav ── */}
      <motion.button
        whileHover={{ scale: 1.08, boxShadow: '0 8px 32px rgba(99,102,241,0.45)' }}
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          // Navigate to active table detail, or switch to tables tab
          if (activeTab !== 'tables') {
            setActiveTab('tables');
          }
        }}
        className="fixed bottom-24 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 shadow-lg shadow-indigo-900/40 transition-shadow"
        aria-label={t('restaurant.fab.newOrder', 'New order')}
      >
        <Plus className="h-7 w-7 text-white" />
      </motion.button>

      {/* ── Fixed bottom navigation ── */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-slate-900 p-3">
        <div className="grid grid-cols-4 gap-2">
          {mainTabs.map(({ key, label, icon: Icon, badge }) => {
            const isActive = activeTab === key;
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.93 }}
                onClick={() => setActiveTab(key)}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[10px] font-semibold transition-all touch-manipulation ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                }`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="absolute right-2 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-white">
                    {badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* ── Table detail overlay ── */}
      {selectedTableId && selectedTableData && (
        <TableDetail
          tableData={selectedTableData}
          settings={settings}
          menuCategories={menuCategories}
          menuItems={menuItems}
          onClose={() => setSelectedTableId(null)}
          onOrderClosed={() => { void loadData(); }}
        />
      )}
    </div>
  );
}
