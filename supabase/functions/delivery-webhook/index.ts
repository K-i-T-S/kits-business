import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
}

interface DeliveryWebhookPayload {
  tenant_id: string;
  branch_id?: string;
  platform: string;
  order_id: string;
  customer_name?: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  notes?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json() as DeliveryWebhookPayload

    if (!body.tenant_id || !body.platform || !body.order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: tenant_id, platform, order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validPlatforms = ['toters', 'zomato', 'talabat', 'careem_food']
    if (!validPlatforms.includes(body.platform)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalise items to JSONB-compatible format
    const normalisedItems = body.items.map((item) => ({
      name: item.name,
      quantity: item.qty,
      unit_price: item.price,
      notes: '',
      modifiers: [],
    }))

    const { data, error } = await supabase.rpc('inject_delivery_order', {
      p_tenant_id: body.tenant_id,
      p_branch_id: body.branch_id ?? null,
      p_platform: body.platform,
      p_external_order_id: body.order_id,
      p_customer_name: body.customer_name ?? null,
      p_items: normalisedItems,
      p_total_usd: body.total,
      p_notes: body.notes ?? null,
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, order_id: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
