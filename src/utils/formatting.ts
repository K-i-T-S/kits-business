import { format, parseISO } from 'date-fns';

import i18n from '../i18n';

// Locale mappings for date-fns
const dateLocales: Record<string, any> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  ar: 'ar',
  zh: 'zhCN',
};

// Currency formatters
const currencyFormatters: Record<string, Intl.NumberFormat> = {};

// Number formatters
const numberFormatters: Record<string, Intl.NumberFormat> = {};

// Date formatters
const dateFormatters: Record<string, Record<string, Intl.DateTimeFormat>> = {};

/**
 * Initialize formatters for a given language
 */
export const initializeFormatters = (language: string) => {
  // Currency formatter
  if (!currencyFormatters[language]) {
    currencyFormatters[language] = new Intl.NumberFormat(language, {
      style: 'currency',
      currency: getCurrencyForLanguage(language),
    });
  }

  // Number formatter
  if (!numberFormatters[language]) {
    numberFormatters[language] = new Intl.NumberFormat(language);
  }

  // Date formatters
  if (!dateFormatters[language]) {
    dateFormatters[language] = {
      short: new Intl.DateTimeFormat(language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      long: new Intl.DateTimeFormat(language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      time: new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      date: new Intl.DateTimeFormat(language, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }),
    };
  }
};

/**
 * Get appropriate currency for language
 */
function getCurrencyForLanguage(language: string): string {
  const currencyMap: Record<string, string> = {
    en: 'USD',
    es: 'EUR',
    fr: 'EUR',
    ar: 'SAR',
    zh: 'CNY',
  };
  return currencyMap[language] || 'USD';
}

/**
 * Format currency based on current language
 */
export const formatCurrency = (amount: number, language?: string): string => {
  const lang = language || i18n.language;
  initializeFormatters(lang);
  return currencyFormatters[lang]?.format(amount) || `$${amount.toFixed(2)}`;
};

/**
 * Format numbers based on current language
 */
export const formatNumber = (number: number, language?: string): string => {
  const lang = language || i18n.language;
  initializeFormatters(lang);
  return numberFormatters[lang]?.format(number) || number.toString();
};

/**
 * Format dates using Intl.DateTimeFormat
 */
export const formatDate = (
  date: Date | string | number,
  formatType: 'short' | 'long' | 'time' | 'date' = 'short',
  language?: string,
): string => {
  const lang = language || i18n.language;
  initializeFormatters(lang);

  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  return dateFormatters[lang]?.[formatType]?.format(dateObj) || dateObj.toLocaleDateString();
};

/**
 * Format dates using date-fns with locale support (simplified version)
 */
export const formatDateWithLocale = (
  date: Date | string | number,
  formatString: string,
  language?: string,
): string => {
  const lang = language || i18n.language;
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);

  // Use Intl.DateTimeFormat for consistent formatting across locales
  try {
    return new Intl.DateTimeFormat(lang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  } catch (error) {
    console.warn(`Locale ${lang} formatting failed, using default`);
    return dateObj.toLocaleDateString();
  }
};

/**
 * Format percentage based on current language
 */
export const formatPercentage = (value: number, decimals: number = 1, language?: string): string => {
  const lang = language || i18n.language;
  return new Intl.NumberFormat(lang, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  language?: string,
): string => {
  const lang = language || i18n.language;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  return rtf.format(value, unit);
};

/**
 * Get currency symbol for language
 */
export const getCurrencySymbol = (language?: string): string => {
  const lang = language || i18n.language;
  const formatter = new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: getCurrencyForLanguage(lang),
  });

  const parts = formatter.formatToParts(1);
  const currencyPart = parts.find(part => part.type === 'currency');
  return currencyPart?.value || '$';
};

/**
 * Format a USD amount with its LBP (or other secondary currency) equivalent.
 * Example: "$10.00 (895,000 LBP)"
 */
export function formatDualCurrency(
  usdAmount: number,
  exchangeRate: number,
  secondaryCurrency = 'LBP',
): string {
  const primary = formatCurrency(usdAmount);
  const secondary = new Intl.NumberFormat('en-LB', {
    maximumFractionDigits: 0,
  }).format(Math.round(usdAmount * exchangeRate));
  return `${primary} (${secondary} ${secondaryCurrency})`;
}

/**
 * Compute tax breakdown for a subtotal.
 * Returns subtotal, taxAmount, total, and a human-readable taxLabel.
 * Lebanese TVA is 11%; any other rate uses a generic "Tax X%" label.
 */
export function formatTaxBreakdown(
  subtotal: number,
  taxRate: number,
): {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxLabel: string;
} {
  const taxAmount = subtotal * taxRate;
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
    taxLabel: taxRate === 0.11 ? 'TVA 11%' : `Tax ${(taxRate * 100).toFixed(0)}%`,
  };
}

/**
 * Format file size based on current language
 */
export const formatFileSize = (bytes: number, language?: string): string => {
  const lang = language || i18n.language;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${formatNumber(size, lang)} ${units[unitIndex]}`;
};
