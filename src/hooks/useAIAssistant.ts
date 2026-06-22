import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '../utils/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  language?: 'en' | 'ar';
}

export interface AIConversationHistory {
  tenantId: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

// ── Query Keys ─────────────────────────────────────────────────────────────────

export const aiQueryKeys = {
  chatHistory: (tenantId: string) => ['ai-chat-history', tenantId] as const,
  chatMessage: (tenantId: string, messageId: string) => ['ai-chat', tenantId, messageId] as const,
} as const;

// ── Hook: Fetch Chat History ───────────────────────────────────────────────────

export function useChatHistory(tenantId: string, options?: Partial<UseQueryOptions<AIMessage[]>>) {
  return useQuery({
    queryKey: aiQueryKeys.chatHistory(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Query chat history from restaurant_ai_queries table (if it exists)
      // For Phase 2, we may be storing this in a temporary in-memory structure
      // This will call the Edge Function to fetch persisted history
      try {
        const { data, error } = await supabase.functions.invoke('restaurant-ai-assistant', {
          body: {
            tenantId,
            action: 'get_history',
          },
        });

        if (error) {
          console.error('Error fetching chat history:', error);
          return [];
        }

        return (data.messages || []) as AIMessage[];
      } catch {
        // During Phase 2 if Edge Function isn't deployed, return empty array
        return [] as AIMessage[];
      }
    },
    enabled: !!tenantId,
    staleTime: 0, // Always fresh chat history
    ...options,
  });
}

// ── Hook: Send Message ─────────────────────────────────────────────────────────

export interface SendMessageInput {
  tenantId: string;
  question: string;
  language: 'en' | 'ar';
}

export interface SendMessageResponse {
  success: boolean;
  response: string;
  messageId?: string;
  error?: string;
}

export function useSendAIMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageInput): Promise<SendMessageResponse> => {
      const { tenantId, question, language } = input;

      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      if (!question || question.trim().length === 0) {
        throw new Error('Question cannot be empty');
      }

      try {
        const { data, error } = await supabase.functions.invoke('restaurant-ai-assistant', {
          body: {
            tenantId,
            question,
            language,
            action: 'send_message',
          },
        });

        if (error) {
          console.error('Error sending message to AI:', error);
          throw new Error(error?.message || 'Failed to send message to AI assistant');
        }

        return {
          success: true,
          response: data.response || '',
          messageId: data.messageId,
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        return {
          success: false,
          response: '',
          error: errorMessage,
        };
      }
    },
    onSuccess: (result, input) => {
      if (result.success) {
        // Invalidate chat history to refetch updated messages
        void queryClient.invalidateQueries({
          queryKey: aiQueryKeys.chatHistory(input.tenantId),
        });

        toast.success('Message sent', {
          description: 'AI assistant is thinking...',
        });
      } else {
        toast.error('Failed to send message', {
          description: result.error || 'Unknown error',
        });
      }
    },
    onError: (error: any) => {
      toast.error('Error sending message', {
        description: error?.message || 'Unknown error occurred',
      });
    },
  });
}

// ── Hook: Clear Chat History ───────────────────────────────────────────────────

export function useClearChatHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      try {
        const { error } = await supabase.functions.invoke('restaurant-ai-assistant', {
          body: {
            tenantId,
            action: 'clear_history',
          },
        });

        if (error) {
          throw error;
        }

        return { success: true };
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to clear history');
      }
    },
    onSuccess: (_, tenantId) => {
      void queryClient.invalidateQueries({
        queryKey: aiQueryKeys.chatHistory(tenantId),
      });

      toast.success('Chat history cleared');
    },
    onError: (error: any) => {
      toast.error('Failed to clear chat history', {
        description: error?.message || 'Unknown error',
      });
    },
  });
}

// ── Hook: Get Suggested Prompts ────────────────────────────────────────────────

export interface SuggestedPrompt {
  id: string;
  text: string;
  category: string;
  icon?: string;
}

export const SUGGESTED_PROMPTS_EN: SuggestedPrompt[] = [
  {
    id: 'daily-summary',
    text: 'How did we do today?',
    category: 'performance',
    icon: '📊',
  },
  {
    id: 'slow-tables',
    text: 'Which tables are slow right now?',
    category: 'operations',
    icon: '⏱️',
  },
  {
    id: '86-recommendation',
    text: 'Which items should I 86 today?',
    category: 'menu',
    icon: '🚫',
  },
  {
    id: 'promo-copy',
    text: 'Write me a Friday promo',
    category: 'marketing',
    icon: '📢',
  },
  {
    id: 'top-waiter',
    text: 'Who\'s our best waiter this week?',
    category: 'performance',
    icon: '⭐',
  },
  {
    id: 'prep-forecast',
    text: 'What should I prep for tomorrow?',
    category: 'operations',
    icon: '🍳',
  },
];

export const SUGGESTED_PROMPTS_AR: SuggestedPrompt[] = [
  {
    id: 'daily-summary',
    text: 'كيف كان أدائنا اليوم؟',
    category: 'performance',
    icon: '📊',
  },
  {
    id: 'slow-tables',
    text: 'أي طاولات بطيئة الآن؟',
    category: 'operations',
    icon: '⏱️',
  },
  {
    id: '86-recommendation',
    text: 'أي أطباق يجب أن نوقفها؟',
    category: 'menu',
    icon: '🚫',
  },
  {
    id: 'promo-copy',
    text: 'اكتب لي عرض يوم الجمعة',
    category: 'marketing',
    icon: '📢',
  },
  {
    id: 'top-waiter',
    text: 'من أفضل ويتر هذا الأسبوع؟',
    category: 'performance',
    icon: '⭐',
  },
  {
    id: 'prep-forecast',
    text: 'ماذا يجب أن أحضر للغد؟',
    category: 'operations',
    icon: '🍳',
  },
];

export function getSuggestedPrompts(language: 'en' | 'ar'): SuggestedPrompt[] {
  return language === 'ar' ? SUGGESTED_PROMPTS_AR : SUGGESTED_PROMPTS_EN;
}
