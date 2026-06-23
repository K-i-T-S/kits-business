import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-webhook-secret, content-type',
};

// ── Inbound order shape (normalised across platforms) ─────────────────────────

interface DeliveryOrderItem {
  name: string;
  qty: number;
  price: number;
  notes?: string;
}

interface DeliveryWebhookPayload {
  order_id: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  items: DeliveryOrderItem[];
  subtotal?: number;
  delivery_fee?: number;
  total: number;
  notes?: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const url = new URL(req.url);

    // Two accepted call patterns:
    //   1. ?integration_id=<uuid>   — preferred; platform looks up tenant automatically
    //   2. ?platform=<id>&tenant=<id> — legacy / fallback
    const integrationId = url.searchParams.get('integration_id');
    const legacyPlatform = url.searchParams.get('platform');
    const legacyTenant = url.searchParams.get('tenant');

    if (!integrationId && !(legacyPlatform && legacyTenant)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing integration_id (or platform + tenant) query param' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── Resolve integration record ──────────────────────────────────────────
    let tenantId: string;
    let branchId: string | null = null;
    let platform: string;
    let webhookSecret: string | null = null;
    let autoAccept: boolean = false;

    if (integrationId) {
      const { data: intRow, error: intErr } = await supabase
        .from('restaurant_delivery_integrations')
        .select('tenant_id, branch_id, platform, is_active, webhook_secret, auto_accept')
        .eq('id', integrationId)
        .maybeSingle();

      if (intErr || !intRow) {
        return new Response(
          JSON.stringify({ success: false, error: 'Integration not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!intRow.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: 'Integration is not active' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      tenantId = intRow.tenant_id as string;
      branchId = (intRow.branch_id as string | null) ?? null;
      platform = intRow.platform as string;
      webhookSecret = (intRow.webhook_secret as string | null) ?? null;
      autoAccept = Boolean(intRow.auto_accept);
    } else {
      // Legacy path: validate platform + tenant exist together in the table
      const validPlatforms = ['toters', 'zomato', 'talabat', 'careem_food'];
      if (!validPlatforms.includes(legacyPlatform!)) {
        return new Response(
          JSON.stringify({ success: false, error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: intRow, error: intErr } = await supabase
        .from('restaurant_delivery_integrations')
        .select('id, branch_id, is_active, webhook_secret, auto_accept')
        .eq('tenant_id', legacyTenant!)
        .eq('platform', legacyPlatform!)
        .maybeSingle();

      if (intErr || !intRow) {
        return new Response(
          JSON.stringify({ success: false, error: 'Integration not found for this tenant/platform' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!intRow.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: 'Integration is not active' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      tenantId = legacyTenant!;
      branchId = (intRow.branch_id as string | null) ?? null;
      platform = legacyPlatform!;
      webhookSecret = (intRow.webhook_secret as string | null) ?? null;
      autoAccept = Boolean(intRow.auto_accept);
    }

    // ── Verify webhook secret (if configured) ───────────────────────────────
    if (webhookSecret) {
      const provided = req.headers.get('x-webhook-secret');
      if (provided !== webhookSecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'Webhook secret mismatch' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── Parse payload ───────────────────────────────────────────────────────
    const body = await req.json() as DeliveryWebhookPayload;

    if (!body.order_id || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload must include order_id and non-empty items array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (typeof body.total !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload must include numeric total' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Normalise items ─────────────────────────────────────────────────────
    const normalisedItems = body.items.map((item) => ({
      name: item.name,
      quantity: item.qty,
      unit_price: item.price,
      notes: item.notes ?? '',
      modifiers: [],
    }));

    // ── Call inject_delivery_order RPC ──────────────────────────────────────
    // This RPC is SECURITY DEFINER and handles deduplication
    // (ON CONFLICT DO NOTHING on external_order_id) + creates the KDS table_order.
    const { data: deliveryOrderId, error: rpcErr } = await supabase.rpc('inject_delivery_order', {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_platform: platform,
      p_external_order_id: body.order_id,
      p_customer_name: body.customer_name ?? null,
      p_items: normalisedItems,
      p_total_usd: body.total,
      p_notes: body.notes ?? null,
    });

    if (rpcErr) throw rpcErr;

    if (deliveryOrderId === null) {
      // Duplicate — order already exists; return 200 (idempotent)
      return new Response(
        JSON.stringify({ success: true, duplicate: true, order_id: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── If auto_accept, mark the delivery order as accepted immediately ─────
    if (autoAccept) {
      await supabase
        .from('restaurant_delivery_orders')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', deliveryOrderId as string)
        .eq('tenant_id', tenantId);
    }

    return new Response(
      JSON.stringify({ success: true, order_id: deliveryOrderId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
