import { AlertTriangle, Pill } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { GlanceKpiWidget } from '@/components/hub-widgets/GlanceKpiWidget';
import Layout from '@/components/Layout';
import { HUB_WIDGET_CATALOG } from '@/constants/hubWidgets';
import { useApp } from '@/context/AppContext';
import { loadVisibleWidgetIds } from '@/utils/hubWidgetConfig';
import { supabase } from '@/utils/supabaseClient';
import { formatCurrency } from '@/utils/formatting';

const EXPIRY_WINDOW_DAYS = 30;

/**
 * Pharmacy vertical hub equivalent to restaurant's StockkeeperHomeHub.
 * KPI-only by design -- drug_lots has no status/reorder-point field to
 * hang a genuine one-tap "resolve" action on (unlike restaurant's
 * generate_low_stock_purchase_orders() RPC or supermarket's generic
 * purchase_orders table), so there's no real queue to build here without
 * faking an action the schema doesn't support.
 */
export default function PharmacyStockkeeperHub() {
  const { currentTenant } = useApp();
  const [expiringLotsCount, setExpiringLotsCount] = useState(0);
  const [expiringValue, setExpiringValue] = useState(0);

  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>(
    () => HUB_WIDGET_CATALOG.pharmacy_stockkeeper.map((w) => w.id),
  );
  useEffect(() => {
    const tenantId = currentTenant?.id;
    if (!tenantId) return;
    void loadVisibleWidgetIds(tenantId, 'pharmacy_stockkeeper')
      .then(setVisibleWidgetIds)
      .catch(() => {
        // Best-effort -- keep the catalog-default order already showing.
      });
  }, [currentTenant?.id]);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + EXPIRY_WINDOW_DAYS);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('drug_lots')
        .select('quantity_remaining, unit_cost')
        .eq('tenant_id', currentTenant.id)
        .lte('expiry_date', cutoffStr)
        .gt('quantity_remaining', 0);
      if (error) throw error;

      const lots = (data ?? []) as Array<{ quantity_remaining: number; unit_cost: number }>;
      setExpiringLotsCount(lots.length);
      setExpiringValue(lots.reduce((sum, l) => sum + l.quantity_remaining * (l.unit_cost ?? 0), 0));
    } catch (err) {
      toast.error('Failed to load pharmacy stockkeeper hub', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
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

  const widgetRenderers: Record<string, ReactNode> = {
    'pharmacy_stockkeeper.expiring_lots_kpi': (
      <GlanceKpiWidget
        label={`Lots expiring ≤${EXPIRY_WINDOW_DAYS} days`}
        value={String(expiringLotsCount)}
        icon={<AlertTriangle className="h-4 w-4" />}
        accent={expiringLotsCount > 0 ? '#ef4444' : '#10b981'}
      />
    ),
    'pharmacy_stockkeeper.expiring_value_kpi': (
      <GlanceKpiWidget
        label="Expiring value (30d)"
        value={formatCurrency(expiringValue)}
        icon={<Pill className="h-4 w-4" />}
        accent="#f59e0b"
      />
    ),
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Pharmacy Stockkeeper</h1>
          <p className="text-sm text-white/40">{currentTenant?.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {visibleWidgetIds.map((id) => (
            <div key={id}>{widgetRenderers[id]}</div>
          ))}
        </div>

        <Link
          to="/pharmacy/drugs"
          className="flex items-center justify-between rounded-2xl border border-white/10 p-4 transition-colors hover:bg-white/5"
        >
          <span className="text-sm font-medium text-white/80">
            Open full Drug Database
          </span>
          <Pill className="h-4 w-4 text-white/40" />
        </Link>
      </div>
    </Layout>
  );
}
