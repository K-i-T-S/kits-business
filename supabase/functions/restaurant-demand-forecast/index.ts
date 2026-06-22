/**
 * restaurant-demand-forecast
 *
 * Nightly cron Edge Function (runs at 2:00 AM Beirut time).
 * Generates 7-day demand forecasts for all active restaurant tenants.
 * Applies Lebanese/MENA seasonality factors (Ramadan, public holidays, summer peak).
 * Saves predictions to `restaurant_demand_forecasts` table.
 *
 * Invocation:
 *   - Cron: POST with empty body (Supabase pg_cron / cron.schedule)
 *   - Manual: POST { "tenant_id": "<uuid>" } to run for a single tenant
 *   - Authorization header required: Bearer <SUPABASE_SERVICE_ROLE_KEY> or internal cron token
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'supabase';
import { toZonedTime, format } from 'date-fns-tz';

// ── Constants ─────────────────────────────────────────────────────────────────

const BEIRUT_TZ = 'Asia/Beirut';
const FORECAST_DAYS = 7;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Lebanese / MENA public holidays (MM-DD, recurring annually) */
const LEBANESE_HOLIDAYS: ReadonlyArray<string> = [
  '01-01', // New Year's Day
  '02-09', // St. Maroun's Day
  '03-25', // Annunciation Day
  '05-01', // Labour Day
  '05-06', // Martyrs' Day
  '08-15', // Assumption of Mary
  '11-01', // All Saints' Day
  '11-22', // Independence Day
  '12-25', // Christmas
];

/** Ramadan date ranges (approximate, sun-calendar drift ±1 day) */
const RAMADAN_PERIODS: ReadonlyArray<{ start: string; end: string }> = [
  { start: '2025-03-01', end: '2025-03-29' },
  { start: '2026-02-18', end: '2026-03-19' },
  { start: '2027-02-08', end: '2027-03-09' },
  { start: '2028-01-28', end: '2028-02-25' },
];

/** Lebanese summer peak months (July + August = 6–8 inclusive) */
const SUMMER_PEAK_MONTHS = new Set([6, 7, 8]); // 1-indexed (June–August)

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  tenant_id?: string;
}

interface TenantRow {
  id: string;
  name: string;
  industry: string | null;
  subscription_plan: string | null;
}

interface HistoricalOrderRow {
  closed_at: string | null;
  covers: number | null;
  total_amount: number | null;
}

interface SeasonalityResult {
  factor: number;
  labels: string[];
}

interface DayForecast {
  forecast_date: string;       // ISO date YYYY-MM-DD
  day_of_week: number;         // 0=Sun … 6=Sat
  predicted_covers: number;
  predicted_revenue_usd: number;
  confidence: number;          // 0.0 – 1.0
  seasonality_factor: number;
  seasonality_labels: string[];
  is_holiday: boolean;
  is_ramadan: boolean;
  is_summer_peak: boolean;
}

interface ForecastRow {
  tenant_id: string;
  forecast_date: string;
  day_of_week: number;
  predicted_covers: number;
  predicted_revenue_usd: number;
  confidence: number;
  seasonality_factor: number;
  seasonality_labels: string[];
  is_holiday: boolean;
  is_ramadan: boolean;
  is_summer_peak: boolean;
  generated_at: string;
  historical_days_used: number;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Format a Date to YYYY-MM-DD in Beirut timezone */
function toBeirutDate(date: Date): string {
  return format(toZonedTime(date, BEIRUT_TZ), 'yyyy-MM-dd', { timeZone: BEIRUT_TZ });
}

/** Return true if the given YYYY-MM-DD is a Lebanese public holiday */
function isLebaneseHoliday(dateStr: string): boolean {
  const mmdd = dateStr.slice(5); // "MM-DD"
  return LEBANESE_HOLIDAYS.includes(mmdd);
}

/** Return true if the given YYYY-MM-DD falls within a Ramadan period */
function isRamadan(dateStr: string): boolean {
  return RAMADAN_PERIODS.some(
    (r) => dateStr >= r.start && dateStr <= r.end,
  );
}

/** Return true if the given YYYY-MM-DD is in Lebanese summer peak (June–August) */
function isSummerPeak(dateStr: string): boolean {
  const month = parseInt(dateStr.slice(5, 7), 10);
  return SUMMER_PEAK_MONTHS.has(month);
}

/** Return the day-of-week for a YYYY-MM-DD string (0=Sun … 6=Sat) */
function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/**
 * Compute the combined seasonality multiplier and human-readable labels
 * for a given forecast date.
 *
 * Factors applied:
 *   - Weekends (Fri/Sat in Lebanon) +20%
 *   - Mondays (slow day) -10%
 *   - Summer peak (Jun–Aug) +30%
 *   - Ramadan: Iftar spike +40% (traffic shifts to evening) but lunch -50%;
 *     net daily effect averaged at +10%
 *   - Lebanese public holiday +25%
 *   - No simultaneous "summer × Ramadan" compounding (Ramadan overrides)
 */
function computeSeasonality(dateStr: string): SeasonalityResult {
  const dow = dayOfWeek(dateStr);
  const holiday = isLebaneseHoliday(dateStr);
  const ramadan = isRamadan(dateStr);
  const summer = isSummerPeak(dateStr);

  let factor = 1.0;
  const labels: string[] = [];

  // Day-of-week baseline
  if (dow === 5 || dow === 6) {
    // Friday / Saturday — Lebanese peak nights
    factor *= 1.2;
    labels.push('weekend');
  } else if (dow === 1) {
    // Monday — typically slow
    factor *= 0.9;
    labels.push('slow_monday');
  }

  // Seasonal overlays
  if (ramadan) {
    // Ramadan: heavy evening concentration, overall volume +10%
    factor *= 1.1;
    labels.push('ramadan');
  } else if (summer) {
    // Summer peak only when not in Ramadan
    factor *= 1.3;
    labels.push('summer_peak');
  }

  // Public holiday bonus (on top of everything)
  if (holiday) {
    factor *= 1.25;
    labels.push('public_holiday');
  }

  return { factor: parseFloat(factor.toFixed(4)), labels };
}

// ── Forecasting logic ─────────────────────────────────────────────────────────

/**
 * Compute baseline covers + revenue from historical data.
 * Uses same-day-of-week averages over the past N weeks (up to 8 weeks).
 * Falls back to overall daily average when DOW sample is too small.
 *
 * Returns { baselineCovers, baselineRevenue, daysUsed }
 */
function computeBaseline(
  historicalOrders: HistoricalOrderRow[],
  targetDow: number,
): { baselineCovers: number; baselineRevenue: number; daysUsed: number } {
  if (historicalOrders.length === 0) {
    return { baselineCovers: 20, baselineRevenue: 400, daysUsed: 0 };
  }

  // Group historical records by date
  const byDate = new Map<string, { covers: number; revenue: number }>();

  for (const row of historicalOrders) {
    if (!row.closed_at) continue;
    const dateStr = row.closed_at.slice(0, 10);
    const existing = byDate.get(dateStr);
    if (existing) {
      existing.covers += row.covers ?? 0;
      existing.revenue += row.total_amount ?? 0;
    } else {
      byDate.set(dateStr, {
        covers: row.covers ?? 0,
        revenue: row.total_amount ?? 0,
      });
    }
  }

  // Split into same-DOW days vs all days
  const sameDowDays: Array<{ covers: number; revenue: number }> = [];
  const allDays: Array<{ covers: number; revenue: number }> = [];

  for (const [dateStr, totals] of byDate) {
    allDays.push(totals);
    if (dayOfWeek(dateStr) === targetDow) {
      sameDowDays.push(totals);
    }
  }

  const source = sameDowDays.length >= 3 ? sameDowDays : allDays;
  if (source.length === 0) {
    return { baselineCovers: 20, baselineRevenue: 400, daysUsed: 0 };
  }

  const avgCovers = source.reduce((s, d) => s + d.covers, 0) / source.length;
  const avgRevenue = source.reduce((s, d) => s + d.revenue, 0) / source.length;

  return {
    baselineCovers: Math.max(1, Math.round(avgCovers)),
    baselineRevenue: parseFloat(Math.max(0, avgRevenue).toFixed(2)),
    daysUsed: allDays.size ?? allDays.length,
  };
}

/**
 * Compute confidence score (0.0–1.0) based on how much historical data is
 * available.  More data = higher confidence.
 */
function computeConfidence(daysUsed: number): number {
  if (daysUsed === 0) return 0.2;
  if (daysUsed < 7) return 0.35;
  if (daysUsed < 14) return 0.5;
  if (daysUsed < 30) return 0.65;
  if (daysUsed < 60) return 0.8;
  return 0.92;
}

/**
 * Build 7-day forecasts for a single tenant given their historical orders.
 */
function buildForecasts(
  tenantId: string,
  historicalOrders: HistoricalOrderRow[],
  startDate: Date,
): DayForecast[] {
  const forecasts: DayForecast[] = [];
  const generatedAt = new Date().toISOString();

  for (let i = 0; i < FORECAST_DAYS; i++) {
    const targetDate = new Date(startDate);
    targetDate.setUTCDate(targetDate.getUTCDate() + i);
    const dateStr = toBeirutDate(targetDate);
    const dow = dayOfWeek(dateStr);

    const { baselineCovers, baselineRevenue, daysUsed } =
      computeBaseline(historicalOrders, dow);

    const { factor, labels } = computeSeasonality(dateStr);
    const confidence = computeConfidence(daysUsed);

    forecasts.push({
      forecast_date: dateStr,
      day_of_week: dow,
      predicted_covers: Math.round(baselineCovers * factor),
      predicted_revenue_usd: parseFloat((baselineRevenue * factor).toFixed(2)),
      confidence,
      seasonality_factor: factor,
      seasonality_labels: labels,
      is_holiday: isLebaneseHoliday(dateStr),
      is_ramadan: isRamadan(dateStr),
      is_summer_peak: isSummerPeak(dateStr),
    });
  }

  return forecasts;
}

// ── Per-tenant runner ─────────────────────────────────────────────────────────

async function runForecastForTenant(
  db: ReturnType<typeof createClient>,
  tenantId: string,
  startDate: Date,
): Promise<{ tenant_id: string; days_written: number; error?: string }> {
  // Fetch last 56 days of historical table_orders (8 weeks × 7 days)
  const lookbackDate = new Date(startDate);
  lookbackDate.setUTCDate(lookbackDate.getUTCDate() - 56);

  const { data: orders, error: fetchError } = await db
    .from('table_orders')
    .select('closed_at, covers, total_amount')
    .eq('tenant_id', tenantId)
    .eq('status', 'closed')
    .gte('closed_at', lookbackDate.toISOString())
    .lt('closed_at', startDate.toISOString())
    .returns<HistoricalOrderRow[]>();

  if (fetchError) {
    console.error(
      `[demand-forecast] Failed to fetch orders for tenant ${tenantId}:`,
      fetchError.message,
    );
    return { tenant_id: tenantId, days_written: 0, error: fetchError.message };
  }

  const historicalOrders = orders ?? [];
  const forecasts = buildForecasts(tenantId, historicalOrders, startDate);
  const generatedAt = new Date().toISOString();

  // Build insert payload
  const rows: ForecastRow[] = forecasts.map((f) => ({
    tenant_id: tenantId,
    forecast_date: f.forecast_date,
    day_of_week: f.day_of_week,
    predicted_covers: f.predicted_covers,
    predicted_revenue_usd: f.predicted_revenue_usd,
    confidence: f.confidence,
    seasonality_factor: f.seasonality_factor,
    seasonality_labels: f.seasonality_labels,
    is_holiday: f.is_holiday,
    is_ramadan: f.is_ramadan,
    is_summer_peak: f.is_summer_peak,
    generated_at: generatedAt,
    historical_days_used: historicalOrders.length,
  }));

  // Upsert: overwrite any forecasts for the same (tenant_id, forecast_date)
  const { error: upsertError } = await db
    .from('restaurant_demand_forecasts')
    .upsert(rows, { onConflict: 'tenant_id,forecast_date' });

  if (upsertError) {
    console.error(
      `[demand-forecast] Upsert failed for tenant ${tenantId}:`,
      upsertError.message,
    );
    return { tenant_id: tenantId, days_written: 0, error: upsertError.message };
  }

  console.log(
    `[demand-forecast] Wrote ${rows.length} forecast rows for tenant ${tenantId}`,
  );
  return { tenant_id: tenantId, days_written: rows.length };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const db = createClient(supabaseUrl, serviceKey);

  // Parse optional body — single-tenant override for manual runs / testing
  let singleTenantId: string | null = null;
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      const body = JSON.parse(text) as RequestBody;
      singleTenantId = body.tenant_id ?? null;
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Forecast starts from tomorrow 00:00 Beirut
  const now = new Date();
  const tomorrowBeirut = toZonedTime(now, BEIRUT_TZ);
  tomorrowBeirut.setDate(tomorrowBeirut.getDate() + 1);
  tomorrowBeirut.setHours(0, 0, 0, 0);
  // Use UTC equivalent as anchor for date arithmetic
  const startDate = new Date(
    Date.UTC(
      tomorrowBeirut.getFullYear(),
      tomorrowBeirut.getMonth(),
      tomorrowBeirut.getDate(),
    ),
  );

  try {
    if (singleTenantId) {
      // ── Single-tenant run (manual / testing) ──────────────────────────────
      const result = await runForecastForTenant(db, singleTenantId, startDate);

      return new Response(
        JSON.stringify({ success: !result.error, results: [result] }),
        {
          status: result.error ? 500 : 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }

    // ── Nightly cron run: all active restaurant tenants ───────────────────────
    const { data: tenants, error: tenantsError } = await db
      .from('tenants')
      .select('id, name, industry, subscription_plan')
      .eq('industry', 'restaurant')
      .returns<TenantRow[]>();

    if (tenantsError) {
      console.error('[demand-forecast] Failed to fetch tenants:', tenantsError.message);
      return new Response(
        JSON.stringify({ error: tenantsError.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const activeTenants = tenants ?? [];
    console.log(
      `[demand-forecast] Running for ${activeTenants.length} restaurant tenant(s). Start: ${startDate.toISOString()}`,
    );

    const results: Array<{ tenant_id: string; days_written: number; error?: string }> = [];

    for (const tenant of activeTenants) {
      const result = await runForecastForTenant(db, tenant.id, startDate);
      results.push(result);
    }

    const successCount = results.filter((r) => !r.error).length;
    const errorCount = results.length - successCount;

    console.log(
      `[demand-forecast] Complete. ${successCount} succeeded, ${errorCount} failed.`,
    );

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        tenants_processed: activeTenants.length,
        succeeded: successCount,
        failed: errorCount,
        forecast_start: toBeirutDate(startDate),
        forecast_end: (() => {
          const end = new Date(startDate);
          end.setUTCDate(end.getUTCDate() + FORECAST_DAYS - 1);
          return toBeirutDate(end);
        })(),
        results,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[demand-forecast] Unhandled error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
