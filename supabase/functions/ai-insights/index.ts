import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10;

interface RequestBody {
  tenantId: string;
  context: {
    todayRevenue: number;
    yesterdayRevenue: number;
    todayTransactions: number;
    lowStockCount: number;
    totalProducts: number;
    totalCustomers: number;
  };
}

interface CacheEntry {
  insight: string;
  timestamp: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory cache and rate limiter (per Edge Function instance)
const insightCache = new Map<string, CacheEntry>();
const rateLimiter = new Map<string, RateLimitEntry>();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { tenantId, context } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Rate limiting
    const now = Date.now();
    const rateEntry = rateLimiter.get(tenantId);
    if (rateEntry) {
      if (now - rateEntry.windowStart < RATE_LIMIT_WINDOW_MS) {
        if (rateEntry.count >= RATE_LIMIT_MAX) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Try again in an hour.' }),
            { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
          );
        }
        rateEntry.count++;
      } else {
        rateLimiter.set(tenantId, { count: 1, windowStart: now });
      }
    } else {
      rateLimiter.set(tenantId, { count: 1, windowStart: now });
    }

    // Cache check
    const cacheKey = `${tenantId}:${JSON.stringify(context)}`;
    const cached = insightCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({ insight: cached.insight, cached: true }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const revChange = context.yesterdayRevenue > 0
      ? ((context.todayRevenue - context.yesterdayRevenue) / context.yesterdayRevenue * 100).toFixed(1)
      : null;

        const revSummary = revChange !== null ? `${revChange}% vs yesterday` : 'no prior day data';
    const prompt = `You are a concise business analyst for a Lebanese SMB. Given this data, provide ONE actionable insight in 1-2 sentences. Be direct and specific. No pleasantries.

Business data:
- Today revenue: $${context.todayRevenue.toFixed(2)} across ${context.todayTransactions} transactions (${revSummary})
- Yesterday revenue: $${context.yesterdayRevenue.toFixed(2)}
- Products: ${context.totalProducts} total, ${context.lowStockCount} low stock
- Customers: ${context.totalCustomers}

Provide a single, specific, actionable business insight.`;

    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.3,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const groqData = (await groqRes.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const insight = groqData.choices[0]?.message?.content?.trim() ?? '';

    // Cache the result
    insightCache.set(cacheKey, { insight, timestamp: now });

    return new Response(
      JSON.stringify({ insight, cached: false }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('ai-insights error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
