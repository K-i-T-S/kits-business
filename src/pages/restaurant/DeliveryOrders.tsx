import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';

import FeatureGate from '@/components/FeatureGate';
import Layout from '@/components/Layout';
import RoleGate from '@/components/RoleGate';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/utils/supabaseClient';

type DeliveryOrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'cancelled';

interface DeliveryOrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  modifiers?: Array<{ name: string; price_delta: number }>;
}

interface DeliveryOrder {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  platform: 'toters' | 'zomato' | 'talabat' | 'careem_food';
  external_order_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  items: DeliveryOrderItem[];
  subtotal_usd: number;
  delivery_fee_usd: number;
  total_usd: number;
  status: DeliveryOrderStatus;
  received_at: string;
}

const PLATFORM_BADGES: Record<DeliveryOrder['platform'], { label: string; bg: string }> = {
  talabat: { label: 'Talabat', bg: 'bg-orange-600' },
  toters: { label: 'Toters', bg: 'bg-green-600' },
  zomato: { label: 'Zomato', bg: 'bg-red-600' },
  careem_food: { label: 'Careem Food', bg: 'bg-emerald-600' },
};

const ACTIVE_STATUSES: DeliveryOrderStatus[] = ['new', 'accepted', 'preparing', 'ready'];
const POLL_INTERVAL_MS = 30_000;

interface OrderCardProps {
  order: DeliveryOrder;
  onAccept: (id: string) => void | Promise<void>;
  onReject: (id: string) => void | Promise<void>;
  onStartPrep: (id: string) => void | Promise<void>;
  onMarkReady: (id: string) => void | Promise<void>;
  onMarkPickedUp: (id: string) => void | Promise<void>;
}

function OrderCard({ order, onAccept, onReject, onStartPrep, onMarkReady, onMarkPickedUp }: OrderCardProps) {
  const { t } = useTranslation();
  const badge = PLATFORM_BADGES[order.platform];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${badge.bg}`}>
          {badge.label}
        </span>
        <span className="text-xs text-white/40">{order.external_order_id}</span>
      </div>
      <p className="text-sm text-white">{order.customer_name ?? t('deliveryOrders.noName', 'Guest')}</p>
      <p className="text-xs text-white/50">{order.customer_phone}</p>
      <p className="text-xs text-white/50">{order.delivery_address}</p>
      <ul className="text-xs text-white/70 space-y-0.5">
        {order.items.map((item, idx) => (
          <li key={idx}>{item.quantity}× {item.name}</li>
        ))}
      </ul>
      <p className="text-sm font-semibold text-white">${order.total_usd.toFixed(2)}</p>
      <div className="flex gap-2 pt-1">
        {order.status === 'new' && (
          <>
            <button onClick={() => { void onAccept(order.id); }} className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
              {t('deliveryOrders.accept', 'Accept')}
            </button>
            <button onClick={() => { void onReject(order.id); }} className="flex-1 rounded-lg bg-red-600/80 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
              {t('deliveryOrders.reject', 'Reject')}
            </button>
          </>
        )}
        {order.status === 'accepted' && (
          <>
            <button onClick={() => { void onStartPrep(order.id); }} className="flex-1 rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">
              {t('deliveryOrders.startPrep', 'Start Prep')}
            </button>
            <button onClick={() => { void onReject(order.id); }} className="flex-1 rounded-lg bg-red-600/80 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
              {t('deliveryOrders.cancel', 'Cancel')}
            </button>
          </>
        )}
        {order.status === 'preparing' && (
          <>
            <button onClick={() => { void onMarkReady(order.id); }} className="flex-1 rounded-lg bg-sky-600 py-1.5 text-xs font-semibold text-white hover:bg-sky-500">
              {t('deliveryOrders.markReady', 'Mark Ready')}
            </button>
            <button onClick={() => { void onReject(order.id); }} className="flex-1 rounded-lg bg-red-600/80 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
              {t('deliveryOrders.cancel', 'Cancel')}
            </button>
          </>
        )}
        {order.status === 'ready' && (
          <>
            <button onClick={() => { void onMarkPickedUp(order.id); }} className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
              {t('deliveryOrders.markPickedUp', 'Mark Picked Up')}
            </button>
            <button onClick={() => { void onReject(order.id); }} className="flex-1 rounded-lg bg-red-600/80 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
              {t('deliveryOrders.cancel', 'Cancel')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const COLUMNS: Array<{ status: DeliveryOrderStatus; label: string }> = [
  { status: 'new', label: 'New' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
];

export default function DeliveryOrders() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);

  const loadOrders = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('restaurant_delivery_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ACTIVE_STATUSES)
      .order('received_at');
    if (data) setOrders(data as DeliveryOrder[]);
  }, [tenantId]);

  useEffect(() => {
    void loadOrders();
    const interval = setInterval(() => { void loadOrders(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleAccept = async (id: string) => {
    const { error } = await supabase.rpc('accept_delivery_order', { p_delivery_order_id: id });
    if (error) { toast.error(t('deliveryOrders.acceptError', 'Failed to accept order')); return; }
    toast.success(t('deliveryOrders.accepted', 'Order accepted'));
    void loadOrders();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.rpc('reject_delivery_order', { p_delivery_order_id: id });
    if (error) { toast.error(t('deliveryOrders.rejectError', 'Failed to reject order')); return; }
    toast.success(t('deliveryOrders.rejected', 'Order rejected'));
    void loadOrders();
  };

  const handleStartPrep = async (id: string) => {
    const { error } = await supabase.from('restaurant_delivery_orders').update({ status: 'preparing' }).eq('id', id).eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('deliveryOrders.updateError', 'Failed to update order')); return; }
    void loadOrders();
  };

  const handleMarkReady = async (id: string) => {
    const { error } = await supabase.from('restaurant_delivery_orders').update({ status: 'ready' }).eq('id', id).eq('tenant_id', tenantId ?? '');
    if (error) { toast.error(t('deliveryOrders.updateError', 'Failed to update order')); return; }
    void loadOrders();
  };

  const handleMarkPickedUp = async (id: string) => {
    const { error } = await supabase.rpc('complete_delivery_order', { p_delivery_order_id: id });
    if (error) { toast.error(t('deliveryOrders.completeError', 'Failed to complete order')); return; }
    toast.success(t('deliveryOrders.completed', 'Order completed'));
    void loadOrders();
  };

  return (
    <Layout>
      <FeatureGate feature="enterprise_dashboard">
        <RoleGate action="make_sales">
          <div className="p-6">
            <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
              <Truck className="h-5 w-5" />
              {t('deliveryOrders.title', 'Delivery Orders')}
            </h1>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {COLUMNS.map((col) => (
                <div key={col.status}>
                  <h2 className="mb-2 text-sm font-semibold text-white/60">{t(`deliveryOrders.status.${col.status}`, col.label)}</h2>
                  <div className="space-y-3">
                    {orders.filter((o) => o.status === col.status).map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        onStartPrep={handleStartPrep}
                        onMarkReady={handleMarkReady}
                        onMarkPickedUp={handleMarkPickedUp}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </RoleGate>
      </FeatureGate>
    </Layout>
  );
}
