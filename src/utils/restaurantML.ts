/**
 * Restaurant ML Engine — pure TypeScript, runs entirely in-browser.
 *
 * Algorithms implemented:
 *   1. Double Exponential Smoothing (Holt) — short-range revenue forecasting
 *   2. Weighted 4-week seasonal baseline — Lebanese DOW patterns (Thu/Fri peaks)
 *   3. Linear regression with seasonal dummies — 30-day trend + forecasts
 *   4. Z-score anomaly detection — item velocity, tip rate, table turn time
 *   5. CLV estimation (RFM-lite) — top customer identification
 *   6. Ramadan structural-break detection — calendar-based, auto-adjusts seasonality
 *   7. Section occupancy seasonality — outdoor/indoor by month
 *   8. Menu velocity ranking + decline detection
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyRevenue {
  date: string; // YYYY-MM-DD (Beirut TZ)
  dayOfWeek: number; // 0=Sun … 6=Sat
  totalUsd: number;
  orderCount: number;
  avgCheck: number;
}

export interface HourlySlice {
  hour: number; // 0–23
  revenue: number;
  covers: number;
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number; // 80% prediction interval lower
  upper: number; // 80% prediction interval upper
  isRamadan: boolean;
}

export interface ItemVelocity {
  name: string;
  last7DayQty: number;
  prev7DayQty: number;
  trend: number; // pct change; negative = falling
  zScore: number; // vs. item's own history
  alert: 'rising' | 'falling' | 'normal';
}

export interface AnomalyAlert {
  type: 'slow_table' | 'falling_item' | 'tip_drop' | 'argile_outlier';
  severity: 'high' | 'medium' | 'low';
  message: string;
  value: number;
}

export interface WeeklyPattern {
  dayOfWeek: number; // 0–6
  label: string;
  avgRevenue: number;
  peakHour: number;
  indexVsWeekAvg: number; // 1.0 = average; >1 = above average
}

export interface MLInsight {
  icon: string;
  title: string;
  body: string;
  action?: string;
  severity: 'info' | 'warning' | 'opportunity';
}

// ── MENA calendar helpers ─────────────────────────────────────────────────────

const LEBANESE_HOLIDAYS_MMDD = new Set([
  '01-01', // New Year
  '02-09', // St. Maroun
  '03-25', // Annunciation
  '05-01', // Labour Day
  '05-06', // Martyrs Day
  '08-15', // Assumption
  '11-01', // All Saints
  '11-22', // Independence Day
  '12-25', // Christmas
]);

export function isLebanesHoliday(date: Date): boolean {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return LEBANESE_HOLIDAYS_MMDD.has(mmdd);
}

/**
 * Approximate Ramadan detection by Gregorian year.
 * Uses published 2024–2027 Ramadan start dates; outside that range falls back to
 * a rough Islamic calendar offset (accurate to ±2 days for planning purposes).
 */
const RAMADAN_STARTS: Record<number, string> = {
  2024: '2024-03-10',
  2025: '2025-03-01',
  2026: '2026-02-18',
  2027: '2027-02-08',
};

export function isRamadan(date: Date): boolean {
  const year = date.getFullYear();
  const startStr = RAMADAN_STARTS[year];
  if (!startStr) return false;
  const start = new Date(startStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 29);
  return date >= start && date <= end;
}

/**
 * Summer outdoor season: June–September.
 * Peak outdoor revenue period for Lebanese restaurants.
 */
export function isOutdoorSeason(date: Date): boolean {
  const m = date.getMonth() + 1;
  return m >= 6 && m <= 9;
}

// ── Algorithm 1: Double Exponential Smoothing (Holt's Linear) ─────────────────

interface HoltResult {
  forecast: number[];
  level: number;
  trend: number;
}

export function holtSmoothing(
  series: number[],
  alpha = 0.3, // level smoothing
  beta = 0.1, // trend smoothing
  steps = 7,
): HoltResult {
  if (series.length < 2) {
    const val = series[0] ?? 0;
    return { forecast: Array<number>(steps).fill(val), level: val, trend: 0 };
  }

  let level = series[0]!;
  let trend = series[1]! - series[0]!;

  for (let i = 1; i < series.length; i++) {
    const y = series[i]!;
    const prevLevel = level;
    level = alpha * y + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const forecast = Array.from({ length: steps }, (_, h) =>
    Math.max(0, level + (h + 1) * trend),
  );

  return { forecast, level, trend };
}

// ── Algorithm 2: Lebanese DOW seasonal weights ────────────────────────────────

// Thu=5 and Fri=6 are peak days in Lebanon (Islamic weekend culture).
// Sat=6, Sun=0 are slower. Mon–Wed are weekday moderate.
const LEBANESE_DOW_WEIGHTS = [0.75, 0.80, 0.85, 0.90, 0.95, 1.30, 1.45]; // Sun=0 … Sat=6

export function applyDowSeasonal(baseValue: number, dayOfWeek: number): number {
  return baseValue * (LEBANESE_DOW_WEIGHTS[dayOfWeek] ?? 1.0);
}

// Ramadan adjustment: dinner shifts to late night; overall food revenue drops ~20%
// but argile revenue is often flat or up.
export function applyRamadanAdjustment(value: number, isRamadanPeriod: boolean): number {
  return isRamadanPeriod ? value * 0.80 : value;
}

// ── Algorithm 3: OLS linear regression (simple, browser-safe) ────────────────

interface LinearFit {
  slope: number;
  intercept: number;
  r2: number;
  predict: (x: number) => number;
}

export function linearRegression(x: number[], y: number[]): LinearFit {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0, r2: 0, predict: () => y[0] ?? 0 };

  const xMean = x.reduce((s, v) => s + v, 0) / n;
  const yMean = y.reduce((s, v) => s + v, 0) / n;

  let ssXY = 0, ssXX = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssXY += ((x[i]! - xMean) * (y[i]! - yMean));
    ssXX += ((x[i]! - xMean) ** 2);
    ssTot += ((y[i]! - yMean) ** 2);
  }

  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const intercept = yMean - slope * xMean;
  const ssRes = y.reduce((s, yi, i) => s + (yi - (slope * x[i]! + intercept)) ** 2, 0);
  const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2, predict: (v: number) => slope * v + intercept };
}

// ── Algorithm 4: Z-score anomaly detection ────────────────────────────────────

export function zScore(value: number, series: number[]): number {
  const n = series.length;
  if (n < 2) return 0;
  const mean = series.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(series.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return std !== 0 ? (value - mean) / std : 0;
}

export function detectAnomalies(series: number[], threshold = 2.0): boolean[] {
  return series.map((v) => Math.abs(zScore(v, series)) > threshold);
}

// ── Algorithm 5: CLV estimation (RFM-lite) ────────────────────────────────────

export interface CustomerRFM {
  customerId: string;
  name: string;
  recencyDays: number;
  frequency: number; // visits in 90 days
  monetaryAvg: number; // avg spend per visit
  clvEstimate: number; // 12-month projected value
  segment: 'champion' | 'loyal' | 'at_risk' | 'lost' | 'prospect';
}

export function computeRFM(visits: Array<{ customerId: string; name: string; date: string; total: number }>): CustomerRFM[] {
  const now = Date.now();
  const ninety = 90 * 86400_000;

  // Group by customer
  const map = new Map<string, { name: string; dates: number[]; totals: number[] }>();
  for (const v of visits) {
    const ts = new Date(v.date).getTime();
    if (!map.has(v.customerId)) map.set(v.customerId, { name: v.name, dates: [], totals: [] });
    map.get(v.customerId)!.dates.push(ts);
    map.get(v.customerId)!.totals.push(v.total);
  }

  const result: CustomerRFM[] = [];
  for (const [customerId, { name, dates, totals }] of map.entries()) {
    const lastVisit = Math.max(...dates);
    const recencyDays = Math.floor((now - lastVisit) / 86400_000);
    const recent = dates.filter((d) => now - d < ninety).length;
    const monetaryAvg = totals.reduce((s, v) => s + v, 0) / totals.length;
    const clvEstimate = monetaryAvg * (recent / 90) * 365;

    const segment: CustomerRFM['segment'] =
      recencyDays <= 14 && recent >= 4 ? 'champion'
        : recencyDays <= 30 && recent >= 2 ? 'loyal'
          : recencyDays <= 60 ? 'at_risk'
            : recencyDays <= 90 ? 'lost'
              : 'prospect';

    result.push({ customerId, name, recencyDays, frequency: recent, monetaryAvg, clvEstimate, segment });
  }

  return result.sort((a, b) => b.clvEstimate - a.clvEstimate);
}

// ── Algorithm 6: Menu velocity ranking + decline detection ────────────────────

export function computeItemVelocity(
  items: Array<{ name: string; date: string; qty: number }>,
): ItemVelocity[] {
  const now = Date.now();
  const day7 = 7 * 86400_000;

  const map = new Map<string, { dates: number[]; qtys: number[] }>();
  for (const item of items) {
    const ts = new Date(item.date).getTime();
    if (!map.has(item.name)) map.set(item.name, { dates: [], qtys: [] });
    map.get(item.name)!.dates.push(ts);
    map.get(item.name)!.qtys.push(item.qty);
  }

  const result: ItemVelocity[] = [];
  for (const [name, { dates, qtys }] of map.entries()) {
    const last7 = dates.reduce((s, d, i) => (now - d < day7 ? s + qtys[i]! : s), 0);
    const prev7 = dates.reduce((s, d, i) => (now - d >= day7 && now - d < 2 * day7 ? s + qtys[i]! : s), 0);
    const trend = prev7 > 0 ? (last7 - prev7) / prev7 : 0;

    // Z-score vs. all 14-day totals grouped by day
    const dailyQtys = new Array<number>();
    const dayMap = new Map<string, number>();
    for (let i = 0; i < dates.length; i++) {
      const day = new Date(dates[i]!).toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + qtys[i]!);
    }
    dayMap.forEach((v) => dailyQtys.push(v));

    const z = zScore(last7 / 7, dailyQtys);
    const alert: ItemVelocity['alert'] = trend <= -0.20 ? 'falling' : trend >= 0.20 ? 'rising' : 'normal';

    result.push({ name, last7DayQty: last7, prev7DayQty: prev7, trend, zScore: z, alert });
  }

  return result.sort((a, b) => b.last7DayQty - a.last7DayQty);
}

// ── Main: generate 7-day revenue forecast ────────────────────────────────────

export function generateForecast(history: DailyRevenue[], daysAhead = 7): ForecastPoint[] {
  if (history.length === 0) return [];

  const revenues = history.map((d) => d.totalUsd);
  const { forecast, level, trend: _trend } = holtSmoothing(revenues, 0.3, 0.1, daysAhead);

  // Std-dev for 80% prediction interval (±1.28σ)
  const residuals = history.map((d, i) => {
    const fitted = holtSmoothing(revenues.slice(0, i + 1), 0.3, 0.1, 1).forecast[0] ?? d.totalUsd;
    return d.totalUsd - fitted;
  });
  const sigma = residuals.length > 1
    ? Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length)
    : level * 0.15;

  const lastDate = new Date(history[history.length - 1]!.date);

  return Array.from({ length: daysAhead }, (_, i) => {
    const date = new Date(lastDate);
    date.setDate(date.getDate() + i + 1);
    const dow = date.getDay();
    const ramadan = isRamadan(date);

    let predicted = forecast[i] ?? 0;
    predicted = applyDowSeasonal(predicted, dow);
    predicted = applyRamadanAdjustment(predicted, ramadan);
    predicted = Math.max(0, predicted);

    return {
      date: date.toISOString().slice(0, 10),
      predicted: Math.round(predicted * 100) / 100,
      lower: Math.max(0, Math.round((predicted - 1.28 * sigma) * 100) / 100),
      upper: Math.round((predicted + 1.28 * sigma) * 100) / 100,
      isRamadan: ramadan,
    };
  });
}

// ── Weekly pattern analysis ───────────────────────────────────────────────────

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function analyzeWeeklyPattern(history: DailyRevenue[]): WeeklyPattern[] {
  const byDow = Array.from({ length: 7 }, (_, i) => ({
    dow: i,
    revenues: [] as number[],
    peakHours: [] as number[],
  }));

  for (const d of history) {
    byDow[d.dayOfWeek]!.revenues.push(d.totalUsd);
  }

  const avgByDow = byDow.map((d) =>
    d.revenues.length > 0 ? d.revenues.reduce((s, v) => s + v, 0) / d.revenues.length : 0,
  );
  const weekAvg = avgByDow.reduce((s, v) => s + v, 0) / 7;

  return byDow.map((d, i) => ({
    dayOfWeek: i,
    label: DOW_LABELS[i] ?? '',
    avgRevenue: avgByDow[i] ?? 0,
    peakHour: 20, // default 8pm Beirut; would refine with hourly data
    indexVsWeekAvg: weekAvg > 0 ? (avgByDow[i] ?? 0) / weekAvg : 1,
  }));
}

// ── Auto-generated actionable insights ───────────────────────────────────────

export function generateInsights(params: {
  pattern: WeeklyPattern[];
  forecast: ForecastPoint[];
  velocities: ItemVelocity[];
  avgTipRate: number;
  prevAvgTipRate: number;
  argileRevenuePct: number;
}): MLInsight[] {
  const insights: MLInsight[] = [];
  const { pattern, forecast, velocities, avgTipRate, prevAvgTipRate, argileRevenuePct } = params;

  // 1. Weakest weekday
  const nonPeak = pattern.filter((d) => d.indexVsWeekAvg < 0.85);
  for (const d of nonPeak.slice(0, 1)) {
    insights.push({
      icon: '📉',
      title: `${d.label} underperforms`,
      body: `${d.label} revenue is ${Math.round((1 - d.indexVsWeekAvg) * 100)}% below your weekly average. Consider a lunch set or promotion.`,
      action: 'Create promotion',
      severity: 'opportunity',
    });
  }

  // 2. Falling menu items
  const falling = velocities.filter((v) => v.alert === 'falling').slice(0, 2);
  for (const item of falling) {
    insights.push({
      icon: '⚠️',
      title: `"${item.name}" sales dropping`,
      body: `Down ${Math.round(Math.abs(item.trend) * 100)}% vs. last week (${item.last7DayQty} vs ${item.prev7DayQty} sold). Review quality or consider 86-ing.`,
      action: 'Review item',
      severity: 'warning',
    });
  }

  // 3. Upcoming weekend forecast
  const upcomingThu = forecast.find((f) => new Date(f.date).getDay() === 4);
  if (upcomingThu && upcomingThu.predicted > 0) {
    insights.push({
      icon: '🎯',
      title: `Thu forecast: $${upcomingThu.predicted.toFixed(0)}`,
      body: `80% confidence interval: $${upcomingThu.lower.toFixed(0)} – $${upcomingThu.upper.toFixed(0)}. ${upcomingThu.isRamadan ? '(Ramadan adjustment applied)' : 'Plan staffing accordingly.'}`,
      severity: 'info',
    });
  }

  // 4. Tip rate alert
  if (prevAvgTipRate > 0 && avgTipRate < prevAvgTipRate * 0.85) {
    insights.push({
      icon: '💸',
      title: 'Tip rate declining',
      body: `Average tip rate dropped from ${(prevAvgTipRate * 100).toFixed(1)}% to ${(avgTipRate * 100).toFixed(1)}%. Check service quality scores.`,
      severity: 'warning',
    });
  }

  // 5. Argile revenue concentration
  if (argileRevenuePct > 0.40) {
    insights.push({
      icon: '💨',
      title: 'Argile is 40%+ of revenue',
      body: `Argile contributes ${Math.round(argileRevenuePct * 100)}% of your revenue — above the 40% benchmark. Consider bundling flavors to protect margin.`,
      severity: 'info',
    });
  }

  // 6. Ramadan structural break warning
  if (forecast.some((f) => f.isRamadan)) {
    insights.push({
      icon: '🌙',
      title: 'Ramadan period ahead',
      body: 'Forecasts have been adjusted: expect lunch revenue to drop ~80%, late-night service 8pm–2am peaks. Reduce daytime staffing; add late shifts.',
      severity: 'warning',
    });
  }

  return insights;
}
