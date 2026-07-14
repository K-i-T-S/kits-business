import { FileText, ShieldCheck } from 'lucide-react';
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

interface PendingClaim {
  id: string;
  patient_name: string;
  provider: string;
  copay_amount: number;
  currency: string;
  claim_date: string;
}

/**
 * Pharmacy vertical hub equivalent to restaurant's WaiterInterface -- the
 * counter role's day-to-day. Prescription filling is deliberately NOT a
 * one-tap queue action here (dispensing is a real per-drug-item choice
 * with its own quantities, kept in the full Prescriptions.tsx workflow --
 * faking a "Mark Filled" single-tap would misrepresent what actually
 * happens). Insurance claims genuinely do have a one-tap pending ->
 * submitted transition (InsuranceCoPay.tsx's own updateStatus() pattern),
 * so that's the real queue here.
 */
export default function PharmacyCounterHub() {
  const { currentTenant } = useApp();
  const [pendingPrescriptions, setPendingPrescriptions] = useState(0);
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>(
    () => HUB_WIDGET_CATALOG.pharmacy_counter.map((w) => w.id),
  );
  useEffect(() => {
    const tenantId = currentTenant?.id;
    if (!tenantId) return;
    void loadVisibleWidgetIds(tenantId, 'pharmacy_counter')
      .then(setVisibleWidgetIds)
      .catch(() => {
        // Best-effort -- keep the catalog-default order already showing.
      });
  }, [currentTenant?.id]);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const [prescriptionsRes, claimsRes] = await Promise.all([
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

      setPendingPrescriptions(prescriptionsRes.count ?? 0);
      const claims = (claimsRes.data ?? []) as Array<PendingClaim & { status: string }>;
      setPendingClaimsCount(claims.length);
      setPendingClaims(claims.filter((c) => c.status === 'pending'));
    } catch (err) {
      toast.error('Failed to load pharmacy counter hub', {
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

  const widgetRenderers: Record<string, ReactNode> = {
    'pharmacy_counter.pending_prescriptions_kpi': (
      <GlanceKpiWidget
        label="Pending prescriptions"
        value={String(pendingPrescriptions)}
        icon={<FileText className="h-4 w-4" />}
        accent="#0ea5e9"
      />
    ),
    'pharmacy_counter.insurance_claims_kpi': (
      <GlanceKpiWidget
        label="Insurance claims pending"
        value={String(pendingClaimsCount)}
        icon={<ShieldCheck className="h-4 w-4" />}
        accent="#8b5cf6"
      />
    ),
    'pharmacy_counter.insurance_claims_queue': (
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
          <h1 className="text-xl font-bold text-white">Pharmacy Counter</h1>
          <p className="text-sm text-white/40">{currentTenant?.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {visibleWidgetIds.map((id) => (
            <div key={id} className={id.endsWith('_queue') ? 'col-span-2' : ''}>
              {widgetRenderers[id]}
            </div>
          ))}
        </div>

        <Link
          to="/pharmacy/prescriptions"
          className="flex items-center justify-between rounded-2xl border border-white/10 p-4 transition-colors hover:bg-white/5"
        >
          <span className="text-sm font-medium text-white/80">
            Open full Prescriptions
          </span>
          <FileText className="h-4 w-4 text-white/40" />
        </Link>
      </div>
    </Layout>
  );
}
