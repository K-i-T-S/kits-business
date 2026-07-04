import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  prompt?: string;
  systemPrompt?: string;
  messages?: GroqMessage[];
  model?: string;
  maxTokens?: number;
  stream?: boolean;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimiter = new Map<string, RateLimitEntry>();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getRateLimitKey(req: Request): string {
  return req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(key);
  if (entry) {
    if (now - entry.windowStart < RATE_LIMIT_WINDOW_MS) {
      if (entry.count >= RATE_LIMIT_MAX) return false;
      entry.count++;
    } else {
      rateLimiter.set(key, { count: 1, windowStart: now });
    }
  } else {
    rateLimiter.set(key, { count: 1, windowStart: now });
  }
  return true;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!checkRateLimit(getRateLimitKey(req))) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again in an hour.' }),
      { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { prompt, systemPrompt, messages, model = DEFAULT_MODEL, maxTokens = 1024, stream = false } = body;

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    let groqMessages: GroqMessage[];
    if (messages && messages.length > 0) {
      groqMessages = messages;
    } else if (prompt) {
      groqMessages = [];
      if (systemPrompt) groqMessages.push({ role: 'system', content: systemPrompt });
      groqMessages.push({ role: 'user', content: prompt });
    } else {
      return new Response(
        JSON.stringify({ error: 'Either prompt or messages is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages: groqMessages, max_tokens: maxTokens, stream }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', errText);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (stream) {
      return new Response(groqRes.body, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    const data = (await groqRes.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const text = data.choices[0]?.message?.content?.trim() ?? '';

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('groq-proxy error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
