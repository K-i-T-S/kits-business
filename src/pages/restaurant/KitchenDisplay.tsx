import {
  ArrowLeft,
  ChefHat,
  RefreshCw,
  Settings,
  Maximize2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Flame,
  Lock,
  Star,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  X,
  WifiOff,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '@/context/AppContext';
import type {
  RestaurantOrderItem,
  TableOrder,
  RestaurantTable,
  KDSStation,
} from '@/types/restaurant';
import { COURSE_LABELS } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

// ── Types ─────────────────────────────────────────────────────

interface TicketData {
  order: TableOrder;
  table: RestaurantTable | null;
  items: RestaurantOrderItem[];
  isPriority: boolean;
}

// ── Age helpers ───────────────────────────────────────────────

function useElapsedSeconds(since: string): number {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(since).getTime()) / 1000),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(since).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [since]);
  return elapsed;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type AgeLevel = 'fresh' | 'warming' | 'hot' | 'critical';

function ageLevel(seconds: number): AgeLevel {
  if (seconds < 300) return 'fresh';
  if (seconds < 600) return 'warming';
  if (seconds < 900) return 'hot';
  return 'critical';
}

const AGE_BORDER: Record<AgeLevel, string> = {
  fresh: 'border-emerald-500/50',
  warming: 'border-amber-500/60',
  hot: 'border-orange-500/70',
  critical: 'border-red-500/80',
};

const AGE_GLOW: Record<AgeLevel, string> = {
  fresh: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]',
  warming: 'shadow-[0_0_14px_rgba(245,158,11,0.2)]',
  hot: 'shadow-[0_0_16px_rgba(249,115,22,0.25)]',
  critical: 'shadow-[0_0_20px_rgba(239,68,68,0.35)]',
};

const AGE_TEXT: Record<AgeLevel, string> = {
  fresh: 'text-emerald-400',
  warming: 'text-amber-400',
  hot: 'text-orange-400',
  critical: 'text-red-400',
};

// ── Station config modal ──────────────────────────────────────

interface StationConfigModalProps {
  stations: KDSStation[];
  tenantId: string;
  onClose: () => void;
  onSaved: (stations: KDSStation[]) => void;
}

const DEFAULT_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#ec4899',
];

function StationConfigModal({ stations, tenantId, onClose, onSaved }: StationConfigModalProps) {
  const { t } = useTranslation();
  const [local, setLocal] = useState<KDSStation[]>(stations);
  const [saving, setSaving] = useState(false);

  const addStation = () => {
    const newStation: KDSStation = {
      id: `new-${Date.now()}`,
      tenant_id: tenantId,
      name: '',
      name_ar: null,
      color: DEFAULT_COLORS[local.length % DEFAULT_COLORS.length] ?? '#6366f1',
      sort_order: local.length,
      is_active: true,
    };
    setLocal((prev) => [...prev, newStation]);
  };

  const removeStation = (id: string) => {
    setLocal((prev) => prev.filter((s) => s.id !== id));
  };

  const updateStation = (id: string, patch: Partial<KDSStation>) => {
    setLocal((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const toUpsert = local.map((s, i) => ({
        ...(s.id.startsWith('new-') ? {} : { id: s.id }),
        tenant_id: tenantId,
        name: s.name || t('restaurant.kds.newStation', 'New Station'),
        name_ar: s.name_ar,
        color: s.color,
        sort_order: i,
        is_active: s.is_active,
      }));

      const { data, error } = await supabase
        .from('restaurant_kds_stations')
        .upsert(toUpsert, { onConflict: 'id' })
        .select();

      if (error) throw error;
      onSaved((data as KDSStation[]) ?? local);
      toast.success(t('restaurant.kds.stationsSaved', 'Stations saved'));
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorSaving', 'Error saving'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-base font-bold text-white">
            {t('restaurant.kds.configureStations', 'Configure KDS Stations')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {local.map((station) => (
            <div
              key={station.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <input
                type="color"
                value={station.color}
                onChange={(e) => updateStation(station.id, { color: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
              />
              <input
                type="text"
                value={station.name}
                onChange={(e) => updateStation(station.id, { name: e.target.value })}
                placeholder={t('restaurant.kds.stationName', 'Station name')}
                className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="text"
                value={station.name_ar ?? ''}
                onChange={(e) => updateStation(station.id, { name_ar: e.target.value || null })}
                placeholder="اسم"
                dir="rtl"
                className="w-24 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => removeStation(station.id)}
                className="rounded-lg p-1.5 text-white/30 hover:bg-red-500/20 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 p-4 space-y-3">
          <button
            onClick={addStation}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-2.5 text-sm text-white/50 hover:border-indigo-500/50 hover:text-indigo-400 transition-all"
          >
            <Plus className="h-4 w-4" />
            {t('restaurant.kds.addStation', 'Add Station')}
          </button>
          <button
            onClick={() => { void save(); }}
            disabled={saving}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-all"
          >
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single KDS Ticket ─────────────────────────────────────────

interface TicketCardProps {
  ticket: TicketData;
  onBumpItem: (itemId: string) => void;
  onBumpAll: (orderId: string) => void;
  onTogglePriority: (orderId: string) => void;
  onBumpAllReady: (orderId: string) => void;
  onMarkAllReady: (orderId: string) => void;
  isOnline: boolean;
}

function TicketCard({
  ticket,
  onBumpItem,
  onBumpAll,
  onTogglePriority,
  onBumpAllReady,
  onMarkAllReady,
  isOnline,
}: TicketCardProps) {
  const { t } = useTranslation();
  const { order, table, items, isPriority } = ticket;
  const elapsed = useElapsedSeconds(order.opened_at);
  const level = ageLevel(elapsed);
  const pendingItems = items.filter((i) => i.status === 'pending' || i.status === 'in_progress');
  const inProgressItems = items.filter((i) => i.status === 'in_progress');
  const readyItems = items.filter((i) => i.status === 'ready');
  const [partial, setPartial] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const markSelected = () => {
    selected.forEach((id) => onBumpItem(id));
    setSelected(new Set());
    setPartial(false);
  };

  const groupedByCourse = items.reduce<Record<string, RestaurantOrderItem[]>>((acc, item) => {
    const key = item.course;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const courseCount = Object.keys(groupedByCourse).length;

  const borderClass = isPriority
    ? 'border-indigo-500/80 shadow-[0_0_24px_rgba(99,102,241,0.4)]'
    : `${AGE_BORDER[level]} ${AGE_GLOW[level]}`;

  const headerAnimate = level === 'critical' ? 'animate-pulse' : '';

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 bg-slate-900 overflow-hidden transition-all duration-300 ${borderClass}`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b border-white/10 px-4 py-3 ${headerAnimate} ${
          isPriority ? 'bg-indigo-600/20' : 'bg-white/5'
        }`}
      >
        <div className="flex items-center gap-2">
          {isPriority && <Star className="h-3.5 w-3.5 fill-indigo-400 text-indigo-400" />}
          <ChefHat className="h-4 w-4 text-white/50" />
          <span className="font-bold text-white text-sm">
            {t('restaurant.table', 'T')}{table?.number ?? '?'}
          </span>
          {table?.name && (
            <span className="text-xs text-white/40">{table.name}</span>
          )}
        </div>
        <div dir="ltr" className={`flex items-center gap-1.5 font-mono text-sm font-bold ${AGE_TEXT[level]}`}>
          <Clock className="h-3.5 w-3.5" />
          {formatElapsed(elapsed)}
        </div>
      </div>

      {/* Items grouped by course */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '20rem' }}>
        {Object.entries(groupedByCourse).map(([course, courseItems]) => {
          const isMains = course === 'mains';
          const courseFired =
            order.current_course === 'mains' || order.current_course === 'desserts';
          return (
            <div key={course}>
              {courseCount > 1 && (
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {COURSE_LABELS[course as keyof typeof COURSE_LABELS] ?? course}
                  {isMains && !courseFired && (
                    <span className="flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[9px] text-amber-400">
                      <Lock className="h-2.5 w-2.5" />
                      {t('restaurant.kds.held', 'HELD')}
                    </span>
                  )}
                  {isMains && courseFired && (
                    <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] text-red-400">
                      <Flame className="h-2.5 w-2.5" />
                      {t('restaurant.kds.fire', 'FIRE')}
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                {courseItems.map((item) => {
                  const isReady = item.status === 'ready' || item.status === 'served';
                  const isSelected = selected.has(item.id);
                  const itemElapsed = item.sent_at
                    ? Math.floor((Date.now() - new Date(item.sent_at).getTime()) / 60000)
                    : 0;
                  const itemColor = isReady
                    ? 'text-emerald-400 line-through'
                    : itemElapsed > 25
                      ? 'text-red-400'
                      : itemElapsed > 15
                        ? 'text-amber-400'
                        : 'text-white';
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2 rounded-xl px-3 py-2.5 transition-all ${
                        isReady
                          ? 'bg-emerald-500/10 opacity-50'
                          : isSelected
                            ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50'
                            : 'bg-white/5'
                      }`}
                    >
                      {partial && !isReady && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="mt-0.5 h-4 w-4 cursor-pointer accent-indigo-500"
                        />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${itemColor}`}>
                          {item.quantity}× {item.product_name}
                        </span>
                        {item.modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.modifiers.map((mod, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60"
                              >
                                + {mod.name}
                                {mod.price_delta !== 0 &&
                                  ` ($${mod.price_delta > 0 ? '+' : ''}${mod.price_delta.toFixed(2)})`}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-[11px] italic text-amber-400/80 mt-0.5">
                            📝 {item.notes}
                          </p>
                        )}
                      </span>
                      {!partial && (
                        <button
                          onClick={() => onBumpItem(item.id)}
                          disabled={isReady || !isOnline}
                          className={`flex flex-shrink-0 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 transition-all ${
                            isReady
                              ? 'cursor-default text-emerald-400'
                              : !isOnline
                                ? 'cursor-not-allowed opacity-50 text-white/30'
                                : 'text-white/30 hover:bg-emerald-500/20 hover:text-emerald-400 active:scale-90'
                          }`}
                          aria-label={`Mark ${item.product_name} ready`}
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="border-t border-white/10 p-3 space-y-2">
        {partial ? (
          <div className="flex gap-2">
            <button
              onClick={markSelected}
              disabled={selected.size === 0 || !isOnline}
              className="min-h-[44px] flex-1 rounded-xl bg-emerald-500/20 py-2.5 text-sm font-semibold text-emerald-400 disabled:opacity-40 hover:bg-emerald-500/30"
            >
              {t('restaurant.kds.markSelected', 'Mark Ready')} ({selected.size})
            </button>
            <button
              onClick={() => {
                setPartial(false);
                setSelected(new Set());
              }}
              className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/60 hover:bg-white/10"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {inProgressItems.length > 0 && (
              <button
                onClick={() => onMarkAllReady(order.id)}
                disabled={!isOnline}
                className={`min-h-[44px] flex-1 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 active:scale-[0.98] transition-all${!isOnline ? ' opacity-50 cursor-not-allowed' : ''}`}
              >
                ✓ {t('restaurant.kds.allReady', 'All Ready')} ({inProgressItems.length})
              </button>
            )}
            {inProgressItems.length === 0 && pendingItems.length > 0 && (
              <button
                onClick={() => onBumpAll(order.id)}
                disabled={!isOnline}
                className={`min-h-[44px] flex-1 rounded-xl bg-emerald-500/20 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/30 active:scale-[0.98] transition-all${!isOnline ? ' opacity-50 cursor-not-allowed' : ''}`}
              >
                {t('restaurant.kds.bumpAll', 'All Ready')} ({pendingItems.length})
              </button>
            )}
            {pendingItems.length > 1 && (
              <button
                onClick={() => setPartial(true)}
                className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 hover:bg-white/10"
                title={t('restaurant.kds.partial', 'Mark partial')}
              >
                ▾
              </button>
            )}
            {readyItems.length > 0 && pendingItems.length === 0 && (
              <button
                onClick={() => onBumpAllReady(order.id)}
                disabled={!isOnline}
                className={`min-h-[44px] flex-1 rounded-xl bg-indigo-500/20 py-2.5 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/30${!isOnline ? ' opacity-50 cursor-not-allowed' : ''}`}
              >
                {t('restaurant.kds.serve', 'Serve All')}
              </button>
            )}
          </div>
        )}
        <button
          onClick={() => onTogglePriority(order.id)}
          className={`min-h-[44px] w-full rounded-xl py-2 text-xs font-medium transition-all ${
            isPriority
              ? 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/20'
              : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60'
          }`}
        >
          <Star
            className={`me-1 inline h-3 w-3 ${isPriority ? 'fill-indigo-300' : ''}`}
          />
          {isPriority
            ? t('restaurant.kds.removePriority', 'Remove Priority')
            : t('restaurant.kds.priority', 'Mark Priority')}
        </button>
      </div>
    </div>
  );
}

// ── Main KDS Page ─────────────────────────────────────────────

const ALL_STATION: KDSStation = {
  id: 'all',
  tenant_id: '',
  name: 'All',
  name_ar: 'الكل',
  color: '#6366f1',
  sort_order: -1,
  is_active: true,
};

export default function KitchenDisplay() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState<KDSStation[]>([ALL_STATION]);
  const [activeStation, setActiveStation] = useState<string>('all');
  const [priorityOrders, setPriorityOrders] = useState<Set<string>>(new Set());
  const [showConfig, setShowConfig] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isKdsMode, setIsKdsMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevTicketCount = useRef(0);

  // ── Sound notification ────────────────────────────────────────
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio not available in this context
    }
  }, [soundEnabled]);

  // ── Load stations ─────────────────────────────────────────────
  const loadStations = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('restaurant_kds_stations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order');
    if (data && data.length > 0) {
      setStations([ALL_STATION, ...(data as KDSStation[])]);
    }
  }, [tenantId]);

  // ── Load tickets ──────────────────────────────────────────────
  const loadTickets = useCallback(
    async (currentPriority: Set<string>) => {
      if (!tenantId) return;
      try {
        const [ordersRes, itemsRes, tablesRes] = await Promise.all([
          supabase
            .from('table_orders')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('status', 'open')
            .order('opened_at', { ascending: true }),
          supabase
            .from('restaurant_order_items')
            .select('*')
            .eq('tenant_id', tenantId)
            .in('status', ['pending', 'in_progress', 'ready'])
            .order('sent_at', { ascending: true }),
          supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId),
        ]);

        const orders = (ordersRes.data ?? []) as TableOrder[];
        const items = (itemsRes.data ?? []) as RestaurantOrderItem[];
        const tables = (tablesRes.data ?? []) as RestaurantTable[];
        const tableMap = new Map(tables.map((tb) => [tb.id, tb]));

        const built: TicketData[] = orders
          .map((order) => ({
            order,
            table: order.table_id ? (tableMap.get(order.table_id) ?? null) : null,
            items: items.filter((i) => i.order_id === order.id),
            isPriority: currentPriority.has(order.id),
          }))
          .filter((tk) => tk.items.length > 0)
          .sort((a, b) => {
            if (a.isPriority && !b.isPriority) return -1;
            if (!a.isPriority && b.isPriority) return 1;
            return (
              new Date(a.order.opened_at).getTime() -
              new Date(b.order.opened_at).getTime()
            );
          });

        if (built.length > prevTicketCount.current && prevTicketCount.current > 0) {
          playBeep();
        }
        prevTicketCount.current = built.length;
        setTickets(built);
      } catch (err) {
        console.error('[KDS] load error:', err);
      } finally {
        setLoading(false);
      }
    },
    [tenantId, playBeep],
  );

  // ── Use stable ref for priority so the effect below doesn't re-run ──
  const priorityRef = useRef(priorityOrders);
  priorityRef.current = priorityOrders;

  const refreshTickets = useCallback(() => {
    void loadTickets(priorityRef.current);
  }, [loadTickets]);

  useEffect(() => {
    void loadStations();
    refreshTickets();
    // Fallback polling at 30s — Realtime is the primary update path
    const interval = setInterval(refreshTickets, 30_000);
    return () => clearInterval(interval);
  }, [loadStations, refreshTickets]);

  // ── Realtime ──────────────────────────────────────────────────
  // Tenant-scoped filter ensures we only react to our own order changes
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`kds-items-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_order_items',
          filter: `tenant_id=eq.${tenantId}`,
        },
        refreshTickets,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'table_orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        refreshTickets,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, refreshTickets]);

  // ── Online/offline detection ──────────────────────────────────
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Bump handlers ─────────────────────────────────────────────
  const handleBumpItem = useCallback(async (itemId: string) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from('restaurant_order_items')
      .update({ status: 'ready', ready_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('tenant_id', tenantId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTickets((prev) =>
      prev.map((tk) => ({
        ...tk,
        items: tk.items.map((i) =>
          i.id === itemId
            ? { ...i, status: 'ready' as const, ready_at: new Date().toISOString() }
            : i,
        ),
      })),
    );
  }, [tenantId]);

  const handleBumpAll = useCallback(
    async (orderId: string) => {
      const ticket = tickets.find((tk) => tk.order.id === orderId);
      if (!ticket) return;
      const ids = ticket.items
        .filter((i) => i.status === 'pending' || i.status === 'in_progress')
        .map((i) => i.id);
      if (ids.length === 0) return;
      if (!tenantId) return;
      const { error } = await supabase
        .from('restaurant_order_items')
        .update({ status: 'ready', ready_at: new Date().toISOString() })
        .in('id', ids)
        .eq('tenant_id', tenantId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setTickets((prev) =>
        prev.map((tk) =>
          tk.order.id === orderId
            ? {
              ...tk,
              items: tk.items.map((i) =>
                ids.includes(i.id)
                  ? { ...i, status: 'ready' as const, ready_at: new Date().toISOString() }
                  : i,
              ),
            }
            : tk,
        ),
      );
    },
    [tickets, tenantId],
  );

  const handleMarkAllReady = useCallback(
    async (orderId: string) => {
      if (!tenantId) return;
      const { error } = await supabase
        .from('restaurant_order_items')
        .update({ status: 'ready', ready_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId)
        .eq('status', 'in_progress');
      if (error) {
        toast.error(error.message);
        return;
      }
      setTickets((prev) =>
        prev.map((tk) =>
          tk.order.id === orderId
            ? {
              ...tk,
              items: tk.items.map((i) =>
                i.status === 'in_progress'
                  ? { ...i, status: 'ready' as const, ready_at: new Date().toISOString() }
                  : i,
              ),
            }
            : tk,
        ),
      );
    },
    [tenantId],
  );

  const handleBumpAllReady = useCallback(
    async (orderId: string) => {
      const ticket = tickets.find((tk) => tk.order.id === orderId);
      if (!ticket) return;
      const ids = ticket.items.filter((i) => i.status === 'ready').map((i) => i.id);
      if (ids.length === 0) return;
      if (!tenantId) return;
      const { error } = await supabase
        .from('restaurant_order_items')
        .update({ status: 'served' })
        .in('id', ids)
        .eq('tenant_id', tenantId);
      if (error) {
        toast.error(error.message);
        return;
      }
      setTickets((prev) =>
        prev
          .map((tk) =>
            tk.order.id === orderId
              ? {
                ...tk,
                items: tk.items.map((i) =>
                  ids.includes(i.id) ? { ...i, status: 'served' as const } : i,
                ),
              }
              : tk,
          )
          .filter((tk) => tk.items.some((i) => i.status !== 'served')),
      );
    },
    [tickets, tenantId],
  );

  const handleTogglePriority = useCallback((orderId: string) => {
    setPriorityOrders((prev) => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
    setTickets((prev) =>
      prev
        .map((tk) =>
          tk.order.id === orderId ? { ...tk, isPriority: !tk.isPriority } : tk,
        )
        .sort((a, b) => {
          if (a.isPriority && !b.isPriority) return -1;
          if (!a.isPriority && b.isPriority) return 1;
          return 0;
        }),
    );
  }, []);

  // ── Station filtering ─────────────────────────────────────────
  const visibleTickets =
    activeStation === 'all'
      ? tickets
      : tickets.filter((tk) => {
        const station = stations.find((s) => s.id === activeStation);
        if (!station) return true;
        return tk.items.some(
          (item) =>
            item.course === station.name.toLowerCase() ||
              item.product_name.toLowerCase().includes(station.name.toLowerCase()),
        );
      });

  const pendingCount = tickets.reduce(
    (acc, tk) =>
      acc + tk.items.filter((i) => i.status === 'pending' || i.status === 'in_progress').length,
    0,
  );

  const hasUrgent = tickets.some((tk) => {
    const elapsedMs = Date.now() - new Date(tk.order.opened_at).getTime();
    return (
      elapsedMs > 900_000 &&
      tk.items.some((i) => i.status !== 'ready' && i.status !== 'served')
    );
  });

  return (
    <div
      className={`min-h-screen bg-slate-950 text-white ${
        isKdsMode ? 'fixed inset-0 z-40 overflow-y-auto' : ''
      }`}
    >
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => { void navigate(-1); }}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
          aria-label={t('common.back', 'Back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600">
          <ChefHat className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-white">
            {t('restaurant.kds.title', 'Kitchen Display System')}
          </h1>
          <p className="text-[10px] text-white/40">
            {tickets.length} {t('restaurant.kds.tickets', 'tickets')} ·{' '}
            {pendingCount} {t('restaurant.kds.pending', 'pending')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs transition-all ${
              soundEnabled
                ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                : 'border-white/10 bg-white/5 text-white/40'
            }`}
            title={
              soundEnabled
                ? t('restaurant.kds.muteSound', 'Mute')
                : t('restaurant.kds.enableSound', 'Sound')
            }
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={refreshTickets}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('common.refresh', 'Refresh')}</span>
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
            title={t('restaurant.kds.configureStations', 'Configure Stations')}
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsKdsMode((v) => !v)}
            className={`min-h-[44px] rounded-xl border p-2.5 transition-all ${
              isKdsMode
                ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
            }`}
            title={t('restaurant.kds.kdsMode', 'KDS Mode')}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Offline banner ── */}
      {!isOnline && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline — showing last known orders. Realtime updates paused.</span>
        </div>
      )}

      {/* ── Station tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/5 bg-slate-900/60 px-4 py-2 no-scrollbar">
        {stations.map((station) => {
          const count =
            station.id === 'all'
              ? tickets.length
              : tickets.filter((tk) =>
                tk.items.some(
                  (item) =>
                    item.course === station.name.toLowerCase() ||
                      item.product_name.toLowerCase().includes(station.name.toLowerCase()),
                ),
              ).length;
          const isActive = activeStation === station.id;
          return (
            <button
              key={station.id}
              onClick={() => setActiveStation(station.id)}
              className="flex min-h-[44px] flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
              style={
                isActive
                  ? {
                    backgroundColor: station.color + '33',
                    boxShadow: `0 0 0 1px ${station.color}66`,
                    color: 'white',
                  }
                  : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: station.color }}
              />
              {station.name}
              {count > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: station.color + '66' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-4 border-b border-white/5 bg-slate-900/40 px-4 py-2">
        {[
          { label: t('restaurant.kds.fresh', '< 5 min'), color: 'bg-emerald-500' },
          { label: t('restaurant.kds.warming', '5–10 min'), color: 'bg-amber-500' },
          { label: t('restaurant.kds.hot', '10–15 min'), color: 'bg-orange-500' },
          { label: t('restaurant.kds.critical', '> 15 min'), color: 'bg-red-500' },
          { label: t('restaurant.kds.priority', 'Priority'), color: 'bg-indigo-500' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
            <span className="text-[10px] text-white/40">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Tickets grid ── */}
      <div className="p-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
          </div>
        ) : visibleTickets.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <ChefHat className="h-12 w-12 text-white/10" />
            <p className="text-sm text-white/30">
              {t('restaurant.kds.noTickets', 'All caught up!')}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleTickets.map((ticket) => (
              <TicketCard
                key={ticket.order.id}
                ticket={ticket}
                isOnline={isOnline}
                onBumpItem={(id) => {
                  void handleBumpItem(id);
                }}
                onBumpAll={(id) => {
                  void handleBumpAll(id);
                }}
                onTogglePriority={handleTogglePriority}
                onBumpAllReady={(id) => {
                  void handleBumpAllReady(id);
                }}
                onMarkAllReady={(id) => {
                  void handleMarkAllReady(id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Urgent banner ── */}
      {hasUrgent && (
        <div className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2">
          <div className="flex animate-pulse items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 shadow-2xl shadow-red-900/50">
            <AlertTriangle className="h-4 w-4 text-white" />
            <span className="text-sm font-semibold text-white">
              {t('restaurant.kds.urgentTickets', 'Urgent: tickets over 15 min')}
            </span>
          </div>
        </div>
      )}

      {/* ── Station config modal ── */}
      {showConfig && tenantId && (
        <StationConfigModal
          stations={stations.filter((s) => s.id !== 'all')}
          tenantId={tenantId}
          onClose={() => setShowConfig(false)}
          onSaved={(saved) => {
            setStations([ALL_STATION, ...saved]);
          }}
        />
      )}
    </div>
  );
}
