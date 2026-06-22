/**
 * restaurant-ai-assistant — Supabase Edge Function
 *
 * Answers restaurant management questions using Claude Sonnet 4.6 with function calling.
 * Receives { tenantId, question, language } from AIAssistant.tsx via
 *   supabase.functions.invoke('restaurant-ai-assistant', { body: { ... } })
 *
 * Tools available to Claude:
 *   get_revenue_summary      — revenue for a date range
 *   get_top_items            — top selling items
 *   update_item_price        — update a menu item price (manager action)
 *   eighty_six_item          — mark item unavailable
 *   get_slow_alerts          — current slow table alerts
 *   get_staff_performance    — waiter metrics
 *   generate_menu_description — bilingual menu copy
 *   get_demand_forecast      — forecast data for upcoming days
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  tenantId: string;
  question: string;
  language?: 'en' | 'ar';
}

interface ToolInput {
  from?: string;
  to?: string;
  period?: string;
  metric?: string;
  limit?: number;
  itemId?: string;
  newPriceUsd?: number;
  reason?: string;
  waiterId?: string;
  itemName?: string;
  ingredients?: string[];
  cuisine?: string;
  days?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'claude-sonnet-4-5';

// ---------------------------------------------------------------------------
// Tool definitions (mirroring src/utils/restaurantAI.ts)
// ---------------------------------------------------------------------------

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_revenue_summary',
    description: 'Get revenue summary for a date range. Returns total revenue, transaction count, average check, and top revenue day.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start date in ISO format (YYYY-MM-DD)' },
        to:   { type: 'string', description: 'End date in ISO format (YYYY-MM-DD)' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'get_top_items',
    description: 'Get top selling menu items by revenue, quantity sold, or margin.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'Time period: "today", "week", "month", or ISO date range "YYYY-MM-DD:YYYY-MM-DD"' },
        metric: { type: 'string', enum: ['revenue', 'quantity', 'margin'], description: 'Sort metric' },
        limit:  { type: 'number', description: 'Number of items to return (default 5)' },
      },
      required: ['period', 'metric'],
    },
  },
  {
    name: 'update_item_price',
    description: 'Update the price of a menu item. Requires manager role. Always confirm with the user before calling this.',
    input_schema: {
      type: 'object',
      properties: {
        itemId:      { type: 'string', description: 'UUID of the menu item' },
        newPriceUsd: { type: 'number', description: 'New price in USD' },
      },
      required: ['itemId', 'newPriceUsd'],
    },
  },
  {
    name: 'eighty_six_item',
    description: 'Mark a menu item as 86\'d (unavailable). It will show as sold-out on the QR menu and KDS.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'UUID of the menu item to 86' },
        reason: { type: 'string', description: 'Optional reason for 86\'ing the item' },
      },
      required: ['itemId'],
    },
  },
  {
    name: 'get_slow_alerts',
    description: 'Get current slow table alerts — tables where orders have been waiting too long.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_staff_performance',
    description: 'Get waiter performance metrics: average check, covers served, tips, upsell rate.',
    input_schema: {
      type: 'object',
      properties: {
        period:   { type: 'string', description: 'Time period: "today", "week", "month"' },
        waiterId: { type: 'string', description: 'Optional: filter to a specific waiter UUID' },
      },
    },
  },
  {
    name: 'generate_menu_description',
    description: 'Generate an appetizing English + Arabic menu description for a menu item. Returns both languages.',
    input_schema: {
      type: 'object',
      properties: {
        itemName:    { type: 'string', description: 'Name of the menu item' },
        ingredients: { type: 'array', items: { type: 'string' }, description: 'List of main ingredients' },
        cuisine:     { type: 'string', description: 'Cuisine type (e.g., "Lebanese", "Italian", "American")' },
      },
      required: ['itemName', 'ingredients'],
    },
  },
  {
    name: 'get_demand_forecast',
    description: 'Get AI demand forecast for upcoming days: predicted covers, revenue, staffing recommendation, and prep list.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to forecast ahead (1-7)' },
      },
      required: ['days'],
    },
  },
];

// ---------------------------------------------------------------------------
// Supabase tool execution
// ---------------------------------------------------------------------------

async function executeTool(
  toolName: string,
  input: ToolInput,
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_revenue_summary': {
        const { from, to } = input;
        const { data, error } = await supabase
          .from('table_orders')
          .select('total_amount, created_at, covers')
          .eq('tenant_id', tenantId)
          .eq('status', 'closed')
          .gte('created_at', `${from}T00:00:00Z`)
          .lte('created_at', `${to}T23:59:59Z`);

        if (error) return `Error fetching revenue: ${error.message}`;
        if (!data || data.length === 0) return `No closed orders found between ${from} and ${to}.`;

        const total = data.reduce((sum: number, o: { total_amount: number }) => sum + (o.total_amount ?? 0), 0);
        const covers = data.reduce((sum: number, o: { covers: number }) => sum + (o.covers ?? 0), 0);
        const avgCheck = covers > 0 ? total / covers : 0;

        return JSON.stringify({
          from,
          to,
          totalRevenue: total.toFixed(2),
          transactionCount: data.length,
          totalCovers: covers,
          averageCheck: avgCheck.toFixed(2),
        });
      }

      case 'get_top_items': {
        const { period = 'week', metric = 'revenue', limit = 5 } = input;
        let fromDate: string;
        const now = new Date();

        if (period === 'today') {
          fromDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        } else if (period === 'week') {
          fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (period === 'month') {
          fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        } else {
          // ISO range "YYYY-MM-DD:YYYY-MM-DD"
          fromDate = period.split(':')[0] + 'T00:00:00Z';
        }

        const { data, error } = await supabase
          .from('restaurant_order_items')
          .select('item_name, quantity, unit_price, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', fromDate);

        if (error) return `Error fetching items: ${error.message}`;
        if (!data || data.length === 0) return 'No order items found for the specified period.';

        // Aggregate by item name
        const aggregated: Record<string, { name: string; qty: number; revenue: number }> = {};
        for (const item of data as Array<{ item_name: string; quantity: number; unit_price: number }>) {
          const key = item.item_name;
          if (!aggregated[key]) aggregated[key] = { name: key, qty: 0, revenue: 0 };
          aggregated[key].qty += item.quantity ?? 1;
          aggregated[key].revenue += (item.unit_price ?? 0) * (item.quantity ?? 1);
        }

        const sorted = Object.values(aggregated)
          .sort((a, b) => metric === 'quantity' ? b.qty - a.qty : b.revenue - a.revenue)
          .slice(0, limit ?? 5);

        return JSON.stringify({ period, metric, items: sorted });
      }

      case 'update_item_price': {
        const { itemId, newPriceUsd } = input;
        const { error } = await supabase
          .from('restaurant_menu_items')
          .update({ price: newPriceUsd })
          .eq('id', itemId)
          .eq('tenant_id', tenantId);

        if (error) return `Error updating price: ${error.message}`;
        return `Successfully updated item ${itemId} price to $${newPriceUsd} USD.`;
      }

      case 'eighty_six_item': {
        const { itemId, reason } = input;
        const { error } = await supabase
          .from('restaurant_menu_items')
          .update({ is_available: false, unavailable_reason: reason ?? '86\'d by manager' })
          .eq('id', itemId)
          .eq('tenant_id', tenantId);

        if (error) return `Error 86\'ing item: ${error.message}`;
        return `Item ${itemId} has been marked as unavailable (86\'d). Reason: ${reason ?? 'Not specified'}.`;
      }

      case 'get_slow_alerts': {
        const { data, error } = await supabase
          .from('table_orders')
          .select('id, table_id, created_at, covers, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'open')
          .order('created_at', { ascending: true });

        if (error) return `Error fetching orders: ${error.message}`;
        if (!data || data.length === 0) return 'No open orders currently.';

        const now = Date.now();
        const slow = (data as Array<{ id: string; table_id: string; created_at: string; covers: number; status: string }>)
          .map(o => ({
            orderId: o.id,
            tableId: o.table_id,
            minutesOpen: Math.floor((now - new Date(o.created_at).getTime()) / 60000),
            covers: o.covers,
          }))
          .filter(o => o.minutesOpen > 15)
          .sort((a, b) => b.minutesOpen - a.minutesOpen);

        if (slow.length === 0) return 'No slow alerts — all tables are within normal service time.';
        return JSON.stringify({ slowAlerts: slow, count: slow.length });
      }

      case 'get_staff_performance': {
        const { period = 'week', waiterId } = input;
        let fromDate: string;

        if (period === 'today') {
          fromDate = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
        } else if (period === 'week') {
          fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else {
          fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        let query = supabase
          .from('table_orders')
          .select('total_amount, covers, waiter_id, tip_amount, created_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'closed')
          .gte('created_at', fromDate);

        if (waiterId) {
          query = query.eq('waiter_id', waiterId);
        }

        const { data, error } = await query;
        if (error) return `Error fetching staff performance: ${error.message}`;
        if (!data || data.length === 0) return `No closed orders found for the period.`;

        // Aggregate by waiter
        const byWaiter: Record<string, { orders: number; revenue: number; covers: number; tips: number }> = {};
        for (const o of data as Array<{ waiter_id: string; total_amount: number; covers: number; tip_amount: number }>) {
          const wid = o.waiter_id ?? 'unknown';
          if (!byWaiter[wid]) byWaiter[wid] = { orders: 0, revenue: 0, covers: 0, tips: 0 };
          byWaiter[wid].orders++;
          byWaiter[wid].revenue += o.total_amount ?? 0;
          byWaiter[wid].covers += o.covers ?? 0;
          byWaiter[wid].tips += o.tip_amount ?? 0;
        }

        const results = Object.entries(byWaiter).map(([wid, stats]) => ({
          waiterId: wid,
          orders: stats.orders,
          totalRevenue: stats.revenue.toFixed(2),
          totalCovers: stats.covers,
          avgCheck: stats.covers > 0 ? (stats.revenue / stats.covers).toFixed(2) : '0.00',
          totalTips: stats.tips.toFixed(2),
        })).sort((a, b) => parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue));

        return JSON.stringify({ period, performance: results });
      }

      case 'generate_menu_description': {
        // This is a meta-tool: Claude generates descriptions by itself
        // We return a prompt directive so Claude knows to generate it inline
        const { itemName, ingredients = [], cuisine = 'Lebanese' } = input;
        return JSON.stringify({
          directive: 'generate_inline',
          itemName,
          ingredients,
          cuisine,
          instruction: `Generate an appetizing English description (2-3 sentences) and an Arabic translation for "${itemName}", a ${cuisine} dish with: ${ingredients.join(', ')}. The English should be evocative and appetizing. The Arabic should be a faithful, elegant translation suitable for a Lebanese restaurant menu.`,
        });
      }

      case 'get_demand_forecast': {
        const { days = 3 } = input;

        // Pull last 30 days of closed orders to build a simple day-of-week baseline
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('table_orders')
          .select('total_amount, covers, created_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'closed')
          .gte('created_at', thirtyDaysAgo);

        if (error) return `Error fetching historical data: ${error.message}`;

        // Aggregate by day-of-week (0=Sun, 6=Sat)
        const byDow: Record<number, { revenue: number; covers: number; count: number }> = {};
        for (let i = 0; i < 7; i++) byDow[i] = { revenue: 0, covers: 0, count: 0 };

        for (const o of data as Array<{ total_amount: number; covers: number; created_at: string }>) {
          const dow = new Date(o.created_at).getDay();
          byDow[dow].revenue += o.total_amount ?? 0;
          byDow[dow].covers += o.covers ?? 0;
          byDow[dow].count++;
        }

        const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const forecast = [];
        for (let d = 1; d <= Math.min(days, 7); d++) {
          const date = new Date(Date.now() + d * 24 * 60 * 60 * 1000);
          const dow = date.getDay();
          const baseline = byDow[dow];
          const weeksOfData = Math.max(baseline.count, 1);
          const predictedCovers = Math.round(baseline.covers / weeksOfData);
          const predictedRevenue = baseline.revenue / weeksOfData;

          forecast.push({
            date: date.toISOString().split('T')[0],
            dayOfWeek: DAY_NAMES[dow],
            predictedCovers,
            predictedRevenue: predictedRevenue.toFixed(2),
            confidence: baseline.count >= 3 ? 0.75 : 0.40,
            staffingRecommendation: {
              waiters: Math.max(2, Math.ceil(predictedCovers / 15)),
              kitchen: Math.max(2, Math.ceil(predictedCovers / 20)),
              argileStaff: dow >= 4 ? 2 : 1, // Fri-Sat: extra argile staff
            },
          });
        }

        return JSON.stringify({ forecast, basedOnDays: 30 });
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Tool execution error: ${message}`;
  }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(language: 'en' | 'ar', tenantName: string): string {
  const today = new Date().toISOString().split('T')[0];
  const langInstruction = language === 'ar'
    ? 'Always respond in Arabic (العربية). Use formal Lebanese Arabic for business contexts.'
    : 'Always respond in English.';

  return `You are the KiTS AI Restaurant Manager for ${tenantName}. You are an expert F&B consultant with deep knowledge of Lebanese and MENA restaurant operations.

Today is ${today}.

${langInstruction}

You have access to tools to query restaurant data and take actions. When answering questions:
1. Use tools to fetch real data before answering — never make up numbers.
2. For action tools (update_item_price, eighty_six_item), always explain what you're about to do before calling the tool.
3. Be concise and actionable. Owners and managers are busy.
4. When generating menu descriptions, produce both English and Arabic versions.
5. If data is unavailable or sparse, say so honestly and give a qualitative recommendation.

You understand Lebanese F&B context:
- USD and LBP dual currency
- Service charge (10%) and VAT (11%) common
- Argile/shisha is a significant revenue center
- Summer months (July-August) see 40% uplift from diaspora
- Ramadan shifts dining hours significantly (Iftar peak, no lunch service)
- Power outages are common — offline-first thinking matters`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse request
    const body = (await req.json()) as RequestBody;
    const { tenantId, question, language = 'en' } = body;

    if (!tenantId || !question) {
      return new Response(
        JSON.stringify({ error: 'tenantId and question are required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Initialise clients
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch tenant name for system prompt
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    const tenantName = (tenantData as { name?: string } | null)?.name ?? 'the restaurant';
    const systemPrompt = buildSystemPrompt(language, tenantName);

    // Agentic tool-calling loop
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: question },
    ];

    let finalResponse = '';
    let iterations = 0;
    const MAX_ITERATIONS = 6; // Safety cap

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      // If Claude wants to use tools
      if (response.stop_reason === 'tool_use') {
        // Add Claude's response (with tool_use blocks) to message history
        messages.push({ role: 'assistant', content: response.content });

        // Execute all tool calls in this turn
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const result = await executeTool(
              block.name,
              block.input as ToolInput,
              supabase,
              tenantId,
            );
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        // Feed tool results back to Claude
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Claude is done (stop_reason === 'end_turn')
      const textBlock = response.content.find(b => b.type === 'text');
      finalResponse = textBlock && 'text' in textBlock ? textBlock.text : '';
      break;
    }

    if (!finalResponse) {
      finalResponse = language === 'ar'
        ? 'عذراً، لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى.'
        : 'I was unable to generate a response. Please try again.';
    }

    return new Response(
      JSON.stringify({ response: finalResponse, language }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('restaurant-ai-assistant error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
