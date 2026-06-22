// restaurant-menu-engineering — nightly BCG matrix classification
// Runs at 3:30am Beirut time via pg_cron or external cron call
// Reads 30-day sales history, computes popularity + margin scores per menu item,
// classifies into star/plowhorse/puzzle/dog, writes to restaurant_menu_engineering_cache.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// ── Types ─────────────────────────────────────────────────────────────────────

type MenuCategory = 'star' | 'plowhorse' | 'puzzle' | 'dog';

interface MenuItemRow {
  id: string;
  tenant_id: string;
  name: string;
  base_price_usd: number;
  cost_price_usd: number | null;
}

interface OrderItemRow {
  menu_item_id: string;
  quantity: number;
  unit_price: number;
}

interface ItemMetrics {
  itemId: string;
  itemName: string;
  unitsSold: number;
  grossRevenue: number;
  avgPrice: number;
  costPriceUsd: number | null;
  basePriceUsd: number;
}

interface EngineeredItem {
  itemId: string;
  itemName: string;
  popularityScore: number;    // 0–1, relative to menu avg
  marginScore: number;        // 0–1, relative to menu avg
  category: MenuCategory;
  recommendedAction: string;
  potentialRevenueImpact: number;  // USD/month
}

interface TenantRow {
  id: string;
}

interface RequestBody {
  tenant_id?: string;  // optional — if omitted, runs for all active tenants
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Number of days back to look for order data
const LOOKBACK_DAYS = 30;

// Items with fewer than this many units sold are considered "low popularity"
// relative to the menu average — used only in recommendation text generation
const MIN_UNITS_LOW = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

function lookbackDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - LOOKBACK_DAYS);
  return d.toISOString();
}

/**
 * Compute the gross margin percentage for a menu item.
 * Returns null if cost is unknown (treat as neutral in scoring).
 */
function grossMarginPct(basePriceUsd: number, costPriceUsd: number | null): number | null {
  if (costPriceUsd === null || costPriceUsd <= 0 || basePriceUsd <= 0) return null;
  return (basePriceUsd - costPriceUsd) / basePriceUsd;
}

/**
 * Normalise an array of values to [0, 1] using min-max scaling.
 * If all values are equal, returns 0.5 for each.
 */
function minMaxNorm(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

/**
 * Classify an item into BCG menu quadrant.
 *
 * Threshold: items above the midpoint (0.5) on both axes are Stars,
 * below midpoint on both are Dogs, etc.
 */
function classify(popularityScore: number, marginScore: number): MenuCategory {
  const highPop = popularityScore >= 0.5;
  const highMargin = marginScore >= 0.5;
  if (highPop && highMargin) return 'star';
  if (highPop && !highMargin) return 'plowhorse';
  if (!highPop && highMargin) return 'puzzle';
  return 'dog';
}

/**
 * Generate an actionable recommendation string for a classified item.
 * Also returns a rough monthly revenue impact estimate.
 */
function recommend(
  category: MenuCategory,
  metrics: ItemMetrics,
): { action: string; impact: number } {
  const monthlyUnits = metrics.unitsSold; // already 30-day window
  const margin = grossMarginPct(metrics.basePriceUsd, metrics.costPriceUsd);
  const marginPct = margin !== null ? Math.round(margin * 100) : null;

  switch (category) {
    case 'star': {
      // Promote heavily — more visibility = more revenue
      const impact = monthlyUnits * metrics.avgPrice * 0.15; // +15% units from promotion
      const action = marginPct !== null
        ? `Star item (${marginPct}% margin). Feature in QR menu hero section and upsell prompts. Consider a "Chef's Pick" badge to boost further.`
        : 'Star item. Feature prominently in QR menu and upsell prompts. Add "Chef\'s Pick" badge.';
      return { action, impact };
    }

    case 'plowhorse': {
      // High volume but low margin — raise price or cut portion
      const priceGap = metrics.basePriceUsd * 0.1; // 10% price uplift scenario
      const impact = monthlyUnits * priceGap;
      const action = marginPct !== null
        ? `Plowhorse item (${marginPct}% margin, high volume). Raise price by 10% or reduce portion size to improve margin. Alternatively, review supplier cost for this item.`
        : 'Plowhorse item (high volume, unknown margin). Review ingredient cost and consider a modest price increase.';
      return { action, impact };
    }

    case 'puzzle': {
      // Low volume but high margin — reposition to drive demand
      const impact = (monthlyUnits * 0.5) * metrics.avgPrice; // +50% units if repositioned
      const action = marginPct !== null
        ? `Puzzle item (${marginPct}% margin, low volume). Reposition on QR menu — improve description, add photo, feature in upsell flow. Consider a weekly special promotion.`
        : 'Puzzle item (low volume, healthy margin). Improve menu placement, write a better description, and use in targeted upsell prompts.';
      return { action, impact };
    }

    case 'dog': {
      // Low volume, low margin — remove or rebrand
      const savedCost = monthlyUnits * (metrics.costPriceUsd ?? metrics.basePriceUsd * 0.6);
      const impact = savedCost * 0.1; // 10% freed overhead from removing complexity
      const soldText = monthlyUnits <= MIN_UNITS_LOW
        ? `Only ${monthlyUnits} unit${monthlyUnits !== 1 ? 's' : ''} sold in 30 days.`
        : `${monthlyUnits} units sold in 30 days.`;
      const action = `Dog item. ${soldText} Consider removing from the menu to reduce kitchen complexity, or rebrand with a new name and photo. If kept, raise price to compensate low margin.`;
      return { action, impact };
    }
  }
}

// ── Core computation ──────────────────────────────────────────────────────────

async function computeForTenant(
  db: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<{ processed: number; skipped: number }> {
  const since = lookbackDate();

  // 1. Fetch all active menu items for this tenant
  const { data: menuItems, error: menuErr } = await db
    .from('restaurant_menu_items')
    .select('id, tenant_id, name, base_price_usd, cost_price_usd')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .returns<MenuItemRow[]>();

  if (menuErr) {
    console.error(`[menu-engineering] tenant ${tenantId}: menu fetch error:`, menuErr.message);
    return { processed: 0, skipped: 1 };
  }

  if (!menuItems || menuItems.length === 0) {
    console.log(`[menu-engineering] tenant ${tenantId}: no active menu items — skipping`);
    return { processed: 0, skipped: 0 };
  }

  const menuItemIds = menuItems.map((m) => m.id);

  // 2. Fetch 30-day order item sales for these menu items
  const { data: orderItems, error: ordErr } = await db
    .from('restaurant_order_items')
    .select('menu_item_id, quantity, unit_price')
    .eq('tenant_id', tenantId)
    .eq('status', 'served')
    .gte('sent_at', since)
    .in('menu_item_id', menuItemIds)
    .returns<OrderItemRow[]>();

  if (ordErr) {
    console.error(`[menu-engineering] tenant ${tenantId}: order items fetch error:`, ordErr.message);
    return { processed: 0, skipped: 1 };
  }

  const rows = orderItems ?? [];

  // 3. Aggregate sales per menu item
  const salesMap = new Map<string, { units: number; revenue: number; priceSum: number; priceCount: number }>();
  for (const row of rows) {
    if (!row.menu_item_id) continue;
    const existing = salesMap.get(row.menu_item_id);
    const revenue = row.unit_price * row.quantity;
    if (existing) {
      existing.units += row.quantity;
      existing.revenue += revenue;
      existing.priceSum += row.unit_price;
      existing.priceCount += 1;
    } else {
      salesMap.set(row.menu_item_id, {
        units: row.quantity,
        revenue,
        priceSum: row.unit_price,
        priceCount: 1,
      });
    }
  }

  // 4. Build metrics array — include all active menu items even if zero sales
  const metrics: ItemMetrics[] = menuItems.map((item) => {
    const agg = salesMap.get(item.id);
    return {
      itemId: item.id,
      itemName: item.name,
      unitsSold: agg?.units ?? 0,
      grossRevenue: agg?.revenue ?? 0,
      avgPrice: agg && agg.priceCount > 0 ? agg.priceSum / agg.priceCount : item.base_price_usd,
      costPriceUsd: item.cost_price_usd,
      basePriceUsd: item.base_price_usd,
    };
  });

  if (metrics.length === 0) {
    return { processed: 0, skipped: 0 };
  }

  // 5. Compute popularity scores (normalised units sold)
  const unitValues = metrics.map((m) => m.unitsSold);
  const popNorm = minMaxNorm(unitValues);

  // 6. Compute margin scores
  // For items with no cost price, use the menu-wide average margin as a substitute.
  const knownMargins = metrics
    .map((m) => grossMarginPct(m.basePriceUsd, m.costPriceUsd))
    .filter((v): v is number => v !== null);

  const avgMargin = knownMargins.length > 0
    ? knownMargins.reduce((a, b) => a + b, 0) / knownMargins.length
    : 0.5;

  const marginValues = metrics.map((m) => {
    const mg = grossMarginPct(m.basePriceUsd, m.costPriceUsd);
    return mg !== null ? mg : avgMargin;
  });
  const marginNorm = minMaxNorm(marginValues);

  // 7. Classify and build engineered items
  const engineered: EngineeredItem[] = metrics.map((m, idx) => {
    const popularityScore = popNorm[idx] ?? 0.5;
    const marginScore = marginNorm[idx] ?? 0.5;
    const category = classify(popularityScore, marginScore);
    const { action, impact } = recommend(category, m);
    return {
      itemId: m.itemId,
      itemName: m.itemName,
      popularityScore,
      marginScore,
      category,
      recommendedAction: action,
      potentialRevenueImpact: Math.round(impact * 100) / 100,
    };
  });

  // 8. Upsert to restaurant_menu_engineering_cache
  // Delete existing rows for this tenant first (full refresh)
  const { error: delErr } = await db
    .from('restaurant_menu_engineering_cache')
    .delete()
    .eq('tenant_id', tenantId);

  if (delErr) {
    console.error(`[menu-engineering] tenant ${tenantId}: cache delete error:`, delErr.message);
    return { processed: 0, skipped: 1 };
  }

  const insertRows = engineered.map((e) => ({
    tenant_id: tenantId,
    menu_item_id: e.itemId,
    popularity_score: e.popularityScore,
    margin_score: e.marginScore,
    category: e.category,
    recommended_action: e.recommendedAction,
    potential_revenue_impact: e.potentialRevenueImpact,
  }));

  const { error: insErr } = await db
    .from('restaurant_menu_engineering_cache')
    .insert(insertRows);

  if (insErr) {
    console.error(`[menu-engineering] tenant ${tenantId}: cache insert error:`, insErr.message);
    return { processed: 0, skipped: 1 };
  }

  const categoryCounts = engineered.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    `[menu-engineering] tenant ${tenantId}: classified ${engineered.length} items —`,
    `stars=${categoryCounts['star'] ?? 0}`,
    `plowhorses=${categoryCounts['plowhorse'] ?? 0}`,
    `puzzles=${categoryCounts['puzzle'] ?? 0}`,
    `dogs=${categoryCounts['dog'] ?? 0}`,
  );

  return { processed: engineered.length, skipped: 0 };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const db = createClient(supabaseUrl, serviceKey);

  let body: RequestBody = {};
  try {
    const text = await req.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as RequestBody;
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  try {
    if (body.tenant_id) {
      // ── Single-tenant invocation (ad-hoc or testing) ──────────────────────
      const { processed, skipped } = await computeForTenant(db, body.tenant_id);
      return new Response(
        JSON.stringify({ success: true, tenant_id: body.tenant_id, processed, skipped }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── Nightly batch: all active restaurant tenants ───────────────────────
    // Identify tenants that have at least one restaurant_menu_items row
    const { data: tenants, error: tenantErr } = await db
      .from('tenants')
      .select('id')
      .returns<TenantRow[]>();

    if (tenantErr) {
      console.error('[menu-engineering] tenant list fetch error:', tenantErr.message);
      return new Response(
        JSON.stringify({ error: tenantErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const allTenants = tenants ?? [];
    let totalProcessed = 0;
    let totalSkipped = 0;

    for (const tenant of allTenants) {
      const result = await computeForTenant(db, tenant.id);
      totalProcessed += result.processed;
      totalSkipped += result.skipped;
    }

    console.log(
      `[menu-engineering] batch complete — tenants=${allTenants.length}`,
      `items_classified=${totalProcessed}`,
      `tenants_skipped=${totalSkipped}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        tenants_processed: allTenants.length,
        items_classified: totalProcessed,
        tenants_skipped: totalSkipped,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[menu-engineering] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
