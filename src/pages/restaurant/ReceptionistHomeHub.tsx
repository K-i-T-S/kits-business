import { CalendarClock, ListPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ActionQueueWidget, type ActionQueueItem } from '@/components/hub-widgets/ActionQueueWidget';
import { GlanceKpiWidget } from '@/components/hub-widgets/GlanceKpiWidget';
import Layout from '@/components/Layout';
import { RESTAURANT_COLORS } from '@/constants/restaurantColors';
import { useApp } from '@/context/AppContext';
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

  useEffect(() => { void load(); }, [load]);

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

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: RESTAURANT_COLORS.textPrimary }}>Reception</h1>
          <p className="text-sm" style={{ color: RESTAURANT_COLORS.textMuted }}>{currentTenant?.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <GlanceKpiWidget
            label="On the waitlist"
            value={String(waitlist.length)}
            icon={<ListPlus className="h-4 w-4" />}
            accent="#8b5cf6"
          />
          <GlanceKpiWidget
            label="Today's reservations"
            value={String(reservations.length)}
            icon={<CalendarClock className="h-4 w-4" />}
            accent="#0ea5e9"
          />
        </div>

        <ActionQueueWidget
          title="Waitlist"
          icon={<ListPlus className="h-4 w-4" />}
          accent="#8b5cf6"
          items={waitlistItems}
          emptyLabel="No one on the waitlist"
          loading={loading}
        />

        <ActionQueueWidget
          title="Reservations Needing Confirmation"
          icon={<CalendarClock className="h-4 w-4" />}
          accent="#0ea5e9"
          items={reservationItems}
          emptyLabel="No reservations awaiting confirmation"
          loading={loading}
        />
      </div>
    </Layout>
  );
}
