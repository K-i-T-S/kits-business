import { AlertTriangle, PackageCheck, ShoppingBasket } from 'lucide-react';
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

const EXPIRY_WINDOW_DAYS = 30;

interface PendingPO {
  id: string;
  order_number: string;
  total_amount: number;
  expected_delivery: string | null;
}

/**
 * Supermarket vertical hub equivalent to restaurant's StockkeeperHomeHub --
 * uses the generic (non-restaurant) products/purchase_orders schema, the
 * same tables PurchaseOrderManagement.tsx/Inventory.tsx already work with,
 * plus grocery_lots for expiry (the data ExpiryDashboard.tsx/
 * ShelfLifeTracker.tsx already surface in full).
 */
export default function SupermarketStockkeeperHub() {
  const { currentTenant } = useApp();
  const [belowParCount, setBelowParCount] = useState(0);
  const [expiringLotsCount, setExpiringLotsCount] = useState(0);
  const [pendingPOs, setPendingPOs] = useState<PendingPO[]>([]);
  const [loading, setLoading] = useState(true);

  const [visibleWidgetIds, setVisibleWidgetIds] = useState<string[]>(
    () => HUB_WIDGET_CATALOG.supermarket_stockkeeper.map((w) => w.id),
  );
  useEffect(() => {
    const tenantId = currentTenant?.id;
    if (!tenantId) return;
    void loadVisibleWidgetIds(tenantId, 'supermarket_stockkeeper')
      .then(setVisibleWidgetIds)
      .catch(() => {
        // Best-effort -- keep the catalog-default order already showing.
      });
  }, [currentTenant?.id]);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + EXPIRY_WINDOW_DAYS);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const [productsRes, lotsRes, posRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, stock_quantity, min_stock_level')
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true),
        supabase
          .from('grocery_lots')
          .select('id')
          .eq('tenant_id', currentTenant.id)
          .lte('expiry_date', cutoffStr)
          .gt('quantity_remaining', 0),
        supabase
          .from('purchase_orders')
          .select('id, order_number, total_amount, expected_delivery, status')
          .eq('tenant_id', currentTenant.id)
          .eq('status', 'ordered')
          .order('expected_delivery', { ascending: true })
          .limit(8),
      ]);

      const products = (productsRes.data ?? []) as Array<{ stock_quantity: number; min_stock_level: number | null }>;
      setBelowParCount(products.filter((p) => p.min_stock_level !== null && p.stock_quantity < p.min_stock_level).length);

      setExpiringLotsCount((lotsRes.data ?? []).length);

      setPendingPOs((posRes.data ?? []) as PendingPO[]);
    } catch (err) {
      toast.error('Failed to load supermarket stockkeeper hub', {
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

  const widgetRenderers: Record<string, ReactNode> = {
    'supermarket_stockkeeper.below_par_kpi': (
      <GlanceKpiWidget
        label="Below par level"
        value={String(belowParCount)}
        icon={<AlertTriangle className="h-4 w-4" />}
        accent={belowParCount > 0 ? '#ef4444' : '#10b981'}
      />
    ),
    'supermarket_stockkeeper.expiring_lots_kpi': (
      <GlanceKpiWidget
        label={`Lots expiring ≤${EXPIRY_WINDOW_DAYS} days`}
        value={String(expiringLotsCount)}
        icon={<ShoppingBasket className="h-4 w-4" />}
        accent={expiringLotsCount > 0 ? '#f59e0b' : '#10b981'}
      />
    ),
    'supermarket_stockkeeper.awaiting_receipt_queue': (
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
          <h1 className="text-xl font-bold text-white">Stockkeeper</h1>
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
            to="/supermarket/shelf-life"
            className="flex items-center justify-between rounded-2xl border border-white/10 p-4 transition-colors hover:bg-white/5"
          >
            <span className="text-sm font-medium text-white/80">
              Open Shelf Life Tracker
            </span>
            <ShoppingBasket className="h-4 w-4 text-white/40" />
          </Link>
          <Link
            to="/inventory/purchase-orders"
            className="flex items-center justify-between rounded-2xl border border-white/10 p-4 transition-colors hover:bg-white/5"
          >
            <span className="text-sm font-medium text-white/80">
              Open full Purchase Orders
            </span>
            <PackageCheck className="h-4 w-4 text-white/40" />
          </Link>
        </div>
      </div>
    </Layout>
  );
}
