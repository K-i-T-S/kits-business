import { ArrowUpRight, CalendarClock, ListPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { ActionQueueWidget, type ActionQueueItem } from '@/components/hub-widgets/ActionQueueWidget';
import { GlanceKpiWidget } from '@/components/hub-widgets/GlanceKpiWidget';
import Layout from '@/components/Layout';
import { HUB_WIDGET_CATALOG } from '@/constants/hubWidgets';
import { useApp } from '@/context/AppContext';
import { loadVisibleWidgetIds } from '@/utils/hubWidgetConfig';
import { supabase } from '@/utils/supabaseClient';

interface WaitlistEntry {
  id: string;
  guest_name: string;
  party_size: number;
  created_at: string;
}

interface Reservation {
  id: string;
  guest_name: string;
  party_size: number;
  reserved_at: string;
}

/**
 * Track 2, Phase B (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * bespoke home for Receptionist — reservations/front-of-house is a
 * genuinely different job from floor/kitchen/finance/inventory, not a
 * variation of any of them. Waitlist "Notify" is deliberately the queue
 * action (not "Seat", which needs a target-table pick — fn_seat_waitlist_party
 * requires one — kept in the full Waitlist page rather than adding a
 * second table-picker UI here).
 */
export default function ReceptionistHomeHub() {
  const { currentTenant } = useApp();
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>(
    () => HUB_WIDGET_CATALOG.receptionist.map((w) => w.id),
  );
  useEffect(() => {
    const tenantId = currentTenant?.id;
    if (!tenantId) return;
    void loadVisibleWidgetIds(tenantId, 'receptionist')
      .then(setVisibleWidgetIds)
      .catch(() => {
        // Best-effort -- keep the catalog-default order already showing.
      });
  }, [currentTenant?.id]);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [waitlistRes, reservationsRes] = await Promise.all([
        supabase
          .from('restaurant_waitlist')
          .select('id, guest_name, party_size, created_at')
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'waiting')
          .order('created_at', { ascending: true }),
        supabase
          .from('reservations')
          .select('id, guest_name, party_size, reserved_at')
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'pending')
          .gte('reserved_at', todayStart.toISOString())
          .lte('reserved_at', todayEnd.toISOString())
          .order('reserved_at', { ascending: true }),
      ]);

      setWaitlist((waitlistRes.data ?? []) as WaitlistEntry[]);
      setReservations((reservationsRes.data ?? []) as Reservation[]);
    } catch (err) {
      toast.error('Failed to load receptionist hub', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [currentTenant]);

  // First screen an employee lands on after login — previously no
  // auto-refresh at all, same staleness pattern already fixed on several
  // other pages this session (TableManagement, Reservations, EventsManager).
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    void load();
    refreshIntervalRef.current = setInterval(() => { void load(); }, 30000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [load]);

  const handleNotify = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('restaurant_waitlist')
        .update({ status: 'notified', notified_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Guest notified — seat them from the Waitlist page when their table is ready');
      await load();
    } catch (err) {
      toast.error('Failed to notify', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [load]);

  const handleConfirm = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', id);
      if (error) throw error;
      toast.success('Reservation confirmed');
      await load();
    } catch (err) {
      toast.error('Failed to confirm', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [load]);

  const waitlistItems: ActionQueueItem[] = waitlist.map((w) => ({
    id: w.id,
    title: w.guest_name,
    subtitle: `Party of ${w.party_size}`,
    actionLabel: 'Notify',
    onAction: () => handleNotify(w.id),
  }));

  const reservationItems: ActionQueueItem[] = reservations.map((r) => ({
    id: r.id,
    title: r.guest_name,
    subtitle: `Party of ${r.party_size}`,
    meta: new Date(r.reserved_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    actionLabel: 'Confirm',
    onAction: () => handleConfirm(r.id),
  }));

  const widgetRenderers: Record<string, ReactNode> = {
    'receptionist.waitlist_count_kpi': (
      <GlanceKpiWidget
        label="On the waitlist"
        value={String(waitlist.length)}
        icon={<ListPlus className="h-4 w-4" />}
        accent="#8b5cf6"
      />
    ),
    'receptionist.reservations_count_kpi': (
      <GlanceKpiWidget
        label="Today's reservations"
        value={String(reservations.length)}
        icon={<CalendarClock className="h-4 w-4" />}
        accent="#0ea5e9"
      />
    ),
    'receptionist.waitlist_queue': (
      <ActionQueueWidget
        title="Waitlist"
        icon={<ListPlus className="h-4 w-4" />}
        accent="#8b5cf6"
        items={waitlistItems}
        emptyLabel="No one on the waitlist"
        loading={loading}
      />
    ),
    'receptionist.reservations_queue': (
      <ActionQueueWidget
        title="Reservations Needing Confirmation"
        icon={<CalendarClock className="h-4 w-4" />}
        accent="#0ea5e9"
        items={reservationItems}
        emptyLabel="No reservations awaiting confirmation"
        loading={loading}
      />
    ),
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Reception</h1>
          <p className="text-sm text-white/40">{currentTenant?.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {visibleWidgetIds.map((id) => (
            <div key={id} className={id.endsWith('_queue') ? 'col-span-2' : ''}>
              {widgetRenderers[id]}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/restaurant/waitlist"
            className="flex items-center justify-between rounded-2xl border border-white/10 p-4 transition-colors hover:bg-white/5"
          >
            <span className="text-sm font-medium text-white/80">
              Open full Waitlist (seat guests)
            </span>
            <ArrowUpRight className="h-4 w-4 text-white/40" />
          </Link>
          <Link
            to="/restaurant/reservations"
            className="flex items-center justify-between rounded-2xl border border-white/10 p-4 transition-colors hover:bg-white/5"
          >
            <span className="text-sm font-medium text-white/80">
              Open full Reservations
            </span>
            <ArrowUpRight className="h-4 w-4 text-white/40" />
          </Link>
        </div>
      </div>
    </Layout>
  );
}
