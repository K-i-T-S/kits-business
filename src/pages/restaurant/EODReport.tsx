import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Share2, Printer, RefreshCw } from 'lucide-react';

import { supabase } from '@/utils/supabaseClient';
import { useApp } from '@/context/AppContext';

interface EODData {
  date: string;
  totalRevenue: number;
  covers: number;
  avgTicket: number;
  totalOrders: number;
  argileRevenue: number;
  serviceCharge: number;
  vatCollected: number;
  topDishes: Array<{ name: string; qty: number }>;
}

export default function EODReport() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const [eod, setEod] = useState<EODData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const today = new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];

  const generate = async () => {
    setLoading(true);
    const { data: orders } = await supabase
      .from('table_orders')
      .select('id, status')
      .gte('opened_at', `${todayISO}T00:00:00`)
      .eq('status', 'paid');

    const { data: items } = await supabase
      .from('restaurant_order_items')
      .select('product_name, quantity, unit_price')
      .gte('sent_at', `${todayISO}T00:00:00`);

    const { data: argileSessions } = await supabase
      .from('restaurant_argile_sessions')
      .select('base_price_usd, refill_price_usd, tobacco_refill_count')
      .gte('opened_at', `${todayISO}T00:00:00`);

    const totalOrders = orders?.length ?? 0;
    const revenue = (items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const covers = totalOrders;
    const argileRevenue = (argileSessions ?? []).reduce((s, a) => s + a.base_price_usd + a.refill_price_usd * a.tobacco_refill_count, 0);
    const serviceCharge = revenue * 0.10;
    const vatCollected = (revenue + serviceCharge) * 0.11;

    const dishCounts = (items ?? []).reduce<Record<string, number>>((acc, i) => {
      acc[i.product_name] = (acc[i.product_name] ?? 0) + i.quantity;
      return acc;
    }, {});
    const topDishes = Object.entries(dishCounts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    setEod({
      date: today,
      totalRevenue: revenue,
      covers,
      avgTicket: covers > 0 ? revenue / covers : 0,
      totalOrders,
      argileRevenue,
      serviceCharge,
      vatCollected,
      topDishes,
    });
    setLoading(false);
  };

  const save = async () => {
    if (!eod || !currentTenant?.id) return;
    await supabase.from('restaurant_eod_reports').upsert({
      tenant_id: currentTenant.id,
      report_date: todayISO,
      total_revenue_usd: eod.totalRevenue,
      total_covers: eod.covers,
      avg_ticket_usd: eod.avgTicket,
      total_orders: eod.totalOrders,
      argile_revenue_usd: eod.argileRevenue,
      service_charge_usd: eod.serviceCharge,
      vat_usd: eod.vatCollected,
      top_items: eod.topDishes,
      generated_at: new Date().toISOString(),
    });
    setSaved(true);
  };

  const shareWhatsApp = () => {
    if (!eod) return;
    const text = [
      `📊 EOD Report — ${eod.date}`,
      `Restaurant: ${currentTenant?.name ?? '—'}`,
      ``,
      `💰 Revenue: $${eod.totalRevenue.toFixed(2)}`,
      `👥 Covers: ${eod.covers}`,
      `🧾 Avg Ticket: $${eod.avgTicket.toFixed(2)}`,
      `💨 Argile: $${eod.argileRevenue.toFixed(2)}`,
      `🏛 VAT: $${eod.vatCollected.toFixed(2)}`,
      ``,
      eod.topDishes.length > 0 ? `🍽 Top Dishes:\n${eod.topDishes.map(d => `  • ${d.name} (${d.qty})`).join('\n')}` : '',
      ``,
      `Powered by KiTS`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  useEffect(() => { void generate(); }, []);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">{t('restaurant.eod.title', 'End-of-Day Report')}</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={() => void generate()} className="rounded-xl border border-white/10 p-2 text-white/60 hover:text-white">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => window.print()} className="rounded-xl border border-white/10 p-2 text-white/60 hover:text-white">
            <Printer className="h-4 w-4" />
          </button>
          <button onClick={shareWhatsApp} className="rounded-xl bg-green-600/20 border border-green-500/30 px-3 py-2 text-sm text-green-400 flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            WhatsApp
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {eod && !loading && (
        <>
          {/* Report Card — print-friendly */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5 print:bg-white print:text-black print:border-gray-200">
            <div className="text-center border-b border-white/10 pb-4 print:border-gray-200">
              <p className="text-xs text-white/40 print:text-gray-500">{t('restaurant.eod.poweredBy', 'KiTS Business Terminal')}</p>
              <h2 className="text-xl font-bold text-white mt-1 print:text-black">{currentTenant?.name ?? 'Restaurant'}</h2>
              <p className="text-sm text-white/50 print:text-gray-500">{eod.date}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider print:text-gray-500">
                {t('restaurant.eod.revenue', 'Revenue Summary')}
              </h3>
              {[
                [t('restaurant.eod.totalRevenue', 'Total Revenue'), `$${eod.totalRevenue.toFixed(2)}`],
                [t('restaurant.eod.covers', 'Covers Served'), `${eod.covers} guests`],
                [t('restaurant.eod.avgTicket', 'Average Ticket'), `$${eod.avgTicket.toFixed(2)}`],
                [t('restaurant.eod.argile', 'Argile Revenue'), `$${eod.argileRevenue.toFixed(2)}`],
                [t('restaurant.eod.serviceCharge', 'Service Charge (10%)'), `$${eod.serviceCharge.toFixed(2)}`],
                [t('restaurant.eod.vat', 'VAT Collected (11%)'), `$${eod.vatCollected.toFixed(2)}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-white/60 print:text-gray-600">{label}</span>
                  <span className="font-semibold text-white print:text-black">{value}</span>
                </div>
              ))}
            </div>

            {eod.topDishes.length > 0 && (
              <div className="space-y-2 border-t border-white/10 pt-4 print:border-gray-200">
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider print:text-gray-500">
                  {t('restaurant.eod.topDishes', 'Top Dishes')}
                </h3>
                {eod.topDishes.map((d, i) => (
                  <div key={d.name} className="flex justify-between text-sm">
                    <span className="text-white/60 print:text-gray-600">{['🥇', '🥈', '🥉', '4.', '5.'][i] ?? `${i + 1}.`} {d.name}</span>
                    <span className="text-white/80 print:text-black">{d.qty} served</span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-white/10 pt-4 text-center print:border-gray-200">
              <p className="text-xs text-white/20 print:text-gray-400">{t('restaurant.eod.footer', 'Generated by KiTS · kits.app')}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void save()}
              disabled={saved}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saved ? t('restaurant.eod.saved', '✓ Saved') : t('restaurant.eod.save', 'Save Report')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
