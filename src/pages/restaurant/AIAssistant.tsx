/**
 * AIAssistant — Production AI chat interface for restaurant operations.
 *
 * Sprint 22-A:
 * - Direct Groq streaming via groqChatStream (llama-3.3-70b-versatile)
 * - Real-time token streaming with typing indicator
 * - localStorage history (last 20 messages, keyed by tenantId)
 * - Quick prompt chips
 * - Setup instructions panel when API key is absent
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Trash2, ArrowLeft, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Layout from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useApp } from '@/context/AppContext';
import { groqChatStream, type GroqMessage } from '@/utils/groqClient';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT: GroqMessage = {
  role: 'system',
  content: `You are KiTS AI, a restaurant operations assistant for Lebanese and MENA restaurants.
Help with: menu optimization, cost analysis, staff scheduling, customer insights, daily operations.
Be concise, practical, and direct. Currency in USD. Understand Lebanese cuisine and local context.`,
};

const QUICK_PROMPTS = [
  'Top dishes this week',
  'Low margin items',
  'Reduce food waste',
  'Weekend specials',
  "Today's performance",
];

const HISTORY_LIMIT = 20;

function getStorageKey(tenantId: string): string {
  return `kits-ai-chat-${tenantId}`;
}

function loadHistory(tenantId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(getStorageKey(tenantId));
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

function saveHistory(tenantId: string, messages: ChatMessage[]): void {
  try {
    const trimmed = messages.slice(-HISTORY_LIMIT);
    localStorage.setItem(getStorageKey(tenantId), JSON.stringify(trimmed));
  } catch {
    // storage may be full — ignore
  }
}

// ── Setup Instructions Panel ───────────────────────────────────────────────────

function SetupPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
        <Terminal className="h-8 w-8 text-amber-400" />
      </div>
      <div className="max-w-sm text-center">
        <h2 className="mb-2 text-xl font-bold text-white">Configure Groq API Key</h2>
        <p className="mb-6 text-sm text-white/60">
          AI Assistant requires a Groq API key to function. Add it to your environment:
        </p>
        <div className="rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-left">
          <p className="font-mono text-xs text-amber-400">
            VITE_GROQ_API_KEY=gsk_...
          </p>
        </div>
        <p className="mt-4 text-xs text-white/40">
          Add to <span className="font-mono text-white/60">.env.local</span> then restart{' '}
          <span className="font-mono text-white/60">npm run dev</span>
        </p>
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-lg bg-indigo-600/20 px-4 py-2 text-sm text-indigo-300 transition-colors hover:bg-indigo-600/30"
        >
          Get API Key at console.groq.com
        </a>
      </div>
    </div>
  );
}

// ── Typing Indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/10">
        <Sparkles className="h-4 w-4 text-purple-400" />
      </div>
      <div className="me-auto rounded-2xl rounded-es-sm bg-white/8 px-4 py-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-white/40"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-indigo-500/10' : 'bg-purple-500/10'
        }`}
      >
        {isUser ? (
          <span className="text-xs font-semibold text-indigo-400">You</span>
        ) : (
          <Sparkles className="h-4 w-4 text-purple-400" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={
          isUser
            ? 'ms-auto max-w-xs rounded-2xl rounded-ee-sm bg-indigo-600 px-4 py-2.5 text-sm text-white'
            : 'me-auto max-w-sm rounded-2xl rounded-es-sm bg-white/8 px-4 py-2.5 text-sm text-white/90'
        }
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
      </div>
    </motion.div>
  );
}

// ── Quick Prompt Chips ─────────────────────────────────────────────────────────

interface QuickPromptsProps {
  onSelect: (prompt: string) => void;
  disabled: boolean;
}

function QuickPrompts({ onSelect, disabled }: QuickPromptsProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-white/10">
      {QUICK_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          onClick={() => { if (!disabled) onSelect(prompt); }}
          disabled={disabled}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AIAssistant() {
  const { currentTenant } = useApp();
  const navigate = useNavigate();
  const tenantId = currentTenant?.id;

  const hasApiKey = Boolean(import.meta.env.VITE_GROQ_API_KEY as string | undefined);

  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    if (tenantId) {
      setMessages(loadHistory(tenantId));
    }
  }, [tenantId]);

  // Persist history when messages change
  useEffect(() => {
    if (tenantId && messages.length > 0) {
      saveHistory(tenantId, messages);
    }
  }, [tenantId, messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // ── Send ───────────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setStreaming(true);

      const aiMsgId = `a-${Date.now()}`;

      // Seed the assistant placeholder
      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, role: 'assistant', content: '' },
      ]);

      // Build context from last 10 messages + system
      setMessages((prevMessages) => {
        const ctx: GroqMessage[] = [
          SYSTEM_PROMPT,
          ...prevMessages
            .filter((m) => m.id !== aiMsgId)
            .slice(-10)
            .map((m): GroqMessage => ({ role: m.role, content: m.content })),
        ];

        void groqChatStream(
          ctx,
          (token) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: m.content + token } : m,
              ),
            );
          },
          { maxTokens: 1024 },
        )
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, content: `Sorry, I encountered an error: ${errMsg}` }
                  : m,
              ),
            );
          })
          .finally(() => {
            setStreaming(false);
            inputRef.current?.focus();
          });

        return prevMessages;
      });
    },
    [streaming],
  );

  const handleClear = useCallback(() => {
    if (!tenantId) return;
    if (window.confirm('Clear all chat history? This cannot be undone.')) {
      setMessages([]);
      localStorage.removeItem(getStorageKey(tenantId));
    }
  }, [tenantId]);

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!tenantId) return <LoadingSpinner />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="flex h-full flex-col bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900/80 px-5 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { void navigate(-1); }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-white">AI Assistant</h1>
              <p className="text-xs text-white/40">Powered by Groq · llama-3.3-70b</p>
            </div>
          </div>

          <button
            onClick={handleClear}
            disabled={messages.length === 0 || streaming}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Clear chat history"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {!hasApiKey ? (
          <SetupPanel />
        ) : (
          <>
            {/* Quick Prompts */}
            <QuickPrompts onSelect={handleSend} disabled={streaming} />

            {/* Messages */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 ? (
                <motion.div
                  className="flex h-full flex-col items-center justify-center gap-4 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10">
                    <Sparkles className="h-7 w-7 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="mb-1 text-lg font-semibold text-white">
                      Welcome to KiTS AI
                    </h2>
                    <p className="text-sm text-white/50">
                      Ask anything about your restaurant operations
                    </p>
                  </div>
                </motion.div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                </AnimatePresence>
              )}

              {streaming && messages[messages.length - 1]?.content === '' && (
                <TypingIndicator />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/10 bg-slate-900/80 px-5 py-3 backdrop-blur-sm">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Ask me anything..."
                  value={input}
                  onChange={(e) => { setInput(e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !streaming) {
                      handleSend(input);
                    }
                  }}
                  disabled={streaming}
                  className="bg-slate-800 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white flex-1 placeholder:text-white/30 focus:outline-none focus:border-indigo-500/60 disabled:opacity-50"
                />

                <button
                  onClick={() => { handleSend(input); }}
                  disabled={!input.trim() || streaming}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-white/30">Press Enter to send</p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
