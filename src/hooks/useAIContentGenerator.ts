import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/utils/supabaseClient';

export interface AIMenuDescription {
  en: string;
  ar: string;
}

interface GenerateParams {
  itemName: string;
  ingredients: string[];
  cuisine?: string;
}

/**
 * Hook to generate bilingual menu descriptions via Claude AI
 * Calls the restaurant-ai-assistant Edge Function
 */
export function useAIContentGenerator() {
  return useMutation({
    mutationFn: async (params: GenerateParams): Promise<AIMenuDescription> => {
      const { itemName, ingredients, cuisine = 'Lebanese' } = params;

      // Call the Edge Function via Supabase
      const { data, error } = await supabase.functions.invoke('restaurant-ai-assistant', {
        body: {
          question: `Generate menu descriptions for: ${itemName}`,
          language: 'en',
          // Pass through the AI generation request
          action: 'generate_menu_description',
          params: { itemName, ingredients, cuisine },
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate descriptions');
      }

      // The Edge Function returns a response with en and ar descriptions
      // Extract them from the response
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from AI service');
      }

      // The response should contain { en: string, ar: string }
      const result = data as Record<string, unknown>;

      if (typeof result.en === 'string' && typeof result.ar === 'string') {
        return { en: result.en, ar: result.ar };
      }

      // If the response is wrapped in a content field (Claude API format)
      if (result.content) {
        const content = result.content as Array<{ type: string; text?: string }>;
        const textContent = content.find(c => c.type === 'text');
        if (textContent && textContent.text) {
          try {
            const parsed = JSON.parse(textContent.text) as AIMenuDescription;
            if (parsed.en && parsed.ar) {
              return parsed;
            }
          } catch {
            // Fall through to error
          }
        }
      }

      throw new Error('Unexpected response format from AI service');
    },
  });
}
