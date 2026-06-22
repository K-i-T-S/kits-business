import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Minimum number of co-occurrences to generate a rule (filter noise)
const MIN_SUPPORT = 2;
// Minimum confidence score to store a rule (0-1)
const MIN_CONFIDENCE = 0.1;
// Look back this many days of orders for association mining
const LOOKBACK_DAYS = 90;

interface OrderItem {
  order_id: string;
  menu_item_id: string;
}

interface UpsellRule {
  tenant_id: string;
  trigger_item_id: string;
  suggested_item_id: string;
  confidence: number;
  support_count: number;
}

/**
 * Compute association rules for a single tenant.
 *
 * Algorithm:
 *   1. Fetch all order items with menu_item_id set for the past LOOKBACK_DAYS.
 *   2. Group by order_id to get item sets (baskets).
 *   3. Count single-item frequencies (for confidence denominator).
 *   4. Count all ordered pairs (A→B) per basket.
 *   5. confidence(A→B) = count(A∩B) / count(A)
 *   6. Filter by MIN_SUPPORT and MIN_CONFIDENCE.
 *   7. Upsert into restaurant_upsell_rules (delete stale + insert fresh).
 */
async function computeForTenant(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<{ rulesWritten: number; ordersProcessed: number }> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  const sinceIso = since.toISOString();

  // Pull order items that have a menu_item_id (null means manually typed name, skip)
  // Join through table_orders so we can filter by tenant + date
  const { data: rawItems, error: fetchErr } = await supabase
    .from('restaurant_order_items')
    .select('order_id, menu_item_id')
    .eq('tenant_id', tenantId)
    .not('menu_item_id', 'is', null)
    .gte('created_at', sinceIso);

  if (fetchErr) {
    throw new Error(`Failed to fetch order items for tenant ${tenantId}: ${fetchErr.message}`);
  }

  const items = (rawItems ?? []) as OrderItem[];

  if (items.length === 0) {
    return { rulesWritten: 0, ordersProcessed: 0 };
  }

  // Group items into baskets (order_id → Set<menu_item_id>)
  const baskets = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item.menu_item_id) continue;
    if (!baskets.has(item.order_id)) {
      baskets.set(item.order_id, new Set());
    }
    baskets.get(item.order_id)!.add(item.menu_item_id);
  }

  const ordersProcessed = baskets.size;

  // Count single-item frequency: itemCount[itemId] = number of baskets containing it
  const itemCount = new Map<string, number>();
  // Count pair frequency: pairCount["A::B"] = number of baskets containing both A and B
  const pairCount = new Map<string, number>();

  for (const basket of baskets.values()) {
    const itemArr = Array.from(basket);

    for (const itemId of itemArr) {
      itemCount.set(itemId, (itemCount.get(itemId) ?? 0) + 1);
    }

    // All ordered pairs within the basket
    for (let i = 0; i < itemArr.length; i++) {
      for (let j = 0; j < itemArr.length; j++) {
        if (i === j) continue;
        const triggerItem = itemArr[i]!;
        const suggestedItem = itemArr[j]!;
        const key = `${triggerItem}::${suggestedItem}`;
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
      }
    }
  }

  // Build rules
  const rules: UpsellRule[] = [];

  for (const [key, coCount] of pairCount.entries()) {
    if (coCount < MIN_SUPPORT) continue;

    const sepIdx = key.indexOf('::');
    const triggerId = key.slice(0, sepIdx);
    const suggestedId = key.slice(sepIdx + 2);

    const triggerFreq = itemCount.get(triggerId) ?? 0;
    if (triggerFreq === 0) continue;

    const confidence = coCount / triggerFreq;
    if (confidence < MIN_CONFIDENCE) continue;

    rules.push({
      tenant_id: tenantId,
      trigger_item_id: triggerId,
      suggested_item_id: suggestedId,
      confidence: Math.round(confidence * 100) / 100, // 2 decimal places
      support_count: coCount,
    });
  }

  if (rules.length === 0) {
    return { rulesWritten: 0, ordersProcessed };
  }

  // Delete stale rules for this tenant and replace with fresh ones
  const { error: deleteErr } = await supabase
    .from('restaurant_upsell_rules')
    .delete()
    .eq('tenant_id', tenantId);

  if (deleteErr) {
    throw new Error(`Failed to delete old upsell rules for tenant ${tenantId}: ${deleteErr.message}`);
  }

  // Batch insert in chunks of 500 to avoid payload limits
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rules.length; i += CHUNK_SIZE) {
    const chunk = rules.slice(i, i + CHUNK_SIZE);
    const { error: insertErr } = await supabase
      .from('restaurant_upsell_rules')
      .insert(chunk);

    if (insertErr) {
      throw new Error(`Failed to insert upsell rules for tenant ${tenantId}: ${insertErr.message}`);
    }
  }

  return { rulesWritten: rules.length, ordersProcessed };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Use service role to bypass RLS — this function runs as a system cron, not a user
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Optionally accept a single tenantId in the request body (for manual testing)
    let tenantIds: string[] = [];

    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json() as { tenantId?: string };
      if (body.tenantId) {
        tenantIds = [body.tenantId];
      }
    }

    // If no specific tenant, process all active restaurant tenants
    if (tenantIds.length === 0) {
      const { data: tenants, error: tenantErr } = await supabase
        .from('tenants')
        .select('id')
        .eq('industry', 'restaurant')
        .eq('onboarding_completed', true);

      if (tenantErr) {
        return new Response(
          JSON.stringify({ error: `Failed to list tenants: ${tenantErr.message}` }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      tenantIds = (tenants ?? []).map((t: { id: string }) => t.id);
    }

    // Process each tenant sequentially (avoid overwhelming the DB)
    const results: Array<{
      tenantId: string;
      status: 'ok' | 'error';
      rulesWritten?: number;
      ordersProcessed?: number;
      error?: string;
    }> = [];

    for (const tenantId of tenantIds) {
      try {
        const { rulesWritten, ordersProcessed } = await computeForTenant(supabase, tenantId);
        results.push({ tenantId, status: 'ok', rulesWritten, ordersProcessed });
        console.log(`[upsell-compute] tenant=${tenantId} orders=${ordersProcessed} rules=${rulesWritten}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[upsell-compute] tenant=${tenantId} error=${message}`);
        results.push({ tenantId, status: 'error', error: message });
      }
    }

    const totalRules = results.reduce((sum, r) => sum + (r.rulesWritten ?? 0), 0);
    const totalOrders = results.reduce((sum, r) => sum + (r.ordersProcessed ?? 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        tenantsProcessed: tenantIds.length,
        totalOrdersProcessed: totalOrders,
        totalRulesWritten: totalRules,
        results,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[upsell-compute] fatal error:', message);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
