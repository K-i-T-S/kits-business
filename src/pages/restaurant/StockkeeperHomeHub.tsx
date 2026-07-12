import { AlertTriangle, ArrowUpRight, Boxes, PackageCheck, ShoppingCart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { ActionQueueWidget, type ActionQueueItem } from '@/components/hub-widgets/ActionQueueWidget';
import { GlanceKpiWidget } from '@/components/hub-widgets/GlanceKpiWidget';
import Layout from '@/components/Layout';
import { RESTAURANT_COLORS } from '@/constants/restaurantColors';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';
import { formatCurrency } from '@/utils/formatting';

interface LowStockIngredient {
  id: string;
  name: string;
  current_stock: number;
  par_level: number;
  unit: string;
}

interface PendingPO {
  id: string;
  order_number: string;
  total_estimated: number;
  expected_date: string | null;
}

/**
 * Track 2, Phase B prototype (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md):
 * built to genuinely pressure-test whether ActionQueueWidget/GlanceKpiWidget
 * reused across office-role hubs can still feel meaningfully different —
 * NOT yet wired into home_hub or any route/RoleRoute. Both queue actions
 * here are real single-tap resolutions of real backend state (no "assign
 * a category" sub-choice, which would need more than one tap to be honest
 * about) — deliberately not identical in shape to AccountantHomeHub, since
 * a stockkeeper's real day-to-day genuinely has more open action items.
 */
export default function StockkeeperHomeHub() {
  const { currentTenant } = useApp();
  const [lowStock, setLowStock] = useState<LowStockIngredient[]>([]);
  const [pendingPOs, setPendingPOs] = useState<PendingPO[]>([]);
  const [belowParCount, setBelowParCount] = useState(0);
  const [openPoValue, setOpenPoValue] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const [ingredientsRes, posRes] = await Promise.all([
        supabase
          .from('restaurant_ingredients')
          .select('id, name, current_stock, par_level, unit')
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true)
          .gt('par_level', 0)
          .order('name'),
        supabase
          .from('restaurant_purchase_orders')
          .select('id, order_number, total_estimated, expected_date, status')
          .eq('tenant_id', currentTenant.id)
          .in('status', ['draft', 'ordered']),
      ]);

      const allIngredients = (ingredientsRes.data ?? []) as LowStockIngredient[];
      const below = allIngredients.filter((i) => i.current_stock < i.par_level);
      setLowStock(below.slice(0, 8));
      setBelowParCount(below.length);

      const allPOs = (posRes.data ?? []) as Array<PendingPO & { status: string }>;
      setPendingPOs(allPOs.filter((po) => po.status === 'ordered').slice(0, 8));
      setOpenPoValue(allPOs.reduce((sum, po) => sum + (po.total_estimated ?? 0), 0));
    } catch (err) {
      toast.error('Failed to load stockkeeper hub', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [currentTenant]);

  useEffect(() => { void load(); }, [load]);

  const handleGeneratePOs = useCallback(async () => {
    if (!currentTenant) return;
    try {
      const rpcResult = await supabase.rpc('generate_low_stock_purchase_orders');
      if (rpcResult.error) throw rpcResult.error;
      const count = typeof rpcResult.data === 'number' ? rpcResult.data : 0;
      toast.success(count > 0 ? `${count} purchase order${count === 1 ? '' : 's'} generated` : 'No new purchase orders needed');
      await load();
    } catch (err) {
      toast.error('Failed to generate purchase order', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [currentTenant, load]);

  const handleMarkReceived = useCallback(async (poId: string) => {
    try {
      const { data: items, error: itemsErr } = await supabase
        .from('restaurant_purchase_order_items')
        .select('id, ingredient_id, quantity_ordered')
        .eq('purchase_order_id', poId);
      if (itemsErr) throw itemsErr;

      for (const item of (items ?? []) as Array<{ ingredient_id: string; quantity_ordered: number }>) {
        const { data: ingredient } = await supabase
          .from('restaurant_ingredients')
          .select('current_stock')
          .eq('id', item.ingredient_id)
          .single();
        const current = (ingredient as { current_stock: number } | null)?.current_stock ?? 0;
        await supabase
          .from('restaurant_ingredients')
          .update({ current_stock: current + item.quantity_ordered, last_restocked_at: new Date().toISOString() })
          .eq('id', item.ingredient_id);
      }

      await supabase
        .from('restaurant_purchase_orders')
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

  const lowStockItems: ActionQueueItem[] = lowStock.map((i) => ({
    id: i.id,
    title: i.name,
    subtitle: `${i.current_stock} ${i.unit} in stock`,
    meta: `par ${i.par_level} ${i.unit}`,
    urgent: i.current_stock <= 0,
    actionLabel: 'Generate PO',
    onAction: handleGeneratePOs,
  }));

  const receivingItems: ActionQueueItem[] = pendingPOs.map((po) => ({
    id: po.id,
    title: po.order_number,
    subtitle: po.expected_date ? `Expected ${po.expected_date}` : 'No expected date',
    meta: formatCurrency(po.total_estimated),
    actionLabel: 'Mark Received',
    onAction: () => handleMarkReceived(po.id),
  }));

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: RESTAURANT_COLORS.textPrimary }}>Stockkeeper</h1>
          <p className="text-sm" style={{ color: RESTAURANT_COLORS.textMuted }}>{currentTenant?.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <GlanceKpiWidget
            label="Below par level"
            value={String(belowParCount)}
            icon={<AlertTriangle className="h-4 w-4" />}
            accent={belowParCount > 0 ? '#ef4444' : '#10b981'}
          />
          <GlanceKpiWidget
            label="Open PO value"
            value={formatCurrency(openPoValue)}
            icon={<ShoppingCart className="h-4 w-4" />}
            accent="#f59e0b"
          />
        </div>

        <ActionQueueWidget
          title="Low Stock"
          icon={<Boxes className="h-4 w-4" />}
          accent="#ef4444"
          items={lowStockItems}
          emptyLabel="Everything's above par level"
          loading={loading}
        />

        <ActionQueueWidget
          title="Awaiting Receipt"
          icon={<PackageCheck className="h-4 w-4" />}
          accent="#0ea5e9"
          items={receivingItems}
          emptyLabel="No purchase orders awaiting receipt"
          loading={loading}
        />

        <Link
          to="/restaurant/recipes"
          className="flex items-center justify-between rounded-2xl border p-4 transition-colors hover:bg-white/5"
          style={{ borderColor: RESTAURANT_COLORS.border }}
        >
          <span className="text-sm font-medium" style={{ color: RESTAURANT_COLORS.textSecondary }}>
            Open full inventory, recipes & purchase orders
          </span>
          <ArrowUpRight className="h-4 w-4" style={{ color: RESTAURANT_COLORS.textMuted }} />
        </Link>
      </div>
    </Layout>
  );
}
