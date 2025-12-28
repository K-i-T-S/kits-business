import React, { createContext, useContext, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';
import { log } from '../utils/logger';

export interface TranslationKey {
  key: string;
  namespace?: string;
  description?: string;
  context?: string;
}

export interface MissingTranslation {
  key: string;
  language: string;
  namespace?: string;
  timestamp: Date;
  context?: string;
}

export interface TranslationStats {
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  completionPercentage: number;
  language: string;
}

interface TranslationContextType {
  // Translation management
  addTranslation: (key: string, value: string, language?: string, namespace?: string) => void;
  updateTranslation: (key: string, value: string, language?: string, namespace?: string) => void;
  deleteTranslation: (key: string, language?: string, namespace?: string) => void;
  
  // Missing translations tracking
  missingTranslations: MissingTranslation[];
  addMissingTranslation: (key: string, language: string, namespace?: string, context?: string) => void;
  clearMissingTranslations: () => void;
  
  // Translation statistics
  getTranslationStats: (language?: string) => TranslationStats[];
  exportTranslations: (language?: string) => Record<string, any>;
  importTranslations: (translations: Record<string, any>, language?: string) => void;
  
  // Translation validation
  validateTranslations: (language?: string) => { valid: boolean; errors: string[] };
  findUnusedKeys: () => string[];
  
  // Search and filter
  searchTranslations: (query: string, language?: string) => TranslationKey[];
  
  // Auto-translation (placeholder for future integration)
  suggestTranslation: (key: string, targetLanguage: string, sourceLanguage?: string) => Promise<string>;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const useTranslationManager = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslationManager must be used within a TranslationProvider');
  }
  return context;
};

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [missingTranslations, setMissingTranslations] = useState<MissingTranslation[]>([]);

  // Add a new translation
  const addTranslation = useCallback((
    key: string, 
    value: string, 
    language: string = i18n.language, 
    namespace?: string
  ) => {
    const ns = namespace || 'translation';
    const resources = i18n.getResourceBundle(language, ns);
    if (!resources) {
      i18n.addResourceBundle(language, ns, {});
    }
    
    i18n.addResource(language, ns, key, value);
    
    // Remove from missing translations if it exists
    setMissingTranslations(prev => 
      prev.filter(mt => 
        !(mt.key === key && mt.language === language && mt.namespace === namespace)
      )
    );
  }, [i18n]);

  // Update an existing translation
  const updateTranslation = useCallback((
    key: string, 
    value: string, 
    language: string = i18n.language, 
    namespace?: string
  ) => {
    const ns = namespace || 'translation';
    i18n.addResource(language, ns, key, value, { silent: false });
  }, [i18n]);

  // Delete a translation
  const deleteTranslation = useCallback((
    key: string, 
    language: string = i18n.language, 
    namespace?: string
  ) => {
    const ns = namespace || 'translation';
    const resources = i18n.getResourceBundle(language, ns);
    if (resources && resources[key]) {
      delete resources[key];
      i18n.addResourceBundle(language, ns, resources, true);
    }
  }, [i18n]);

  // Track missing translations
  const addMissingTranslation = useCallback((
    key: string, 
    language: string, 
    namespace?: string, 
    context?: string
  ) => {
    const missing: MissingTranslation = {
      key,
      language,
      namespace,
      timestamp: new Date(),
      context
    };
    
    setMissingTranslations(prev => {
      const exists = prev.some(mt => 
        mt.key === key && mt.language === language && mt.namespace === namespace
      );
      if (!exists) {
        return [...prev, missing];
      }
      return prev;
    });
  }, []);

  // Clear missing translations
  const clearMissingTranslations = useCallback(() => {
    setMissingTranslations([]);
  }, []);

  // Get translation statistics
  const getTranslationStats = useCallback((language?: string): TranslationStats[] => {
    const languages = language ? [language] : supportedLanguages.map(lang => lang.code);
    const stats: TranslationStats[] = [];
    
    // Get all keys from the base language (English)
    const baseResources = i18n.getResourceBundle('en', 'translation') || {};
    const allKeys = Object.keys(baseResources);
    
    languages.forEach(lang => {
      const resources = i18n.getResourceBundle(lang, 'translation') || {};
      const translatedKeys = Object.keys(resources).filter(key => resources[key]);
      const missingKeys = allKeys.filter(key => !resources[key]);
      
      stats.push({
        totalKeys: allKeys.length,
        translatedKeys: translatedKeys.length,
        missingKeys: missingKeys.length,
        completionPercentage: Math.round((translatedKeys.length / allKeys.length) * 100),
        language: lang
      });
    });
    
    return stats;
  }, [i18n]);

  // Export translations
  const exportTranslations = useCallback((language?: string): Record<string, any> => {
    const languages = language ? [language] : supportedLanguages.map(lang => lang.code);
    const exported: Record<string, any> = {};
    
    languages.forEach(lang => {
      const resources = i18n.getResourceBundle(lang, 'translation');
      if (resources) {
        exported[lang] = resources;
      }
    });
    
    return exported;
  }, [i18n]);

  // Import translations
  const importTranslations = useCallback((
    translations: Record<string, any>, 
    language?: string
  ) => {
    Object.entries(translations).forEach(([lang, resources]) => {
      if (!language || lang === language) {
        i18n.addResourceBundle(lang, 'translation', resources, true, true);
      }
    });
  }, [i18n]);

  // Validate translations
  const validateTranslations = useCallback((language?: string): { valid: boolean; errors: string[] } => {
    const languages = language ? [language] : supportedLanguages.map(lang => lang.code);
    const errors: string[] = [];
    
    // Get all keys from the base language
    const baseResources = i18n.getResourceBundle('en', 'translation') || {};
    const allKeys = Object.keys(baseResources);
    
    languages.forEach(lang => {
      const resources = i18n.getResourceBundle(lang, 'translation') || {};
      
      allKeys.forEach(key => {
        if (!resources[key]) {
          errors.push(`Missing translation for key "${key}" in language "${lang}"`);
        } else if (typeof resources[key] !== 'string') {
          errors.push(`Invalid translation type for key "${key}" in language "${lang}"`);
        }
      });
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }, [i18n]);

  // Find unused translation keys
  const findUnusedKeys = useCallback((): string[] => {
    // This is a placeholder - in a real implementation, you would:
    // 1. Scan the codebase for translation key usage
    // 2. Compare with available keys
    // 3. Return keys that are not used
    
    const baseResources = i18n.getResourceBundle('en', 'translation') || {};
    const allKeys = Object.keys(baseResources);
    
    // For now, return empty array - this would need code analysis
    return [];
  }, [i18n]);

  // Search translations
  const searchTranslations = useCallback((
    query: string, 
    language?: string
  ): TranslationKey[] => {
    const languages = language ? [language] : supportedLanguages.map(lang => lang.code);
    const results: TranslationKey[] = [];
    
    languages.forEach(lang => {
      const resources = i18n.getResourceBundle(lang, 'translation') || {};
      
      Object.entries(resources).forEach(([key, value]) => {
        if (
          key.toLowerCase().includes(query.toLowerCase()) ||
          (typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase()))
        ) {
          results.push({
            key,
            namespace: 'translation',
            description: `Found in ${lang}`,
            context: lang
          });
        }
      });
    });
    
    return results;
  }, [i18n]);

  // Auto-translation suggestion (placeholder for future integration)
  const suggestTranslation = useCallback(async (
    key: string, 
    targetLanguage: string, 
    sourceLanguage: string = 'en'
  ): Promise<string> => {
    // This is a placeholder for future integration with translation APIs
    // For now, return the key as a fallback
    log.debug(`Auto-translation not implemented yet. Key: ${key}, Target: ${targetLanguage}`);
    return key;
  }, []);

  const value: TranslationContextType = {
    addTranslation,
    updateTranslation,
    deleteTranslation,
    missingTranslations,
    addMissingTranslation,
    clearMissingTranslations,
    getTranslationStats,
    exportTranslations,
    importTranslations,
    validateTranslations,
    findUnusedKeys,
    searchTranslations,
    suggestTranslation
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};
