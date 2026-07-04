import { supabase, getAuthHeaders } from '@/utils/supabaseClient';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1`;

export async function groqChat(
  messages: GroqMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.functions.invoke<{ text: string }>('groq-proxy', {
    body: {
      messages,
      model: 'llama-3.3-70b-versatile',
      maxTokens: opts?.maxTokens ?? 1024,
    },
  });

  if (error instanceof Error) throw error;
  if (error || !data?.text) {
    throw new Error('AI service unavailable');
  }
  return data.text;
}

export async function groqChatStream(
  messages: GroqMessage[],
  onToken: (token: string) => void,
  opts?: { maxTokens?: number },
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/groq-proxy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      model: 'llama-3.3-70b-versatile',
      maxTokens: opts?.maxTokens ?? 1024,
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
        const chunk = JSON.parse(raw) as { choices: Array<{ delta: { content?: string } }> };
        const tok = chunk.choices[0]?.delta.content;
        if (tok) onToken(tok);
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}
