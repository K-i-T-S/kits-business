import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';

export const useLocalizedFormat = () => {
  const { i18n } = useTranslation();

  const formatDate = (date: string | Date, formatStr: string = 'PPP') => {
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      return format(dateObj, formatStr);
    } catch (error) {
      console.error('Date formatting error:', error);
      return String(date);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    try {
      const locale = i18n.language === 'ar' ? 'ar-SA' :
        i18n.language === 'zh' ? 'zh-CN' :
          i18n.language === 'es' ? 'es-ES' :
            i18n.language === 'fr' ? 'fr-FR' : 'en-US';

      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const formatNumber = (number: number, options?: Intl.NumberFormatOptions) => {
    try {
      const locale = i18n.language === 'ar' ? 'ar-SA' :
        i18n.language === 'zh' ? 'zh-CN' :
          i18n.language === 'es' ? 'es-ES' :
            i18n.language === 'fr' ? 'fr-FR' : 'en-US';

      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      console.error('Number formatting error:', error);
      return String(number);
    }
  };

  const formatPercent = (value: number, decimals: number = 1) => {
    return formatNumber(value / 100, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatRelativeTime = (date: string | Date) => {
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

      const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });

      if (diffInSeconds < 60) {
        return rtf.format(-diffInSeconds, 'second');
      } else if (diffInSeconds < 3600) {
        return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
      } else if (diffInSeconds < 86400) {
        return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
      } else if (diffInSeconds < 2592000) {
        return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
      } else if (diffInSeconds < 31536000) {
        return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
      } else {
        return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
      }
    } catch (error) {
      console.error('Relative time formatting error:', error);
      return formatDate(date);
    }
  };

  return {
    formatDate,
    formatCurrency,
    formatNumber,
    formatPercent,
    formatRelativeTime,
  };
};
