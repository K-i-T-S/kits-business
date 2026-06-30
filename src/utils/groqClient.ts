/**
 * groqClient — Thin fetch wrapper for the Groq OpenAI-compatible API.
 *
 * Model: llama-3.3-70b-versatile
 * Endpoint: https://api.groq.com/openai/v1/chat/completions
 *
 * Usage:
 *   import { groqChat, groqChatStream } from '@/utils/groqClient';
 */

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqAPIResponse {
  choices: Array<{ message: { role: string; content: string }; finish_reason: string }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface GroqStreamChunk {
  choices: Array<{ delta: { content?: string } }>;
}

/**
 * Single-shot chat completion. Returns the assistant's reply as a string.
 */
export async function groqChat(
  messages: GroqMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: opts?.maxTokens ?? 1024,
      temperature: opts?.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const e = await res.text();
    throw new Error(`Groq error ${res.status}: ${e}`);
  }

  const data = (await res.json()) as GroqAPIResponse;
  return data.choices[0]?.message.content ?? '';
}

/**
 * Streaming chat completion. Calls `onToken` for each incremental token.
 */
export async function groqChatStream(
  messages: GroqMessage[],
  onToken: (token: string) => void,
  opts?: { maxTokens?: number },
): Promise<void> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY not configured');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: opts?.maxTokens ?? 1024,
      stream: true,
    }),
  });

  if (!res.ok) throw new Error(`Groq stream error ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) return;

  const dec = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = dec.decode(value).split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const raw = line.slice(6);
      if (raw === '[DONE]') return;

      try {
        const chunk = JSON.parse(raw) as GroqStreamChunk;
        const tok = chunk.choices[0]?.delta.content;
        if (tok) onToken(tok);
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}
