import { DollarSign, FileText, ShieldCheck, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { ActionQueueWidget, type ActionQueueItem } from '@/components/hub-widgets/ActionQueueWidget';
import { GlanceKpiWidget } from '@/components/hub-widgets/GlanceKpiWidget';
import Layout from '@/components/Layout';
import { HUB_WIDGET_CATALOG, type HubKey } from '@/constants/hubWidgets';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { loadVisibleWidgetIds } from '@/utils/hubWidgetConfig';
import { formatCurrency } from '@/utils/formatting';
import { supabase } from '@/utils/supabaseClient';

interface PendingClaim {
  id: string;
  patient_name: string;
  provider: string;
  copay_amount: number;
  currency: string;
  claim_date: string;
}

/**
 * Pharmacy vertical hub equivalent to restaurant's OperationsHomeHub --
 * owner/manager/supervisor share one adaptive component at different
 * altitude, same architecture decision as restaurant's version.
 */
export default function PharmacyOperationsHub() {
  const { currentTenant } = useApp();
  const { role } = useSubscription();

  const scope: 'owner' | 'manager' | 'supervisor' = useMemo(() => {
    if (role === 'owner' || role === 'admin') return 'owner';
    if (role === 'manager') return 'manager';
    return 'supervisor';
  }, [role]);

  const hubKey: HubKey = `pharmacy_operations_${scope}`;
  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>(
    () => HUB_WIDGET_CATALOG[hubKey].map((w) => w.id),
  );
  useEffect(() => {
    const tenantId = currentTenant?.id;
    if (!tenantId) return;
    void loadVisibleWidgetIds(tenantId, hubKey)
      .then(setVisibleWidgetIds)
      .catch(() => {
        // Best-effort -- keep the catalog-default order already showing.
      });
  }, [currentTenant?.id, hubKey]);

  const [todayRevenue, setTodayRevenue] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [pendingPrescriptions, setPendingPrescriptions] = useState(0);
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const [salesTodayRes, salesWeekRes, prescriptionsRes, claimsRes] = await Promise.all([
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
        supabase
          .from('prescriptions')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'pending'),
        supabase
          .from('pharmacy_insurance_claims')
          .select('id, patient_name, provider, copay_amount, currency, claim_date, status')
          .eq('tenant_id', currentTenant.id)
          .in('status', ['pending', 'submitted'])
          .order('claim_date', { ascending: true })
          .limit(8),
      ]);

      const sumTotal = (rows: unknown) =>
        ((rows ?? []) as Array<{ total_amount: number }>).reduce((sum, s) => sum + (s.total_amount ?? 0), 0);
      setTodayRevenue(sumTotal(salesTodayRes.data));
      setWeekRevenue(sumTotal(salesWeekRes.data));
      setPendingPrescriptions(prescriptionsRes.count ?? 0);

      const claims = (claimsRes.data ?? []) as Array<PendingClaim & { status: string }>;
      setPendingClaimsCount(claims.length);
      setPendingClaims(claims.filter((c) => c.status === 'pending'));
    } catch (err) {
      toast.error('Failed to load pharmacy operations hub', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [currentTenant]);

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    void load();
    refreshIntervalRef.current = setInterval(() => { void load(); }, 30000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [load]);

  const handleMarkSubmitted = useCallback(async (claimId: string) => {
    try {
      const { error } = await supabase
        .from('pharmacy_insurance_claims')
        .update({ status: 'submitted' })
        .eq('id', claimId);
      if (error) throw error;
      toast.success('Claim marked submitted');
      await load();
    } catch (err) {
      toast.error('Failed to update claim', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [load]);

  const claimItems: ActionQueueItem[] = pendingClaims.map((c) => ({
    id: c.id,
    title: c.patient_name,
    subtitle: c.provider,
    meta: `${c.currency === 'USD' ? '$' : 'LBP '}${c.copay_amount.toFixed(2)}`,
    actionLabel: 'Submitted',
    onAction: () => handleMarkSubmitted(c.id),
  }));

  const titleByScope: Record<typeof scope, string> = {
    owner: 'Business Overview',
    manager: 'Manager Overview',
    supervisor: 'Pharmacy Operations',
  };

  const widgetRenderers: Record<string, ReactNode> = {
    'pharmacy_operations.today_revenue_kpi': (
      <GlanceKpiWidget
        label="Today's revenue"
        value={formatCurrency(todayRevenue)}
        icon={<DollarSign className="h-4 w-4" />}
        accent="#10b981"
      />
    ),
    'pharmacy_operations.week_revenue_kpi': (
      <GlanceKpiWidget
        label="Last 7 days"
        value={formatCurrency(weekRevenue)}
        icon={<TrendingUp className="h-4 w-4" />}
        accent="#8b5cf6"
      />
    ),
    'pharmacy_operations.pending_prescriptions_kpi': (
      <GlanceKpiWidget
        label="Pending prescriptions"
        value={String(pendingPrescriptions)}
        icon={<FileText className="h-4 w-4" />}
        accent="#0ea5e9"
      />
    ),
    'pharmacy_operations.insurance_claims_kpi': (
      <GlanceKpiWidget
        label="Insurance claims pending"
        value={String(pendingClaimsCount)}
        icon={<ShieldCheck className="h-4 w-4" />}
        accent="#8b5cf6"
      />
    ),
    'pharmacy_operations.insurance_claims_queue': (
      <ActionQueueWidget
        title="Insurance Claims Pending"
        icon={<ShieldCheck className="h-4 w-4" />}
        accent="#8b5cf6"
        items={claimItems}
        emptyLabel="No claims awaiting submission"
        loading={loading}
      />
    ),
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">{titleByScope[scope]}</h1>
          <p className="text-sm text-white/40">{currentTenant?.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {visibleWidgetIds.map((id) => (
            <div key={id} className={id.endsWith('_queue') ? 'col-span-2' : ''}>
              {widgetRenderers[id]}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
