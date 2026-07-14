import { AlertTriangle, DollarSign, PackageCheck, ShoppingBasket, TrendingUp } from 'lucide-react';
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

const EXPIRY_WINDOW_DAYS = 30;

interface PendingPO {
  id: string;
  order_number: string;
  total_amount: number;
  expected_delivery: string | null;
}

/**
 * Supermarket vertical hub equivalent to restaurant's OperationsHomeHub --
 * owner/manager/supervisor share one adaptive component at different
 * altitude, same architecture decision as restaurant's version.
 */
export default function SupermarketOperationsHub() {
  const { currentTenant } = useApp();
  const { role } = useSubscription();

  const scope: 'owner' | 'manager' | 'supervisor' = useMemo(() => {
    if (role === 'owner' || role === 'admin') return 'owner';
    if (role === 'manager') return 'manager';
    return 'supervisor';
  }, [role]);

  const hubKey: HubKey = `supermarket_operations_${scope}`;
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
  const [belowParCount, setBelowParCount] = useState(0);
  const [expiringLotsCount, setExpiringLotsCount] = useState(0);
  const [pendingPOs, setPendingPOs] = useState<PendingPO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const expiryCutoff = new Date();
      expiryCutoff.setDate(expiryCutoff.getDate() + EXPIRY_WINDOW_DAYS);
      const expiryCutoffStr = expiryCutoff.toISOString().slice(0, 10);

      const [salesTodayRes, salesWeekRes, productsRes, lotsRes, posRes] = await Promise.all([
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
          .from('products')
          .select('id, stock_quantity, min_stock_level')
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true),
        supabase
          .from('grocery_lots')
          .select('id')
          .eq('tenant_id', currentTenant.id)
          .lte('expiry_date', expiryCutoffStr)
          .gt('quantity_remaining', 0),
        supabase
          .from('purchase_orders')
          .select('id, order_number, total_amount, expected_delivery, status')
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'ordered')
          .order('expected_delivery', { ascending: true })
          .limit(8),
      ]);

      const sumTotal = (rows: unknown) =>
        ((rows ?? []) as Array<{ total_amount: number }>).reduce((sum, s) => sum + (s.total_amount ?? 0), 0);
      setTodayRevenue(sumTotal(salesTodayRes.data));
      setWeekRevenue(sumTotal(salesWeekRes.data));

      const products = (productsRes.data ?? []) as Array<{ stock_quantity: number; min_stock_level: number | null }>;
      setBelowParCount(products.filter((p) => p.min_stock_level !== null && p.stock_quantity < p.min_stock_level).length);

      setExpiringLotsCount((lotsRes.data ?? []).length);
      setPendingPOs((posRes.data ?? []) as PendingPO[]);
    } catch (err) {
      toast.error('Failed to load supermarket operations hub', {
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

  const handleMarkReceived = useCallback(async (poId: string) => {
    try {
      const { data: items, error: itemsErr } = await supabase
        .from('purchase_order_items')
        .select('product_id, quantity_ordered')
        .eq('purchase_order_id', poId);
      if (itemsErr) throw itemsErr;

      // Atomic delta RPC (migration 20260712_000078) rather than a
      // read-then-write race -- the same bug class already found and
      // fixed twice elsewhere in the platform this session.
      for (const item of (items ?? []) as Array<{ product_id: string; quantity_ordered: number }>) {
        const { error: deltaError } = await supabase.rpc('apply_product_stock_delta', {
          p_product_id: item.product_id,
          p_delta: item.quantity_ordered,
        });
        if (deltaError) throw deltaError;
      }

      await supabase
        .from('purchase_orders')
        .update({ status: 'received', received_at: new Date().toISOString() })
        .eq('id', poId);

      toast.success('Purchase order marked received — stock updated');
      await load();
    } catch (err) {
      toast.error('Failed to mark received', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [load]);

  const poItems: ActionQueueItem[] = pendingPOs.map((po) => ({
    id: po.id,
    title: po.order_number,
    subtitle: po.expected_delivery ? `Expected ${po.expected_delivery}` : 'No expected date',
    meta: `$${po.total_amount.toFixed(2)}`,
    actionLabel: 'Mark Received',
    onAction: () => handleMarkReceived(po.id),
  }));

  const titleByScope: Record<typeof scope, string> = {
    owner: 'Business Overview',
    manager: 'Manager Overview',
    supervisor: 'Store Operations',
  };

  const widgetRenderers: Record<string, ReactNode> = {
    'supermarket_operations.today_revenue_kpi': (
      <GlanceKpiWidget
        label="Today's revenue"
        value={formatCurrency(todayRevenue)}
        icon={<DollarSign className="h-4 w-4" />}
        accent="#10b981"
      />
    ),
    'supermarket_operations.week_revenue_kpi': (
      <GlanceKpiWidget
        label="Last 7 days"
        value={formatCurrency(weekRevenue)}
        icon={<TrendingUp className="h-4 w-4" />}
        accent="#8b5cf6"
      />
    ),
    'supermarket_operations.below_par_kpi': (
      <GlanceKpiWidget
        label="Below par level"
        value={String(belowParCount)}
        icon={<AlertTriangle className="h-4 w-4" />}
        accent={belowParCount > 0 ? '#ef4444' : '#10b981'}
      />
    ),
    'supermarket_operations.expiring_lots_kpi': (
      <GlanceKpiWidget
        label={`Lots expiring ≤${EXPIRY_WINDOW_DAYS} days`}
        value={String(expiringLotsCount)}
        icon={<ShoppingBasket className="h-4 w-4" />}
        accent={expiringLotsCount > 0 ? '#f59e0b' : '#10b981'}
      />
    ),
    'supermarket_operations.awaiting_receipt_queue': (
      <ActionQueueWidget
        title="Awaiting Receipt"
        icon={<PackageCheck className="h-4 w-4" />}
        accent="#0ea5e9"
        items={poItems}
        emptyLabel="No purchase orders awaiting receipt"
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
