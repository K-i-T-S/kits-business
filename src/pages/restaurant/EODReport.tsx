import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, Share2, Printer, RefreshCw,
  TrendingUp, DollarSign, Users, Clock,
  AlertTriangle, CheckCircle, Flame, ChefHat,
} from 'lucide-react';

import Layout from '@/components/Layout';
import { supabase } from '@/utils/supabaseClient';
import { useApp } from '@/context/AppContext';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableOrderRow {
  id: string;
  status: string;
  opened_at: string | null;
  paid_at: string | null;
}

interface OrderItemRow {
  product_name: string;
  quantity: number;
  unit_price: number;
  status: string | null;
  sent_at: string | null;
}

interface ArgileRow {
  base_price_usd: number;
  refill_price_usd: number;
  tobacco_refill_count: number;
}

interface ShiftAssignmentRow {
  clocked_in_at: string | null;
  clocked_out_at: string | null;
}

interface EODData {
  date: string;
  foodRevenue: number;
  argileRevenue: number;
  serviceCharge: number;
  vat: number;
  grossTotal: number;
  estFoodCost: number;
  estArgileCost: number;
  estCOGS: number;
  estGrossProfit: number;
  grossMarginPct: number;
  totalOrders: number;
  covers: number;
  avgTicket: number;
  peakHour: string;
  minServiceMins: number;
  maxServiceMins: number;
  slowTablesCount: number;
  cancelledItems: number;
  staffCount: number;
  totalHours: number;
  estLaborCost: number;
  topDishes: Array<{ name: string; qty: number }>;
  bottomDishes: Array<{ name: string; qty: number }>;
  argileSessions: number;
  avgArgileValue: number;
  argileRefills: number;
  alerts: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clockedMins(row: ShiftAssignmentRow): number {
  if (!row.clocked_in_at) return 0;
  const end = row.clocked_out_at ? new Date(row.clocked_out_at) : new Date();
  return (end.getTime() - new Date(row.clocked_in_at).getTime()) / 60000;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className={highlight ? 'text-sm font-semibold text-white' : 'text-sm text-white/55 print:text-gray-600'}>{label}</span>
      <span className={`font-bold ${highlight ? 'text-base bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent' : 'text-sm text-white print:text-black'}`}>{value}</span>
    </div>
  );
}

function ReportSection({ title, icon: Icon, children }: {
  title: string;
  icon: React.FC<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 border-t border-white/8 pt-4 print:border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/10">
          <Icon className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 print:text-gray-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function EODReport() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const [eod, setEod] = useState<EODData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const today = new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0] ?? '';

  const generate = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const dayStart = `${todayISO}T00:00:00`;

      const [ordersRes, itemsRes, argileRes, shiftRes] = await Promise.all([
        supabase
          .from('table_orders')
          .select('id, status, opened_at, paid_at')
          .gte('opened_at', dayStart)
          .eq('status', 'paid'),
        supabase
          .from('restaurant_order_items')
          .select('product_name, quantity, unit_price, status, sent_at')
          .gte('sent_at', dayStart),
        supabase
          .from('restaurant_argile_sessions')
          .select('base_price_usd, refill_price_usd, tobacco_refill_count')
          .gte('opened_at', dayStart),
        supabase
          .from('restaurant_shift_assignments')
          .select('clocked_in_at, clocked_out_at')
          .gte('clocked_in_at', dayStart),
      ]);

      const orders = (ordersRes.data ?? []) as TableOrderRow[];
      const items = (itemsRes.data ?? []) as OrderItemRow[];
      const argiles = (argileRes.data ?? []) as ArgileRow[];
      const shiftRows = (shiftRes.data ?? []) as ShiftAssignmentRow[];

      const foodRevenue = items
        .filter(i => i.status !== 'cancelled')
        .reduce((s, i) => s + i.unit_price * i.quantity, 0);
      const argileRevenue = argiles.reduce(
        (s, a) => s + a.base_price_usd + a.refill_price_usd * a.tobacco_refill_count, 0,
      );
      const serviceCharge = foodRevenue * 0.10;
      const vat = (foodRevenue + serviceCharge) * 0.11;
      const grossTotal = foodRevenue + argileRevenue + serviceCharge + vat;

      const estFoodCost = foodRevenue * 0.28;
      const estArgileCost = argileRevenue * 0.15;
      const estCOGS = estFoodCost + estArgileCost;
      const estGrossProfit = grossTotal - estCOGS;
      const grossMarginPct = grossTotal > 0 ? (estGrossProfit / grossTotal) * 100 : 0;

      const totalOrders = orders.length;
      const covers = totalOrders;
      const avgTicket = covers > 0 ? foodRevenue / covers : 0;

      const serviceTimes = orders
        .filter(o => o.opened_at && o.paid_at)
        .map(o => (new Date(o.paid_at!).getTime() - new Date(o.opened_at!).getTime()) / 60000);
      const minServiceMins = serviceTimes.length > 0 ? Math.min(...serviceTimes) : 0;
      const maxServiceMins = serviceTimes.length > 0 ? Math.max(...serviceTimes) : 0;
      const avgServiceMins = serviceTimes.length > 0
        ? serviceTimes.reduce((s, v) => s + v, 0) / serviceTimes.length : 0;
      const slowTablesCount = serviceTimes.filter(m => m > 90).length;

      const hourCounts: Record<number, number> = {};
      items.forEach(i => {
        if (!i.sent_at) return;
        const h = new Date(i.sent_at).getHours();
        hourCounts[h] = (hourCounts[h] ?? 0) + i.quantity;
      });
      const peakEntry = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
      const peakHour = peakEntry ? `${peakEntry[0]}:00–${Number(peakEntry[0]) + 1}:00` : '—';

      const cancelledItems = items.filter(i => i.status === 'cancelled').length;

      const dishCounts: Record<string, number> = {};
      items
        .filter(i => i.status !== 'cancelled')
        .forEach(i => { dishCounts[i.product_name] = (dishCounts[i.product_name] ?? 0) + i.quantity; });
      const sorted = Object.entries(dishCounts)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty);
      const topDishes = sorted.slice(0, 5);
      const bottomDishes = sorted.length > 3 ? sorted.slice(-3).reverse() : [];

      const staffCount = shiftRows.filter(r => r.clocked_in_at).length;
      const totalHours = shiftRows.reduce((s, r) => s + clockedMins(r) / 60, 0);
      const estLaborCost = totalHours * 8;

      const argileCount = argiles.length;
      const avgArgileValue = argileCount > 0 ? argileRevenue / argileCount : 0;
      const argileRefills = argiles.reduce((s, a) => s + a.tobacco_refill_count, 0);

      const alerts: string[] = [];
      if (foodRevenue > 0 && estFoodCost / foodRevenue > 0.35)
        alerts.push('⚠️ Food cost above target (28%) — review portion sizes or pricing');
      if (avgServiceMins > 60)
        alerts.push('⚠️ Slow service detected — consider adding staff for next shift');
      if (cancelledItems > 3)
        alerts.push('⚠️ Multiple cancellations — review kitchen communication and order flow');
      if (grossTotal > 0 && grossMarginPct < 50)
        alerts.push('⚠️ Margin pressure — review pricing strategy or COGS');
      if (alerts.length === 0)
        alerts.push('✅ Strong day — all key metrics within targets');

      setEod({
        date: today, foodRevenue, argileRevenue, serviceCharge, vat, grossTotal,
        estFoodCost, estArgileCost, estCOGS, estGrossProfit, grossMarginPct,
        totalOrders, covers, avgTicket, peakHour,
        minServiceMins, maxServiceMins, slowTablesCount, cancelledItems,
        staffCount, totalHours, estLaborCost,
        topDishes, bottomDishes,
        argileSessions: argileCount, avgArgileValue, argileRefills,
        alerts,
      });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!eod || !currentTenant?.id) return;
    await supabase.from('restaurant_eod_reports').upsert({
      tenant_id: currentTenant.id,
      report_date: todayISO,
      total_revenue_usd: eod.grossTotal,
      total_covers: eod.covers,
      avg_ticket_usd: eod.avgTicket,
      total_orders: eod.totalOrders,
      argile_revenue_usd: eod.argileRevenue,
      service_charge_usd: eod.serviceCharge,
      vat_usd: eod.vat,
      top_items: eod.topDishes,
      generated_at: new Date().toISOString(),
    });
    setSaved(true);
  };

  const shareWhatsApp = () => {
    if (!eod) return;
    const lines = [
      `📊 EOD Report — ${eod.date}`,
      `🏪 ${currentTenant?.name ?? 'Restaurant'}`,
      ``,
      `💰 REVENUE`,
      `  Food & Bev: $${eod.foodRevenue.toFixed(2)} | Argile: $${eod.argileRevenue.toFixed(2)}`,
      `  Service: $${eod.serviceCharge.toFixed(2)} | VAT: $${eod.vat.toFixed(2)}`,
      `  GROSS TOTAL: $${eod.grossTotal.toFixed(2)}`,
      ``,
      `📉 COSTS (est.) — COGS: $${eod.estCOGS.toFixed(2)} | Margin: ${eod.grossMarginPct.toFixed(1)}%`,
      `👥 Staff: ${eod.staffCount} | Hours: ${eod.totalHours.toFixed(1)} | Labor: $${eod.estLaborCost.toFixed(2)}`,
      ``,
      `📋 OPERATIONS`,
      `  Orders: ${eod.totalOrders} | Avg Ticket: $${eod.avgTicket.toFixed(2)} | Peak: ${eod.peakHour}`,
      eod.cancelledItems > 0 ? `  Cancellations: ${eod.cancelledItems}` : '',
      eod.slowTablesCount > 0 ? `  Slow Tables (>90min): ${eod.slowTablesCount}` : '',
      ``,
      eod.topDishes.length > 0
        ? `🍽 TOP DISHES\n${eod.topDishes.map((d, i) => `  ${(['🥇','🥈','🥉','4.','5.'] as const)[i] ?? '•'} ${d.name} (${d.qty})`).join('\n')}`
        : '',
      ``,
      `📋 ${eod.alerts.join('\n  ')}`,
      ``,
      `Powered by KiTS`,
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank');
  };

  useEffect(() => { void generate(); }, []);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/25 to-yellow-500/10 shadow-lg shadow-amber-500/10">
            <FileText className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('restaurant.eod.title', 'End-of-Day Report')}</h1>
            <p className="text-xs text-white/35">{today}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => void generate()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
              title="Regenerate"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => window.print()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
              title="Print"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-400 hover:bg-green-500/20 transition-all"
            >
              <Share2 className="h-4 w-4" />
              WhatsApp
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-amber-500/20" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" />
            </div>
          </div>
        )}

        {eod && !loading && (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                { label: 'Gross Revenue', value: `$${eod.grossTotal.toFixed(2)}`, Icon: TrendingUp },
                { label: 'Gross Margin',  value: `${eod.grossMarginPct.toFixed(1)}%`, Icon: DollarSign },
                { label: 'Covers',        value: String(eod.covers), Icon: Users },
                { label: 'Avg Ticket',    value: `$${eod.avgTicket.toFixed(2)}`, Icon: Clock },
              ] as const).map(({ label, value, Icon }) => (
                <div
                  key={label}
                  className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10">
                      <Icon className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">{label}</p>
                  </div>
                  <p className="text-xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Full report */}
            <div className="backdrop-blur-md bg-gradient-to-br from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 print:bg-white print:text-black print:border-gray-200">
              <div className="text-center border-b border-white/8 pb-5 print:border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/60">KiTS Business Terminal — EOD Report</p>
                <h2 className="text-2xl font-bold text-white mt-2 print:text-black">{currentTenant?.name ?? 'Restaurant'}</h2>
                <p className="text-sm text-white/40 mt-1 print:text-gray-500">{eod.date}</p>
              </div>

              <ReportSection title="Revenue Summary" icon={TrendingUp}>
                <Row label="Food & Beverage"      value={`$${eod.foodRevenue.toFixed(2)}`} />
                <Row label="Argile Revenue"        value={`$${eod.argileRevenue.toFixed(2)}`} />
                <Row label="Service Charge (10%)"  value={`$${eod.serviceCharge.toFixed(2)}`} />
                <Row label="VAT Collected (11%)"   value={`$${eod.vat.toFixed(2)}`} />
                <Row label="Gross Total"           value={`$${eod.grossTotal.toFixed(2)}`} highlight />
              </ReportSection>

              <ReportSection title="Cost & Margin *" icon={DollarSign}>
                <p className="text-[10px] text-white/30 mb-2">* estimates — food cost 28%, argile 15%</p>
                <Row label="Est. Food Cost"    value={`$${eod.estFoodCost.toFixed(2)}`} />
                <Row label="Est. Argile Cost"  value={`$${eod.estArgileCost.toFixed(2)}`} />
                <Row label="Total Est. COGS"   value={`$${eod.estCOGS.toFixed(2)}`} />
                <Row label="Est. Gross Profit" value={`$${eod.estGrossProfit.toFixed(2)}`} />
                <Row label="Gross Margin"      value={`${eod.grossMarginPct.toFixed(1)}%`} highlight />
              </ReportSection>

              <ReportSection title="Labor" icon={Users}>
                <p className="text-[10px] text-white/30 mb-2">$8/hr placeholder — configure in Settings</p>
                <Row label="Staff Worked Today"    value={`${eod.staffCount} staff`} />
                <Row label="Total Hours Clocked"   value={`${eod.totalHours.toFixed(1)} hrs`} />
                <Row label="Est. Labor Cost"       value={`$${eod.estLaborCost.toFixed(2)}`} highlight />
              </ReportSection>

              <ReportSection title="Operations" icon={Clock}>
                <Row label="Total Orders"      value={String(eod.totalOrders)} />
                <Row label="Peak Hour"         value={eod.peakHour} />
                <Row label="Fastest Service"   value={`${Math.round(eod.minServiceMins)} min`} />
                <Row label="Slowest Service"   value={`${Math.round(eod.maxServiceMins)} min`} />
                {eod.slowTablesCount > 0 && <Row label="Tables >90 min ⚠️" value={String(eod.slowTablesCount)} />}
                <Row label="Cancelled Items"   value={String(eod.cancelledItems)} />
              </ReportSection>

              {eod.topDishes.length > 0 && (
                <ReportSection title="Top Dishes" icon={ChefHat}>
                  {eod.topDishes.map((d, i) => (
                    <div key={d.name} className="flex justify-between items-center py-1">
                      <span className="text-sm text-white/60">{(['🥇','🥈','🥉','4.','5.'] as const)[i] ?? `${i + 1}.`} {d.name}</span>
                      <span className="text-sm font-semibold text-white/80">{d.qty} served</span>
                    </div>
                  ))}
                  {eod.bottomDishes.length > 0 && (
                    <>
                      <p className="text-[10px] text-white/30 mt-3 mb-1 uppercase tracking-wider">Slowest movers</p>
                      {eod.bottomDishes.map(d => (
                        <div key={d.name} className="flex justify-between items-center py-1">
                          <span className="text-sm text-white/35">📉 {d.name}</span>
                          <span className="text-sm text-white/35">{d.qty} served</span>
                        </div>
                      ))}
                    </>
                  )}
                </ReportSection>
              )}

              {eod.argileSessions > 0 && (
                <ReportSection title="Argile / Shisha" icon={Flame}>
                  <Row label="Sessions"          value={String(eod.argileSessions)} />
                  <Row label="Revenue"           value={`$${eod.argileRevenue.toFixed(2)}`} />
                  <Row label="Avg Session Value" value={`$${eod.avgArgileValue.toFixed(2)}`} />
                  <Row label="Tobacco Refills"   value={String(eod.argileRefills)} />
                </ReportSection>
              )}

              <ReportSection title="Alerts & Recommendations" icon={AlertTriangle}>
                <div className="space-y-1">
                  {eod.alerts.map((a, i) => (
                    <p key={i} className={`text-sm py-1 ${a.startsWith('✅') ? 'text-green-400' : 'text-amber-300'}`}>{a}</p>
                  ))}
                </div>
              </ReportSection>

              <div className="border-t border-white/8 pt-4 print:border-gray-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-white/25" />
                  <p className="text-xs text-white/25">
                    This report covers all operations for {eod.date}. Generated by KiTS Business Terminal.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => void save()}
                disabled={saved}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 disabled:opacity-60 hover:shadow-amber-500/30 transition-all"
              >
                {saved ? '✓ Saved' : t('restaurant.eod.save', 'Save Report')}
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
