import { format, addDays, parseISO } from 'date-fns';
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  Package,
  Users,
  Download,
  Award,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { toast } from 'sonner';

import FeatureGate from '@/components/FeatureGate';
import Layout from '@/components/Layout';
import { useApp } from '@/context/AppContext';
import type { Sale, Product, Customer } from '@/context/AppContext';

// ── Lebanese Public Holiday Calendar ─────────────────────────────────────────
// Fixed dates as 'YYYY-MM-DD'.
// Islamic holidays approximated for 2026/2027 — update as official dates emerge.

interface HolidayEntry {
  name: string;
  date: string; // ISO 'YYYY-MM-DD'
}

const LEBANESE_HOLIDAYS: HolidayEntry[] = [
  // ── 2026 fixed ────────────────────────────────────────────────────────────
  { name: "New Year's Day", date: '2026-01-01' },
  { name: 'Armenian Christmas', date: '2026-01-06' },
  { name: "St. Maroun's Day", date: '2026-02-09' },
  { name: 'Arab Teachers Day', date: '2026-03-22' },
  { name: 'Good Friday (Catholic)', date: '2026-04-03' },
  { name: 'Good Friday (Orthodox)', date: '2026-04-10' },
  { name: 'Labour Day', date: '2026-05-01' },
  { name: "Martyrs' Day", date: '2026-05-06' },
  { name: 'Resistance & Liberation Day', date: '2026-05-25' },
  { name: 'Assumption of Mary', date: '2026-08-15' },
  { name: 'All Saints Day', date: '2026-11-01' },
  { name: 'Independence Day', date: '2026-11-22' },
  { name: 'Christmas Day', date: '2026-12-25' },
  // ── 2026 Islamic (approximate) ────────────────────────────────────────────
  { name: 'Eid al-Fitr', date: '2026-04-21' },
  { name: 'Eid al-Adha', date: '2026-06-28' },
  { name: 'Islamic New Year', date: '2026-07-17' },
  { name: "Prophet's Birthday", date: '2026-09-26' },
  // ── 2027 fixed ────────────────────────────────────────────────────────────
  { name: "New Year's Day", date: '2027-01-01' },
  { name: 'Armenian Christmas', date: '2027-01-06' },
  { name: "St. Maroun's Day", date: '2027-02-09' },
  { name: 'Arab Teachers Day', date: '2027-03-22' },
  { name: 'Good Friday (Catholic)', date: '2027-03-26' },
  { name: 'Good Friday (Orthodox)', date: '2027-04-30' },
  { name: 'Labour Day', date: '2027-05-01' },
  { name: "Martyrs' Day", date: '2027-05-06' },
  { name: 'Resistance & Liberation Day', date: '2027-05-25' },
  { name: 'Assumption of Mary', date: '2027-08-15' },
  { name: 'All Saints Day', date: '2027-11-01' },
  { name: 'Independence Day', date: '2027-11-22' },
  { name: 'Christmas Day', date: '2027-12-25' },
  // ── 2027 Islamic (approximate) ────────────────────────────────────────────
  { name: 'Eid al-Fitr', date: '2027-04-11' },
  { name: 'Eid al-Adha', date: '2027-06-17' },
  { name: 'Islamic New Year', date: '2027-07-07' },
  { name: "Prophet's Birthday", date: '2027-09-15' },
];

/** Look up a holiday for a given Date. */
function getHolidayForDate(d: Date): HolidayEntry | undefined {
  const iso = format(d, 'yyyy-MM-dd');
  return LEBANESE_HOLIDAYS.find(h => h.date === iso);
}

/** Get upcoming holidays within the next `days` calendar days (inclusive of today). */
function getUpcomingHolidays(days: number): Array<HolidayEntry & { daysAway: number }> {
  const today = new Date();
  const result: Array<HolidayEntry & { daysAway: number }> = [];
  for (let i = 0; i <= days; i++) {
    const d = addDays(today, i);
    const h = getHolidayForDate(d);
    if (h) result.push({ ...h, daysAway: i });
  }
  return result;
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface ChartPoint {
  dateLabel: string;
  actual: number | null;
  forecast: number | null;
  ciMin: number | null;
  ciMax: number | null;
  isHoliday: boolean;
  holidayName?: string;
}

interface ProductVelocity {
  productId: string;
  productName: string;
  unitsPerDay: number;
  projected30d: number;
  revenuePerDay: number;
}

interface ClvEntry {
  customerId: string;
  customerName: string;
  avgOrderValue: number;
  purchasesPerYear: number;
  clv: number;
  totalSpend: number;
  visitCount: number;
}

interface StockDepletion {
  productId: string;
  productName: string;
  stock: number;
  dailyVelocity: number;
  daysUntilStockout: number;
}

// ── Computation helpers ───────────────────────────────────────────────────────

function groupSalesByDate(sales: Sale[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sales) {
    const key = s.date.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + (s.total ?? 0));
  }
  return map;
}

function linearRegression(ys: number[]): { slope: number; intercept: number } {
  const n = ys.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const sumX = (n * (n - 1)) / 2;
  const sumY = ys.reduce((a, b) => a + b, 0);
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    // eslint-disable-next-line security/detect-object-injection
    sumXY += i * (ys[i] ?? 0);
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: n > 0 ? sumY / n : 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function residualStdDev(ys: number[], slope: number, intercept: number): number {
  const n = ys.length;
  if (n < 2) return 0;
  const ss = ys.reduce((acc, y, i) => acc + (y - (slope * i + intercept)) ** 2, 0);
  return Math.sqrt(ss / (n - 2));
}

function buildChartData(sales: Sale[]): ChartPoint[] {
  const dateMap = groupSalesByDate(sales);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const HISTORY_DAYS = 90;
  const FORECAST_DAYS = 30;

  const historyDates: Date[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    historyDates.push(addDays(today, -i));
  }

  const historyRevenues = historyDates.map(d => dateMap.get(format(d, 'yyyy-MM-dd')) ?? 0);
  const { slope, intercept } = linearRegression(historyRevenues);
  const sigma = residualStdDev(historyRevenues, slope, intercept);

  const points: ChartPoint[] = [];

  historyDates.forEach((d, i) => {
    const holiday = getHolidayForDate(d);
    points.push({
      dateLabel: format(d, 'MMM dd'),
      // eslint-disable-next-line security/detect-object-injection
      actual: historyRevenues[i] ?? 0,
      forecast: null,
      ciMin: null,
      ciMax: null,
      isHoliday: !!holiday,
      holidayName: holiday?.name,
    });
  });

  for (let i = 0; i < FORECAST_DAYS; i++) {
    const d = addDays(today, i + 1);
    const xIdx = HISTORY_DAYS + i;
    const fitted = Math.max(0, slope * xIdx + intercept);
    const margin = Math.max(fitted * 0.15, 1.96 * sigma);
    const holiday = getHolidayForDate(d);
    points.push({
      dateLabel: format(d, 'MMM dd'),
      actual: null,
      forecast: parseFloat(fitted.toFixed(2)),
      ciMin: parseFloat(Math.max(0, fitted - margin).toFixed(2)),
      ciMax: parseFloat((fitted + margin).toFixed(2)),
      isHoliday: !!holiday,
      holidayName: holiday?.name,
    });
  }

  return points;
}

function computeProductVelocity(sales: Sale[]): ProductVelocity[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = addDays(today, -90);

  const agg = new Map<string, { name: string; units: number; revenue: number }>();

  for (const s of sales) {
    const saleDate = parseISO(s.date.slice(0, 10));
    if (saleDate < cutoff) continue;
    for (const item of s.items ?? []) {
      const entry = agg.get(item.productId) ?? { name: item.productName, units: 0, revenue: 0 };
      entry.units += item.quantity ?? 0;
      entry.revenue += (item.price ?? 0) * (item.quantity ?? 0);
      agg.set(item.productId, entry);
    }
  }

  const result: ProductVelocity[] = [];
  agg.forEach((v, productId) => {
    const unitsPerDay = v.units / 90;
    if (unitsPerDay > 0) {
      result.push({
        productId,
        productName: v.name,
        unitsPerDay,
        projected30d: unitsPerDay * 30,
        revenuePerDay: v.revenue / 90,
      });
    }
  });

  result.sort((a, b) => b.unitsPerDay - a.unitsPerDay);
  return result;
}

function computeClv(sales: Sale[], customers: Customer[]): ClvEntry[] {
  const saleDates = sales.map(s => new Date(s.date).getTime()).filter(t => !isNaN(t));
  const minDate = saleDates.length > 0 ? Math.min(...saleDates) : Date.now();
  const maxDate = saleDates.length > 0 ? Math.max(...saleDates) : Date.now();
  const observationYears = Math.max(0.08, (maxDate - minDate) / (1000 * 60 * 60 * 24 * 365));

  const agg = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    if (!s.customerId) continue;
    const entry = agg.get(s.customerId) ?? { total: 0, count: 0 };
    entry.total += s.total ?? 0;
    entry.count += 1;
    agg.set(s.customerId, entry);
  }

  const customerMap = new Map(customers.map(c => [c.id, c]));
  const result: ClvEntry[] = [];

  agg.forEach((v, customerId) => {
    const customer = customerMap.get(customerId);
    if (!customer) return;
    const avgOrderValue = v.count > 0 ? v.total / v.count : 0;
    const purchasesPerYear = v.count / observationYears;
    const retentionYears = 2;
    result.push({
      customerId,
      customerName: customer.name,
      avgOrderValue,
      purchasesPerYear,
      clv: avgOrderValue * purchasesPerYear * retentionYears,
      totalSpend: v.total,
      visitCount: v.count,
    });
  });

  result.sort((a, b) => b.clv - a.clv);
  return result.slice(0, 10);
}

function computeStockDepletion(sales: Sale[], products: Product[]): StockDepletion[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = addDays(today, -30);

  const vel = new Map<string, number>();
  for (const s of sales) {
    const saleDate = parseISO(s.date.slice(0, 10));
    if (saleDate < cutoff) continue;
    for (const item of s.items ?? []) {
      vel.set(item.productId, (vel.get(item.productId) ?? 0) + (item.quantity ?? 0));
    }
  }

  const result: StockDepletion[] = [];
  for (const product of products) {
    const totalStock = (product.variants ?? []).reduce((sum, v) => sum + (v.stock ?? 0), 0);
    if (totalStock <= 0) continue;
    const soldUnits = vel.get(product.id ?? '') ?? 0;
    const dailyVelocity = soldUnits / 30;
    if (dailyVelocity <= 0) continue;
    const daysUntilStockout = totalStock / dailyVelocity;
    if (daysUntilStockout > 30) continue;
    result.push({
      productId: product.id ?? '',
      productName: product.name,
      stock: totalStock,
      dailyVelocity,
      daysUntilStockout,
    });
  }

  result.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
  return result;
}

// ── Custom Recharts tooltip ───────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number | null;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  chartData: ChartPoint[];
}

function ChartTooltip({ active, payload, label, chartData }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = chartData.find(p => p.dateLabel === label);
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 p-3 text-sm shadow-xl">
      <p className="mb-1 font-semibold text-white">{label}</p>
      {point?.isHoliday && (
        <p className="mb-1 text-xs text-amber-400">Lebanese Holiday: {point.holidayName}</p>
      )}
      {payload.map((item, i) => {
        if (item.value === null || item.value === undefined || item.name === 'CI Upper' || item.name === 'CI Lower') return null;
        return (
          <p key={i} style={{ color: item.color }} className="text-xs">
            {item.name}: ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        );
      })}
    </div>
  );
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtUnits(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ForecastingPage() {
  const { sales, products, customers } = useApp();
  const [exporting, setExporting] = useState(false);

  const safeSales = useMemo<Sale[]>(() => sales ?? [], [sales]);
  const safeProducts = useMemo<Product[]>(() => products ?? [], [products]);
  const safeCustomers = useMemo<Customer[]>(() => customers ?? [], [customers]);

  const chartData = useMemo(() => buildChartData(safeSales), [safeSales]);
  const upcomingHolidays = useMemo(() => getUpcomingHolidays(30), []);
  const productVelocity = useMemo(() => computeProductVelocity(safeSales), [safeSales]);
  const clvData = useMemo(() => computeClv(safeSales, safeCustomers), [safeSales, safeCustomers]);
  const stockDepletion = useMemo(() => computeStockDepletion(safeSales, safeProducts), [safeSales, safeProducts]);

  // Last-30-days actual + first-30-days forecast for PDF table
  const revenueTrendRows = useMemo(
    () => chartData.slice(60).map(p => ({ date: p.dateLabel, actual: p.actual, forecast: p.forecast })),
    [chartData],
  );

  // ── PDF Export ──────────────────────────────────────────────────────────────
  async function handleExportPdf() {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 18;

      doc.setFontSize(18);
      doc.setTextColor(99, 102, 241);
      doc.text('KiTS Business Terminal — Forecasting Report', margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${format(new Date(), 'PPP')} · 30-day history + 30-day forecast`, margin, y);
      y += 10;

      // Revenue trend table
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('Revenue Trend (Last 30 Days + Forecast)', margin, y);
      y += 6;

      const colDate = margin;
      const colActual = margin + 55;
      const colForecast = margin + 115;

      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('Date', colDate, y);
      doc.text('Actual Revenue', colActual, y);
      doc.text('Forecast Revenue', colForecast, y);
      y += 5;
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageW - margin, y);
      y += 3;
      doc.setTextColor(30, 41, 59);

      for (const row of revenueTrendRows) {
        if (y > 270) { doc.addPage(); y = 18; }
        doc.text(row.date, colDate, y);
        doc.text(row.actual !== null && row.actual !== undefined ? fmtUSD(row.actual) : '—', colActual, y);
        doc.text(row.forecast !== null && row.forecast !== undefined ? fmtUSD(row.forecast) : '—', colForecast, y);
        y += 5;
      }

      y += 8;
      if (y > 250) { doc.addPage(); y = 18; }

      // Top products table
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('Top Product Velocity', margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('#', margin, y);
      doc.text('Product', margin + 8, y);
      doc.text('Units/Day', margin + 95, y);
      doc.text('Proj. 30d Units', margin + 125, y);
      doc.text('Rev/Day', margin + 162, y);
      y += 5;
      doc.line(margin, y, pageW - margin, y);
      y += 3;
      doc.setTextColor(30, 41, 59);

      productVelocity.slice(0, 15).forEach((p, i) => {
        if (y > 270) { doc.addPage(); y = 18; }
        doc.text(String(i + 1), margin, y);
        const name = p.productName.length > 40 ? `${p.productName.slice(0, 37)}...` : p.productName;
        doc.text(name, margin + 8, y);
        doc.text(fmtUnits(p.unitsPerDay), margin + 95, y);
        doc.text(Math.round(p.projected30d).toLocaleString(), margin + 125, y);
        doc.text(fmtUSD(p.revenuePerDay), margin + 162, y);
        y += 5;
      });

      doc.save(`kits-forecasting-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exported successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }

  const hasEnoughData = safeSales.length >= 7;

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Forecasting</h1>
            <p className="mt-1 text-sm text-white/50">
              Revenue trends, holiday awareness, product velocity, CLV and stock depletion
            </p>
          </div>
          <button
            onClick={() => { void handleExportPdf(); }}
            disabled={exporting || !hasEnoughData}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>

        {!hasEnoughData && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
            <p className="text-sm font-semibold text-amber-300">Not enough data yet</p>
            <p className="mt-1 text-xs text-amber-300/70">
              Forecasting requires at least 7 recorded sales. Make more sales and check back.
            </p>
          </div>
        )}

        <FeatureGate feature="forecasting">
          {/* ── Upcoming Lebanese Holidays ─────────────────────────────── */}
          {upcomingHolidays.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">
                  Upcoming Lebanese Holidays — Next 30 Days
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {upcomingHolidays.map((h, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {h.daysAway === 0 ? 'Today' : `In ${h.daysAway}d`} — {h.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* ── Revenue Forecast Chart ──────────────────────────────────── */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-white">
                Revenue Forecast — 30 Days Ahead
              </h2>
            </div>
            <p className="mb-4 text-xs text-white/40">
              90-day history (solid line) + 30-day linear trend forecast (dashed) with ±15% confidence
              band. Orange dots mark Lebanese public holidays.
            </p>

            {hasEnoughData ? (
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    interval={Math.floor(chartData.length / 8)}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickFormatter={(v: number) =>
                      `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
                    }
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip chartData={chartData} />} />
                  <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }} />

                  {/* Confidence band (shaded area, no legend entries) */}
                  <Area
                    type="monotone"
                    dataKey="ciMax"
                    fill="#6366f1"
                    fillOpacity={0.1}
                    stroke="none"
                    name="CI Upper"
                    legendType="none"
                    activeDot={false}
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="ciMin"
                    fill="#0f172a"
                    fillOpacity={1}
                    stroke="none"
                    name="CI Lower"
                    legendType="none"
                    activeDot={false}
                    connectNulls
                  />

                  {/* Actual revenue (solid indigo line) */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    name="Actual Revenue"
                    connectNulls={false}
                    activeDot={{ r: 4, fill: '#6366f1' }}
                  />

                  {/* Forecast (dashed sky line) */}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    name="Forecast"
                    connectNulls={false}
                    activeDot={{ r: 4, fill: '#0ea5e9' }}
                  />

                  {/* Holiday dots on forecast segment */}
                  {chartData
                    .filter(p => p.isHoliday && p.forecast !== null && p.forecast !== undefined)
                    .map((p, i) => (
                      <ReferenceDot
                        key={`hol-${i}`}
                        x={p.dateLabel}
                        y={p.forecast ?? 0}
                        r={5}
                        fill="#f59e0b"
                        stroke="none"
                      />
                    ))}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-white/30">
                Not enough sales data to render chart
              </div>
            )}
          </section>

          {/* ── Top Product Velocity ────────────────────────────────────── */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">Top Product Velocity</h2>
            </div>
            <p className="mb-4 text-xs text-white/40">
              Based on last 90 days. Units sold per day, projected 30-day demand, and revenue per day.
            </p>

            {productVelocity.length === 0 ? (
              <div className="py-8 text-center text-sm text-white/30">
                No product velocity data yet. Record some sales to populate this table.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-2 pr-4 text-left text-xs font-medium text-white/40">#</th>
                      <th className="py-2 pr-4 text-left text-xs font-medium text-white/40">Product</th>
                      <th className="py-2 pr-4 text-right text-xs font-medium text-white/40">Units / Day</th>
                      <th className="py-2 pr-4 text-right text-xs font-medium text-white/40">Proj. 30d Units</th>
                      <th className="py-2 text-right text-xs font-medium text-white/40">Revenue / Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productVelocity.slice(0, 20).map((p, i) => (
                      <tr
                        key={p.productId}
                        className="border-b border-white/5 transition-colors hover:bg-white/5"
                      >
                        <td className="py-3 pr-4 text-white/40">{i + 1}</td>
                        <td className="py-3 pr-4 font-medium text-white">{p.productName}</td>
                        <td className="py-3 pr-4 text-right text-white/80">{fmtUnits(p.unitsPerDay)}</td>
                        <td className="py-3 pr-4 text-right text-white/80">
                          {Math.round(p.projected30d).toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-semibold text-emerald-400">
                          {fmtUSD(p.revenuePerDay)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Customer Lifetime Value ─────────────────────────────────── */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-white">Customer Lifetime Value (CLV)</h2>
            </div>
            <p className="mb-4 text-xs text-white/40">
              CLV = avg order value × purchase frequency (per year) × 2 years retention. Top 10 customers.
            </p>

            {clvData.length === 0 ? (
              <div className="py-8 text-center text-sm text-white/30">
                No customer purchase data. Tag customers on sales to compute CLV.
              </div>
            ) : (
              <div className="space-y-2">
                {clvData.map((c, i) => (
                  <div
                    key={c.customerId}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300">
                      {i === 0 ? <Award className="h-4 w-4 text-amber-400" /> : i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{c.customerName}</p>
                      <p className="text-xs text-white/40">
                        {c.visitCount} visits · avg {fmtUSD(c.avgOrderValue)} · {fmtUnits(c.purchasesPerYear)}{' '}
                        orders/yr
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-block rounded-full border border-emerald-500/25 bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-400">
                        {fmtUSD(c.clv)} CLV
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Stock Depletion Forecast ────────────────────────────────── */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-rose-400" />
              <h2 className="text-base font-semibold text-white">Stock Depletion Forecast</h2>
            </div>
            <p className="mb-4 text-xs text-white/40">
              Products projected to run out within 30 days based on 30-day sales velocity. Sorted by soonest.
            </p>

            {stockDepletion.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <p className="text-sm text-emerald-300">
                  No products are projected to run out in the next 30 days.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-2 pr-4 text-left text-xs font-medium text-white/40">Product</th>
                      <th className="py-2 pr-4 text-right text-xs font-medium text-white/40">
                        Current Stock
                      </th>
                      <th className="py-2 pr-4 text-right text-xs font-medium text-white/40">
                        Daily Velocity
                      </th>
                      <th className="py-2 text-right text-xs font-medium text-white/40">
                        Days Until Stockout
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockDepletion.map(p => {
                      const urgencyClass =
                        p.daysUntilStockout <= 7
                          ? 'border-rose-500/30 bg-rose-500/15 text-rose-400'
                          : p.daysUntilStockout <= 14
                            ? 'border-amber-500/30 bg-amber-500/15 text-amber-400'
                            : 'border-yellow-500/30 bg-yellow-500/15 text-yellow-400';

                      return (
                        <tr
                          key={p.productId}
                          className="border-b border-white/5 transition-colors hover:bg-white/5"
                        >
                          <td className="py-3 pr-4 font-medium text-white">{p.productName}</td>
                          <td className="py-3 pr-4 text-right text-white/80">
                            {p.stock.toLocaleString()}
                          </td>
                          <td className="py-3 pr-4 text-right text-white/80">
                            {fmtUnits(p.dailyVelocity)} / day
                          </td>
                          <td className="py-3 text-right">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${urgencyClass}`}
                            >
                              {Math.floor(p.daysUntilStockout)}d
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </FeatureGate>
      </div>
    </Layout>
  );
}
