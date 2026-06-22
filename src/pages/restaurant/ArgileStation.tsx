import {
  ArrowLeft,
  Flame,
  Wind,
  Plus,
  AlertTriangle,
  RefreshCw,
  X,
  Clock,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '@/context/AppContext';
import type {
  ArgileSession,
  ArgileEvent,
  ArgileFlavor,
  RestaurantTable,
} from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

// ── Helpers ───────────────────────────────────────────────────

/**
 * If the given table has an open order, appends an argile charge line item to it.
 * Returns true if a charge was added, false if table has no open order.
 */
async function addArgileChargeToOrder(
  tableId: string,
  tenantId: string,
  productName: string,
  unitPrice: number,
): Promise<boolean> {
  if (unitPrice <= 0) return false;
  const { data: orders } = await supabase
    .from('table_orders')
    .select('id')
    .eq('table_id', tableId)
    .eq('status', 'open')
    .limit(1);
  const orderId = orders?.[0]?.id as string | undefined;
  if (!orderId) return false;
  await supabase.from('restaurant_order_items').insert({
    tenant_id: tenantId,
    order_id: orderId,
    product_name: productName,
    quantity: 1,
    unit_price: unitPrice,
    modifiers: [],
    course: 'mains',
    status: 'served',
    sent_at: new Date().toISOString(),
  });
  return true;
}

function useElapsedMinutes(since: string): number {
  const [mins, setMins] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60_000)),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setMins(Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60_000)));
    }, 30_000);
    return () => clearInterval(id);
  }, [since]);
  return mins;
}

function vibrate(ms: number) {
  try {
    window.navigator.vibrate?.(ms);
  } catch {
    // Not supported
  }
}

// ── Session card ──────────────────────────────────────────────

interface PendingFa7em {
  eventId: string;
  createdAt: string;
}

interface SessionCardProps {
  session: ArgileSession;
  table: RestaurantTable | null;
  pendingFa7em: PendingFa7em | null;
  onCoalDelivered: (sessionId: string, eventId: string) => void;
  onTobaccoRefill: (session: ArgileSession) => void;
  onCloseSession: (session: ArgileSession) => void;
}

function SessionCard({
  session,
  table,
  pendingFa7em,
  onCoalDelivered,
  onTobaccoRefill,
  onCloseSession,
}: SessionCardProps) {
  const { t } = useTranslation();
  const activeMins = useElapsedMinutes(session.opened_at);

  // Determine urgency of pending fa7em
  const fa7emAgeMins = pendingFa7em
    ? Math.floor((Date.now() - new Date(pendingFa7em.createdAt).getTime()) / 60_000)
    : null;
  const isUrgent = fa7emAgeMins !== null && fa7emAgeMins >= 3;
  const hasFa7em = pendingFa7em !== null;

  const cardBorder = isUrgent
    ? 'border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
    : hasFa7em
      ? 'border-amber-500/60 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
      : 'border-white/10';

  const cardBg = isUrgent
    ? 'bg-red-950/40'
    : hasFa7em
      ? 'bg-amber-950/30'
      : 'bg-slate-900';

  return (
    <div
      className={`rounded-2xl border-2 p-4 transition-all duration-300 ${cardBorder} ${cardBg} ${
        hasFa7em ? 'animate-pulse' : ''
      }`}
      style={hasFa7em ? { animationDuration: isUrgent ? '0.6s' : '1.5s' } : {}}
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isUrgent && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
              <AlertTriangle className="h-3 w-3" />
              {t('argile.urgent', 'URGENT')}
            </span>
          )}
          {hasFa7em && !isUrgent && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              <Wind className="h-3 w-3" />
              {t('argile.fa7emRequest', 'FA7EM')}
            </span>
          )}
          <span className="text-base font-bold text-white">
            {t('restaurant.table', 'Table')} {table?.number ?? '?'}
          </span>
          {table?.name && (
            <span className="text-xs text-white/40">{table.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <Clock className="h-3 w-3" />
          {activeMins}m
        </div>
      </div>

      {/* Flavor & details */}
      <div className="mb-3 space-y-1">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-sm text-white/80">
            {session.tobacco_brand && (
              <span className="font-medium">{session.tobacco_brand} · </span>
            )}
            {session.tobacco_flavor ?? t('argile.unknownFlavor', 'Unknown flavor')}
          </span>
          {session.tobacco_flavor_ar && (
            <span className="text-xs text-white/40" dir="rtl">
              {session.tobacco_flavor_ar}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-white/40">
          <span>
            {session.coal_type === 'natural'
              ? t('argile.naturalCoal', 'Natural coal')
              : t('argile.quickLight', 'Quick light')}
          </span>
          <span>
            {session.head_size === 'jumbo'
              ? t('argile.jumboHead', 'Jumbo head')
              : t('argile.regularHead', 'Regular head')}
          </span>
          {session.coal_delivery_count > 0 && (
            <span className="text-orange-400/70">
              🔥 {session.coal_delivery_count}×
            </span>
          )}
          {session.tobacco_refill_count > 0 && (
            <span className="text-emerald-400/70">
              ↺ {session.tobacco_refill_count}×
            </span>
          )}
        </div>
      </div>

      {/* Fa7em request info */}
      {hasFa7em && fa7emAgeMins !== null && (
        <div
          className={`mb-3 rounded-xl px-3 py-2 text-sm font-medium ${
            isUrgent
              ? 'bg-red-600/20 text-red-300'
              : 'bg-amber-500/15 text-amber-300'
          }`}
        >
          {isUrgent
            ? t('argile.coalUrgent', 'Coal needed NOW — {{m}} min ago', { m: fa7emAgeMins })
            : t('argile.coalRequested', 'Coal requested {{m}} min ago', { m: fa7emAgeMins })}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {hasFa7em && (
          <button
            onClick={() => {
              if (pendingFa7em) {
                onCoalDelivered(session.id, pendingFa7em.eventId);
              }
            }}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 text-base font-bold text-white shadow-lg shadow-orange-900/40 active:scale-[0.97] transition-all"
          >
            <Flame className="h-5 w-5" />
            {t('argile.markCoalDelivered', 'Mark Coal Delivered')}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onTobaccoRefill(session)}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 active:scale-[0.97] transition-all"
          >
            <RotateCcw className="h-4 w-4" />
            {t('argile.tobaccoRefill', 'Tobacco Refill')}
          </button>
          <button
            onClick={() => onCloseSession(session)}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-white/5 px-4 text-sm text-white/40 hover:bg-white/10 hover:text-white/70 active:scale-[0.97] transition-all"
          >
            <X className="h-4 w-4" />
            {t('argile.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New session modal ─────────────────────────────────────────

interface NewSessionModalProps {
  tables: RestaurantTable[];
  flavors: ArgileFlavor[];
  tenantId: string;
  onClose: () => void;
  onCreated: () => void;
}

function NewSessionModal({
  tables,
  flavors,
  tenantId,
  onClose,
  onCreated,
}: NewSessionModalProps) {
  const { t } = useTranslation();
  const [tableId, setTableId] = useState('');
  const [flavorId, setFlavorId] = useState('');
  const [coalType, setCoalType] = useState<'natural' | 'quick_light'>('natural');
  const [headSize, setHeadSize] = useState<'regular' | 'jumbo'>('regular');
  const [saving, setSaving] = useState(false);

  const occupiedTables = tables.filter((tb) => tb.status === 'occupied');
  const selectedFlavor = flavors.find((f) => f.id === flavorId);

  const save = async () => {
    if (!tableId) {
      toast.error(t('argile.selectTable', 'Select a table'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('restaurant_argile_sessions').insert({
        tenant_id: tenantId,
        table_id: tableId,
        tobacco_brand: selectedFlavor?.brand ?? null,
        tobacco_flavor: selectedFlavor?.flavor ?? null,
        tobacco_flavor_ar: selectedFlavor?.flavor_ar ?? null,
        coal_type: coalType,
        head_size: headSize,
        base_price_usd: selectedFlavor?.base_price_usd ?? 0,
        refill_price_usd: selectedFlavor?.refill_price_usd ?? 0,
      });
      if (error) throw error;

      // Auto-charge the base argile price to the table's open order (if any)
      const flavorLabel = selectedFlavor
        ? `${selectedFlavor.brand} — ${selectedFlavor.flavor}`
        : t('argile.unknownFlavor', 'Argile');
      const basePrice = selectedFlavor?.base_price_usd ?? 0;
      const charged = await addArgileChargeToOrder(
        tableId,
        tenantId,
        `🔥 Argile — ${flavorLabel}`,
        basePrice,
      );
      toast.success(
        charged
          ? t('argile.sessionOpenedWithTab', 'Session opened · ${{price}} added to tab', { price: basePrice.toFixed(2) })
          : t('argile.sessionOpened', 'Session opened'),
      );
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorSaving', 'Error saving'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border-t sm:border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-bold text-white">
            {t('argile.openSession', 'Open Argile Session')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Table */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              {t('restaurant.table', 'Table')}
            </label>
            <div className="relative">
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-white/20 bg-slate-800 px-4 py-3 pr-10 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">{t('argile.selectTable', 'Select table...')}</option>
                {occupiedTables.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {t('restaurant.table', 'Table')} {tb.number}
                    {tb.name ? ` — ${tb.name}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            </div>
          </div>

          {/* Flavor */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              {t('argile.flavor', 'Tobacco Flavor')}
            </label>
            <div className="relative">
              <select
                value={flavorId}
                onChange={(e) => setFlavorId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-white/20 bg-slate-800 px-4 py-3 pr-10 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">{t('argile.noFlavor', 'No specific flavor')}</option>
                {flavors
                  .filter((f) => f.is_active)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.brand} — {f.flavor}
                      {f.base_price_usd > 0 ? ` ($${f.base_price_usd})` : ''}
                    </option>
                  ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            </div>
          </div>

          {/* Coal type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              {t('argile.coalType', 'Coal Type')}
            </label>
            <div className="flex gap-2">
              {(['natural', 'quick_light'] as const).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setCoalType(ct)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all min-h-[44px] ${
                    coalType === ct
                      ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300'
                      : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {ct === 'natural'
                    ? t('argile.naturalCoal', 'Natural')
                    : t('argile.quickLight', 'Quick Light')}
                </button>
              ))}
            </div>
          </div>

          {/* Head size */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">
              {t('argile.headSize', 'Head Size')}
            </label>
            <div className="flex gap-2">
              {(['regular', 'jumbo'] as const).map((hs) => (
                <button
                  key={hs}
                  onClick={() => setHeadSize(hs)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all min-h-[44px] ${
                    headSize === hs
                      ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300'
                      : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {hs === 'regular'
                    ? t('argile.regular', 'Regular')
                    : t('argile.jumbo', 'Jumbo')}
                </button>
              ))}
            </div>
          </div>

          {selectedFlavor && (
            <div className="rounded-xl bg-white/5 px-4 py-3 text-sm">
              <span className="text-white/60">{t('argile.basePrice', 'Base')}: </span>
              <span className="font-medium text-white">${selectedFlavor.base_price_usd}</span>
              <span className="mx-2 text-white/20">·</span>
              <span className="text-white/60">{t('argile.refillPrice', 'Refill')}: </span>
              <span className="font-medium text-white">${selectedFlavor.refill_price_usd}</span>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-5">
          <button
            onClick={() => { void save(); }}
            disabled={saving || !tableId}
            className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-500 text-base font-bold text-white disabled:opacity-50 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            {saving
              ? t('common.saving', 'Saving...')
              : t('argile.openSession', 'Open Session')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tobacco refill confirm modal ──────────────────────────────

interface RefillModalProps {
  session: ArgileSession;
  table: RestaurantTable | null;
  onClose: () => void;
  onConfirmed: (sessionId: string) => void;
}

function RefillModal({ session, table, onClose, onConfirmed }: RefillModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      // Log event
      const { error: evErr } = await supabase.from('restaurant_argile_events').insert({
        tenant_id: session.tenant_id,
        session_id: session.id,
        table_id: session.table_id,
        event_type: 'tobacco_refill',
        handled_at: new Date().toISOString(),
      });
      if (evErr) throw evErr;

      // Increment refill count
      const { error: upErr } = await supabase
        .from('restaurant_argile_sessions')
        .update({ tobacco_refill_count: session.tobacco_refill_count + 1 })
        .eq('id', session.id);
      if (upErr) throw upErr;

      // Auto-charge the refill price to the table's open order (if any)
      const refillLabel = [session.tobacco_brand, session.tobacco_flavor]
        .filter(Boolean)
        .join(' — ') || t('argile.unknownFlavor', 'Argile');
      const charged = await addArgileChargeToOrder(
        session.table_id,
        session.tenant_id,
        `🔥 Argile Refill — ${refillLabel}`,
        session.refill_price_usd,
      );
      toast.success(
        charged
          ? t('argile.refillWithTab', 'Refill logged · ${{price}} added to tab', { price: session.refill_price_usd.toFixed(2) })
          : t('argile.refillLogged', 'Refill logged'),
      );
      onConfirmed(session.id);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('common.error', 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h3 className="mb-2 text-base font-bold text-white">
          {t('argile.confirmRefill', 'Tobacco Refill')}
        </h3>
        <p className="mb-1 text-sm text-white/60">
          {t('restaurant.table', 'Table')} {table?.number ?? '?'} ·{' '}
          {session.tobacco_brand} {session.tobacco_flavor}
        </p>
        {session.refill_price_usd > 0 && (
          <p className="mb-5 text-sm font-medium text-emerald-400">
            +${session.refill_price_usd} {t('argile.addedToTab', 'added to tab')}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/60 hover:bg-white/10"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={() => { void confirm(); }}
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-emerald-500 active:scale-[0.97] transition-all"
          >
            {saving
              ? t('common.saving', '...')
              : t('argile.confirmRefillBtn', 'Confirm Refill')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Argile Station ───────────────────────────────────────

export default function ArgileStation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [sessions, setSessions] = useState<ArgileSession[]>([]);
  const [events, setEvents] = useState<ArgileEvent[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [flavors, setFlavors] = useState<ArgileFlavor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [refillSession, setRefillSession] = useState<ArgileSession | null>(null);
  const prevEventCount = useRef(0);

  // ── Load data ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [sessRes, evRes, tbRes, flRes] = await Promise.all([
        supabase
          .from('restaurant_argile_sessions')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('opened_at', { ascending: false }),
        supabase
          .from('restaurant_argile_events')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('event_type', 'fa7em_request')
          .is('handled_at', null)
          .order('created_at', { ascending: true }),
        supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId),
        supabase
          .from('restaurant_argile_flavors')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      setSessions((sessRes.data ?? []) as ArgileSession[]);
      const newEvents = (evRes.data ?? []) as ArgileEvent[];

      // Vibrate on new fa7em request
      if (newEvents.length > prevEventCount.current && prevEventCount.current >= 0) {
        vibrate(300);
      }
      prevEventCount.current = newEvents.length;
      setEvents(newEvents);
      setTables((tbRes.data ?? []) as RestaurantTable[]);
      setFlavors((flRes.data ?? []) as ArgileFlavor[]);
    } catch (err) {
      console.error('[ArgileStation] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => { void loadData(); }, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Realtime ────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel('argile-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'restaurant_argile_events' },
        (payload) => {
          const ev = payload.new as ArgileEvent;
          if (ev.event_type === 'fa7em_request') {
            vibrate(300);
            setEvents((prev) => {
              // Avoid duplicates
              if (prev.some((e) => e.id === ev.id)) return prev;
              return [...prev, ev];
            });
            void loadData();
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'restaurant_argile_sessions' },
        () => { void loadData(); },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, loadData]);

  // ── Actions ─────────────────────────────────────────────────
  const handleCoalDelivered = useCallback(
    async (sessionId: string, eventId: string) => {
      if (!tenantId) return;
      try {
        const now = new Date().toISOString();

        // Mark event as handled
        const { error: evErr } = await supabase
          .from('restaurant_argile_events')
          .update({ handled_at: now })
          .eq('id', eventId);
        if (evErr) throw evErr;

        // Log delivery event
        await supabase.from('restaurant_argile_events').insert({
          tenant_id: tenantId,
          session_id: sessionId,
          table_id: sessions.find((s) => s.id === sessionId)?.table_id ?? '',
          event_type: 'coal_delivered',
          handled_at: now,
        });

        // Increment coal count on session
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
          await supabase
            .from('restaurant_argile_sessions')
            .update({ coal_delivery_count: session.coal_delivery_count + 1 })
            .eq('id', sessionId);
        }

        toast.success(t('argile.coalDelivered', 'Coal delivered'));
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, coal_delivery_count: s.coal_delivery_count + 1 }
              : s,
          ),
        );
      } catch (err) {
        console.error(err);
        toast.error(t('common.error', 'Error'));
      }
    },
    [tenantId, sessions, t],
  );

  const handleRefillConfirmed = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, tobacco_refill_count: s.tobacco_refill_count + 1 }
          : s,
      ),
    );
  };

  const handleCloseSession = useCallback(
    async (session: ArgileSession) => {
      if (!tenantId) return;
      try {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('restaurant_argile_sessions')
          .update({ status: 'closed', closed_at: now })
          .eq('id', session.id);
        if (error) throw error;

        // Log session_closed event
        await supabase.from('restaurant_argile_events').insert({
          tenant_id: tenantId,
          session_id: session.id,
          table_id: session.table_id,
          event_type: 'session_closed',
          handled_at: now,
        });

        toast.success(t('argile.sessionClosed', 'Session closed'));
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
        setEvents((prev) => prev.filter((e) => e.session_id !== session.id));
      } catch (err) {
        console.error(err);
        toast.error(t('common.error', 'Error'));
      }
    },
    [tenantId, t],
  );

  const tableMap = new Map(tables.map((tb) => [tb.id, tb]));

  // Group: sessions with urgent fa7em first, then fa7em, then active
  const pendingFa7emMap = new Map<string, PendingFa7em>(
    events.map((e) => [e.session_id, { eventId: e.id, createdAt: e.created_at }]),
  );

  const sortedSessions = [...sessions].sort((a, b) => {
    const aFa7em = pendingFa7emMap.get(a.id);
    const bFa7em = pendingFa7emMap.get(b.id);
    const aUrgent =
      aFa7em &&
      (Date.now() - new Date(aFa7em.createdAt).getTime()) / 60_000 >= 3;
    const bUrgent =
      bFa7em &&
      (Date.now() - new Date(bFa7em.createdAt).getTime()) / 60_000 >= 3;
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    if (aFa7em && !bFa7em) return -1;
    if (!aFa7em && bFa7em) return 1;
    return 0;
  });

  const pendingFa7emCount = events.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { void navigate(-1); }}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
              aria-label={t('common.back', 'Back')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-600 to-red-600">
              <Wind className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">
                {t('argile.stationTitle', 'Argile Station')}
              </h1>
              <p className="text-[10px] text-white/40">
                {sessions.length} {t('argile.activeSessions', 'active sessions')}
                {pendingFa7emCount > 0 && (
                  <span className="ml-1 font-bold text-amber-400">
                    · {pendingFa7emCount} fa7em
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { void loadData(); }}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Urgent banner */}
        {events.some(
          (e) => (Date.now() - new Date(e.created_at).getTime()) / 60_000 >= 3,
        ) && (
          <div className="flex animate-pulse items-center gap-2 border-t border-red-500/30 bg-red-600/20 px-4 py-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-bold text-red-300">
              {t('argile.urgentCoal', 'URGENT — Coal overdue!')}
            </span>
          </div>
        )}
      </div>

      {/* Sessions list */}
      <div className="p-4 space-y-3 pb-28">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Wind className="h-12 w-12 text-white/10" />
            <p className="text-sm text-white/30">
              {t('argile.noSessions', 'No active sessions')}
            </p>
          </div>
        ) : (
          sortedSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              table={tableMap.get(session.table_id) ?? null}
              pendingFa7em={pendingFa7emMap.get(session.id) ?? null}
              onCoalDelivered={(sId, eId) => {
                void handleCoalDelivered(sId, eId);
              }}
              onTobaccoRefill={setRefillSession}
              onCloseSession={(s) => {
                void handleCloseSession(s);
              }}
            />
          ))
        )}
      </div>

      {/* FAB — open new session */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4">
        <button
          onClick={() => setShowNew(true)}
          className="flex min-h-[56px] w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 text-base font-bold text-white shadow-xl shadow-orange-900/50 active:scale-[0.97] transition-all"
        >
          <Plus className="h-5 w-5" />
          {t('argile.openNewSession', 'Open New Argile Session')}
        </button>
      </div>

      {/* Modals */}
      {showNew && tenantId && (
        <NewSessionModal
          tables={tables}
          flavors={flavors}
          tenantId={tenantId}
          onClose={() => setShowNew(false)}
          onCreated={() => { void loadData(); }}
        />
      )}

      {refillSession && (
        <RefillModal
          session={refillSession}
          table={tableMap.get(refillSession.table_id) ?? null}
          onClose={() => setRefillSession(null)}
          onConfirmed={handleRefillConfirmed}
        />
      )}
    </div>
  );
}
