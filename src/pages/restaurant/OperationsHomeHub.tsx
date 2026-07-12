import { AlertOctagon, ArrowUpRight, Bell, DollarSign, TrendingUp, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { ActionQueueWidget, type ActionQueueItem } from '@/components/hub-widgets/ActionQueueWidget';
import { GlanceKpiWidget } from '@/components/hub-widgets/GlanceKpiWidget';
import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { formatCurrency, toLocalDateString } from '@/utils/formatting';
import { supabase } from '@/utils/supabaseClient';

type FloorAlertSource = 'call_waiter' | 'fa7em' | 'slow_alert';

interface FloorAlert {
  id: string;
  source: FloorAlertSource;
  title: string;
  subtitle?: string;
  createdAt: string;
}

const SOURCE_LABEL: Record<FloorAlertSource, string> = {
  call_waiter: 'Call Waiter',
  fa7em: 'Fa7em (Coal) Request',
  slow_alert: 'Slow Service',
};

/**
 * Track 2, Phase B (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * Owner/Manager/Supervisor share ONE adaptive hub rather than three
 * separate pages — per the founder's own architecture decision, these
 * three are genuinely the same job (run the restaurant) at different
 * altitude, not different jobs the way Waiter/Kitchen/Accountant are.
 * Scope is read from the signed-in role, not a prop, so PIN/password
 * login always lands the right altitude automatically.
 */
export default function OperationsHomeHub() {
  const { currentTenant } = useApp();
  const { role } = useSubscription();

  const scope: 'owner' | 'manager' | 'supervisor' = useMemo(() => {
    if (role === 'owner' || role === 'admin') return 'owner';
    if (role === 'manager') return 'manager';
    return 'supervisor';
  }, [role]);

  const [alerts, setAlerts] = useState<FloorAlert[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [staffClockedIn, setStaffClockedIn] = useState(0);
  const [staffScheduled, setStaffScheduled] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      // Two-step shift lookup (today's restaurant_shifts, then assignments
      // for those shift ids) — same pattern PinLockScreen.tsx's
      // clockInIfScheduled() already uses, rather than an untested
      // PostgREST embedded-relation filter.
      const todaysShiftsRes = await supabase
        .from('restaurant_shifts')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('shift_date', toLocalDateString(todayStart));
      const todaysShiftIds = ((todaysShiftsRes.data ?? []) as Array<{ id: string }>).map((s) => s.id);

      const [requestsRes, argileRes, slowRes, salesTodayRes, salesWeekRes, shiftsRes] = await Promise.all([
        supabase
          .from('restaurant_service_requests')
          .select('id, request_type, created_at, table_id')
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('restaurant_argile_events')
          .select('id, table_id, created_at')
          .eq('tenant_id', currentTenant.id)
          .eq('event_type', 'fa7em_request')
          .is('handled_at', null)
          .order('created_at', { ascending: true }),
        supabase
          .from('restaurant_slow_alerts')
          .select('id, alert_type, minutes_elapsed, created_at')
          .eq('tenant_id', currentTenant.id)
          .is('resolved_at', null)
          .order('created_at', { ascending: true }),
        supabase
          .from('sales')
          .select('total_amount')
          .eq('tenant_id', currentTenant.id)
          .gte('sale_date', todayStart.toISOString()),
        supabase
          .from('sales')
          .select('total_amount')
          .eq('tenant_id', currentTenant.id)
          .gte('sale_date', weekStart.toISOString()),
        todaysShiftIds.length > 0
          ? supabase
            .from('restaurant_shift_assignments')
            .select('id, clocked_in_at')
            .in('shift_id', todaysShiftIds)
          : Promise.resolve({ data: [] as Array<{ id: string; clocked_in_at: string | null }>, error: null }),
      ]);

      const requests = ((requestsRes.data ?? []) as Array<{ id: string; created_at: string; table_id: string }>)
        .map((r): FloorAlert => ({ id: `req-${r.id}`, source: 'call_waiter', title: SOURCE_LABEL.call_waiter, createdAt: r.created_at }));
      const argile = ((argileRes.data ?? []) as Array<{ id: string; created_at: string; table_id: string }>)
        .map((r): FloorAlert => ({ id: `argile-${r.id}`, source: 'fa7em', title: SOURCE_LABEL.fa7em, createdAt: r.created_at }));
      const slow = ((slowRes.data ?? []) as Array<{ id: string; alert_type: string; minutes_elapsed: number; created_at: string }>)
        .map((r): FloorAlert => ({
          id: `slow-${r.id}`,
          source: 'slow_alert',
          title: r.alert_type.replace(/_/g, ' '),
          subtitle: r.minutes_elapsed ? `${r.minutes_elapsed} min elapsed` : undefined,
          createdAt: r.created_at,
        }));

      const combined = [...requests, ...argile, ...slow]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setAlerts(combined);

      const sumTotal = (rows: unknown) =>
        ((rows ?? []) as Array<{ total_amount: number }>).reduce((sum, s) => sum + (s.total_amount ?? 0), 0);
      setTodayRevenue(sumTotal(salesTodayRes.data));
      setWeekRevenue(sumTotal(salesWeekRes.data));

      const shiftRows = (shiftsRes.data ?? []) as Array<{ clocked_in_at: string | null }>;
      setStaffScheduled(shiftRows.length);
      setStaffClockedIn(shiftRows.filter((s) => s.clocked_in_at).length);
    } catch (err) {
      toast.error('Failed to load operations hub', {
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

  const handleResolve = useCallback(async (alert: FloorAlert) => {
    try {
      const rawId = alert.id.split('-').slice(1).join('-');
      if (alert.source === 'call_waiter') {
        await supabase.from('restaurant_service_requests')
          .update({ status: 'resolved', acknowledged_at: new Date().toISOString() })
          .eq('id', rawId);
      } else if (alert.source === 'fa7em') {
        await supabase.from('restaurant_argile_events')
          .update({ handled_at: new Date().toISOString() })
          .eq('id', rawId);
      } else {
        await supabase.from('restaurant_slow_alerts')
          .update({ acknowledged_at: new Date().toISOString(), resolved_at: new Date().toISOString() })
          .eq('id', rawId);
      }
      toast.success('Resolved');
      await load();
    } catch (err) {
      toast.error('Failed to resolve', { description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [load]);

  const alertItems: ActionQueueItem[] = alerts.map((a) => ({
    id: a.id,
    title: a.title,
    subtitle: a.subtitle,
    urgent: a.source === 'slow_alert',
    actionLabel: 'Resolve',
    onAction: () => handleResolve(a),
  }));

  const titleByScope: Record<typeof scope, string> = {
    owner: 'Business Overview',
    manager: 'Manager Overview',
    supervisor: 'Floor Operations',
  };

  const forwardLinksByScope: Record<typeof scope, Array<{ to: string; label: string }>> = {
    supervisor: [{ to: '/restaurant/tables', label: 'Open Table Management' }],
    manager: [
      { to: '/restaurant/shifts', label: 'Open Shifts' },
      { to: '/restaurant/analytics', label: 'Open full Analytics' },
    ],
    owner: [{ to: '/restaurant/analytics', label: 'Open full Analytics' }],
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">{titleByScope[scope]}</h1>
          <p className="text-sm text-white/40">{currentTenant?.name}</p>
        </div>

        {scope === 'supervisor' && (
          <div className="grid grid-cols-2 gap-3">
            <GlanceKpiWidget
              label="Open floor alerts"
              value={String(alerts.length)}
              icon={<Bell className="h-4 w-4" />}
              accent={alerts.length > 0 ? '#ef4444' : '#10b981'}
            />
            <GlanceKpiWidget
              label="Staff clocked in"
              value={`${staffClockedIn} / ${staffScheduled}`}
              icon={<Users className="h-4 w-4" />}
              accent="#0ea5e9"
            />
          </div>
        )}

        {scope === 'manager' && (
          <div className="grid grid-cols-2 gap-3">
            <GlanceKpiWidget
              label="Today's revenue"
              value={formatCurrency(todayRevenue)}
              icon={<DollarSign className="h-4 w-4" />}
              accent="#10b981"
            />
            <GlanceKpiWidget
              label="Staff clocked in"
              value={`${staffClockedIn} / ${staffScheduled}`}
              icon={<Users className="h-4 w-4" />}
              accent="#0ea5e9"
            />
          </div>
        )}

        {scope === 'owner' && (
          <div className="grid grid-cols-2 gap-3">
            <GlanceKpiWidget
              label="Today's revenue"
              value={formatCurrency(todayRevenue)}
              icon={<DollarSign className="h-4 w-4" />}
              accent="#10b981"
            />
            <GlanceKpiWidget
              label="Last 7 days"
              value={formatCurrency(weekRevenue)}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="#8b5cf6"
            />
          </div>
        )}

        {(scope === 'supervisor' || scope === 'manager') && (
          <ActionQueueWidget
            title="Floor Alerts"
            icon={<AlertOctagon className="h-4 w-4" />}
            accent="#ef4444"
            items={alertItems}
            emptyLabel="No open floor alerts"
            loading={loading}
          />
        )}

        {scope === 'owner' && alerts.length > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4">
            <Bell className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">
                {alerts.length} open floor alert{alerts.length === 1 ? '' : 's'} right now
              </p>
              <p className="text-xs text-white/60">Handled by your floor team — visibility only here</p>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 gap-3 ${forwardLinksByScope[scope].length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {forwardLinksByScope[scope].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center justify-between rounded-2xl border border-white/10 p-4 transition-colors hover:bg-white/5"
            >
              <span className="text-sm font-medium text-white/80">
                {link.label}
              </span>
              <ArrowUpRight className="h-4 w-4 text-white/40" />
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
