import { ChefHat, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import OrderTicket from '@/components/restaurant/OrderTicket';
import { useApp } from '@/context/AppContext';
import type { RestaurantOrderItem, TableOrder, RestaurantTable } from '@/types/restaurant';
import { supabase } from '@/utils/supabaseClient';

interface TicketData {
  order: TableOrder;
  table: RestaurantTable | null;
  items: RestaurantOrderItem[];
}

export default function KitchenDisplay() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadTickets = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [ordersRes, itemsRes, tablesRes] = await Promise.all([
        supabase.from('table_orders').select('*').eq('tenant_id', tenantId).eq('status', 'open'),
        supabase.from('restaurant_order_items')
          .select('*')
          .eq('tenant_id', tenantId)
          .in('status', ['pending', 'in_progress', 'ready'])
          .order('sent_at', { ascending: true }),
        supabase.from('restaurant_tables').select('*').eq('tenant_id', tenantId),
      ]);

      const orders = (ordersRes.data ?? []) as TableOrder[];
      const items = (itemsRes.data ?? []) as RestaurantOrderItem[];
      const tables = (tablesRes.data ?? []) as RestaurantTable[];

      const tableMap = new Map(tables.map((t) => [t.id, t]));

      const built: TicketData[] = orders
        .map((order) => {
          const orderItems = items.filter((i) => i.order_id === order.id);
          return {
            order,
            table: order.table_id ? (tableMap.get(order.table_id) ?? null) : null,
            items: orderItems,
          };
        })
        .filter((t) => t.items.length > 0);

      setTickets(built);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[KDS] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadTickets();
    const interval = setInterval(() => { void loadTickets(); }, 30_000);
    return () => clearInterval(interval);
  }, [loadTickets]);

  const handleBumpItem = async (itemId: string) => {
    const { error } = await supabase
      .from('restaurant_order_items')
      .update({ status: 'ready', ready_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) { toast.error(error.message); return; }
    setTickets((prev) =>
      prev.map((ticket) => ({
        ...ticket,
        items: ticket.items.map((i) => i.id === itemId ? { ...i, status: 'ready', ready_at: new Date().toISOString() } : i),
      })),
    );
  };

  const handleBumpAll = async (orderId: string) => {
    const ticket = tickets.find((t) => t.order.id === orderId);
    if (!ticket) return;
    const pendingIds = ticket.items
      .filter((i) => i.status === 'pending' || i.status === 'in_progress')
      .map((i) => i.id);
    if (pendingIds.length === 0) return;
    const { error } = await supabase
      .from('restaurant_order_items')
      .update({ status: 'ready', ready_at: new Date().toISOString() })
      .in('id', pendingIds);
    if (error) { toast.error(error.message); return; }
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.order.id === orderId
          ? {
            ...ticket,
            items: ticket.items.map((i) =>
              pendingIds.includes(i.id) ? { ...i, status: 'ready', ready_at: new Date().toISOString() } : i,
            ),
          }
          : ticket,
      ),
    );
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* KDS Header bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">{t('restaurant.kds.title', 'Kitchen Display System')}</h1>
            <p className="text-[10px] text-white/40">
              {t('restaurant.kds.activeOrders', 'Active orders')}: {tickets.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] text-white/40">
              {t('restaurant.kds.lastRefresh', 'Refreshed')} {formatTime(lastRefresh)}
            </span>
          </div>
          <button
            onClick={() => { void loadTickets(); }}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 border-b border-white/5 bg-slate-900/50 px-6 py-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-white/40">{t('restaurant.kds.fresh', 'Fresh (< 5 min)')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          <span className="text-[11px] text-white/40">{t('restaurant.kds.warming', 'Warming (5–10 min)')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-[11px] text-white/40">{t('restaurant.kds.urgent', 'Urgent (> 10 min)')}</span>
        </div>
      </div>

      {/* Ticket grid */}
      <div className="p-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <ChefHat className="h-12 w-12 text-white/10" />
            <p className="text-white/30">{t('restaurant.kds.noTickets', 'No active tickets — all caught up!')}</p>
            <div className="flex items-center gap-1.5 text-emerald-400/60">
              <WifiOff className="h-3.5 w-3.5" />
              <span className="text-xs">{t('restaurant.kds.autoRefresh', 'Auto-refreshes every 30 seconds')}</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tickets.map((ticket) => (
              <OrderTicket
                key={ticket.order.id}
                tableNumber={ticket.table?.number ?? 0}
                tableName={ticket.table?.name ?? null}
                orderId={ticket.order.id}
                items={ticket.items}
                openedAt={ticket.order.opened_at}
                onBump={(itemId) => { void handleBumpItem(itemId); }}
                onBumpAll={() => { void handleBumpAll(ticket.order.id); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
