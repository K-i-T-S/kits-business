/**
 * AIAssistant — Full-screen AI chat interface for restaurant management.
 *
 * Phase 2 AI Layer:
 * - Bilingual (EN/AR) chat interface with history display
 * - Language toggle in header
 * - Suggested prompts (chips) for common queries
 * - Message input with send button
 * - Chat history loaded from restaurant_ai_queries table
 * - Powered by restaurant-ai-assistant Edge Function (Claude Sonnet with tools)
 *
 * Usage: Assistant can answer data questions, draft marketing copy, recommend actions
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Globe, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import Layout from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { RESTAURANT_COLORS } from '@/constants/restaurantColors';
import {
  useChatHistory,
  useSendAIMessage,
  useClearChatHistory,
  getSuggestedPrompts,
  type AIMessage,
} from '@/hooks/useAIAssistant';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LocalMessage extends AIMessage {
  isLocal?: boolean; // For pending messages before backend persistence
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: LocalMessage;
  isUser: boolean;
}

function MessageBubble({ message, isUser }: MessageBubbleProps) {
  const bubbleVariants = {
    initial: { opacity: 0, y: 12, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -12 },
  };

  return (
    <motion.div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      variants={bubbleVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Avatar / Indicator */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: isUser ? 'rgba(99, 102, 241, 0.1)' : 'rgba(168, 85, 247, 0.1)',
          border: `1px solid ${isUser ? 'rgba(99, 102, 241, 0.2)' : 'rgba(168, 85, 247, 0.2)'}`,
        }}
      >
        {isUser ? (
          <span className="text-xs font-semibold" style={{ color: '#6366f1' }}>
            You
          </span>
        ) : (
          <Sparkles className="h-4 w-4" style={{ color: '#a855f7' }} />
        )}
      </div>

      {/* Message Content */}
      <div
        className="max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={{
          background: isUser ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${isUser ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.1)'}`,
          color: isUser ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.8)',
        }}
      >
        {/* Support markdown-like formatting */}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </motion.div>
  );
}

// ── Chat Header ────────────────────────────────────────────────────────────────

interface ChatHeaderProps {
  language: 'en' | 'ar';
  onLanguageChange: (lang: 'en' | 'ar') => void;
  onClear: () => void;
  loading: boolean;
}

function ChatHeader({ language, onLanguageChange, onClear, loading }: ChatHeaderProps) {
  const navigate = useNavigate();

  return (
    <div
      className="flex items-center justify-between gap-4 border-b px-6 py-4"
      style={{
        background: RESTAURANT_COLORS.surface,
        borderColor: RESTAURANT_COLORS.border,
      }}
    >
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => void navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:opacity-75 transition-opacity"
          style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="h-5 w-5" />
        </motion.button>

        <div className="flex flex-col gap-0">
          <h1
            className="text-lg font-bold"
            style={{ color: RESTAURANT_COLORS.textPrimary }}
          >
            {language === 'en' ? 'AI Assistant' : 'مساعد ذكي'}
          </h1>
          <p
            className="text-xs"
            style={{ color: RESTAURANT_COLORS.textTertiary }}
          >
            {language === 'en' ? 'Bilingual restaurant AI' : 'ذكاء اصطناعي ثنائي اللغة'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Language Toggle */}
        <motion.button
          onClick={() => onLanguageChange(language === 'en' ? 'ar' : 'en')}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:opacity-75 transition-opacity"
          style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={loading}
          title={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
        >
          <Globe className="h-5 w-5" />
        </motion.button>

        {/* Clear History */}
        <motion.button
          onClick={onClear}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:opacity-75 transition-opacity"
          style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={loading}
          title={language === 'en' ? 'Clear history' : 'حذف السجل'}
        >
          <Trash2 className="h-5 w-5" />
        </motion.button>
      </div>
    </div>
  );
}

// ── Suggested Prompts ──────────────────────────────────────────────────────────

interface SuggestedPromptsProps {
  language: 'en' | 'ar';
  onSelect: (prompt: string) => void;
  loading: boolean;
}

function SuggestedPrompts({ language, onSelect, loading }: SuggestedPromptsProps) {
  const prompts = getSuggestedPrompts(language);

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence>
        {prompts.map((prompt) => (
          <motion.button
            key={prompt.id}
            onClick={() => !loading && onSelect(prompt.text)}
            className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all hover:opacity-75 disabled:opacity-50"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderColor: RESTAURANT_COLORS.border,
              color: RESTAURANT_COLORS.textPrimary,
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={loading}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            {prompt.icon && <span className="text-base">{prompt.icon}</span>}
            <span>{prompt.text}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Main AI Assistant Page ─────────────────────────────────────────────────────

export default function AIAssistant() {
  const { currentTenant } = useApp();
  const { currentLanguage, changeLanguage } = useLanguage();
  const tenantId = currentTenant?.id;
  const language = (currentLanguage as 'en' | 'ar') || 'en';

  const { data: chatHistory, isLoading: historyLoading } = useChatHistory(tenantId || '');
  const sendMessage = useSendAIMessage();
  const clearHistory = useClearChatHistory();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync chat history from query
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      setMessages(chatHistory);
      setShowSuggestions(false);
    }
  }, [chatHistory]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !tenantId || sendMessage.isPending) return;

      const userMessage: LocalMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        language: language as 'en' | 'ar',
        isLocal: true,
      };

      // Add user message to UI immediately
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setShowSuggestions(false);

      // Send to AI
      const result = await sendMessage.mutateAsync({
        tenantId,
        question: text,
        language: language as 'en' | 'ar',
      });

      // Add assistant response
      if (result.success) {
        const assistantMessage: LocalMessage = {
          id: result.messageId || `local-${Date.now()}-response`,
          role: 'assistant',
          content: result.response,
          timestamp: new Date().toISOString(),
          language: language as 'en' | 'ar',
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    },
    [tenantId, sendMessage, language]
  );

  const handleSuggestedPrompt = useCallback(
    (prompt: string) => {
      void handleSendMessage(prompt);
    },
    [handleSendMessage]
  );

  const handleClearHistory = useCallback(() => {
    if (!tenantId) return;
    if (window.confirm('Clear all chat history? This cannot be undone.')) {
      void clearHistory.mutateAsync(tenantId).then(() => {
        setMessages([]);
        setShowSuggestions(true);
      });
    }
  }, [tenantId, clearHistory]);

  const handleLanguageChange = useCallback(
    (newLanguage: 'en' | 'ar') => {
      changeLanguage(newLanguage);
    },
    [changeLanguage]
  );

  if (!tenantId) {
    return <LoadingSpinner />;
  }

  const isLoading = historyLoading || sendMessage.isPending || clearHistory.isPending;

  return (
    <Layout>
      <div
        className="flex h-full flex-col"
        style={{ background: RESTAURANT_COLORS.base }}
      >
        {/* Header */}
        <ChatHeader
          language={language as 'en' | 'ar'}
          onLanguageChange={handleLanguageChange}
          onClear={handleClearHistory}
          loading={isLoading}
        />

        {/* Messages Area */}
        <div
          className="flex-1 overflow-y-auto px-6 py-6"
          style={{ background: RESTAURANT_COLORS.base }}
        >
          {messages.length === 0 ? (
            // Empty State
            <motion.div
              className="flex h-full flex-col items-center justify-center gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: RESTAURANT_COLORS.glass }}>
                <Sparkles className="h-8 w-8" style={{ color: '#a855f7' }} />
              </div>

              <div className="text-center">
                <h2
                  className="mb-2 text-xl font-bold"
                  style={{ color: RESTAURANT_COLORS.textPrimary }}
                >
                  {language === 'en' ? 'Welcome to AI Assistant' : 'أهلا بك في المساعد الذكي'}
                </h2>
                <p
                  className="text-sm"
                  style={{ color: RESTAURANT_COLORS.textTertiary }}
                >
                  {language === 'en'
                    ? 'Ask anything about your restaurant operations'
                    : 'اسأل عن أي شيء يتعلق بعملياتك في المطعم'}
                </p>
              </div>

              {/* Suggested Prompts */}
              <div className="w-full max-w-md">
                <SuggestedPrompts
                  language={language as 'en' | 'ar'}
                  onSelect={handleSuggestedPrompt}
                  loading={isLoading}
                />
              </div>
            </motion.div>
          ) : (
            // Messages
            <motion.div
              className="flex flex-col gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <AnimatePresence>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isUser={message.role === 'user'}
                  />
                ))}
              </AnimatePresence>

              {sendMessage.isPending && (
                <motion.div
                  className="flex gap-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgba(168, 85, 247, 0.1)' }}
                  >
                    <Sparkles className="h-4 w-4 animate-pulse" style={{ color: '#a855f7' }} />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span
                      className="text-xs"
                      style={{ color: RESTAURANT_COLORS.textTertiary }}
                    >
                      {language === 'en' ? 'Thinking...' : 'يفكر...'}
                    </span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: RESTAURANT_COLORS.textTertiary }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div
          className="border-t px-6 py-4"
          style={{
            background: RESTAURANT_COLORS.surface,
            borderColor: RESTAURANT_COLORS.border,
          }}
        >
          <div className="mb-4 flex gap-2">
            {messages.length > 0 && !showSuggestions && (
              <motion.button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="text-xs font-medium transition-opacity hover:opacity-75 disabled:opacity-50"
                style={{ color: RESTAURANT_COLORS.textTertiary }}
                disabled={isLoading}
              >
                {language === 'en' ? '💡 Show suggestions' : '💡 عرض الاقتراحات'}
              </motion.button>
            )}
            {messages.length > 0 && showSuggestions && (
              <div className="w-full">
                <SuggestedPrompts
                  language={language as 'en' | 'ar'}
                  onSelect={handleSuggestedPrompt}
                  loading={isLoading}
                />
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={
                language === 'en'
                  ? 'Ask me anything...'
                  : 'اسأل عن أي شيء...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                  void handleSendMessage(input);
                }
              }}
              disabled={isLoading}
              className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none disabled:opacity-50"
              style={{
                background: RESTAURANT_COLORS.elevated,
                borderColor: RESTAURANT_COLORS.border,
                color: RESTAURANT_COLORS.textPrimary,
              }}
              dir={language === 'ar' ? 'rtl' : 'ltr'}
            />

            <motion.button
              onClick={() => void handleSendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50"
              style={{
                background: input.trim() && !isLoading
                  ? 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)'
                  : RESTAURANT_COLORS.surface,
              }}
              whileHover={input.trim() && !isLoading ? { scale: 1.05 } : {}}
              whileTap={input.trim() && !isLoading ? { scale: 0.95 } : {}}
            >
              <Send className="h-5 w-5" />
            </motion.button>
          </div>

          <p
            className="mt-2 text-xs"
            style={{ color: RESTAURANT_COLORS.textTertiary }}
          >
            {language === 'en'
              ? 'Press Enter to send or click the send button'
              : 'اضغط Enter للإرسال أو انقر على زر الإرسال'}
          </p>
        </div>
      </div>
    </Layout>
  );
}
