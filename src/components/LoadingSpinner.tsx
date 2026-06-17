import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

export const LoadingSpinner = memo<{ message?: string }>(({ message }) => {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading application"
    >
      <div className="text-center">
        <div
          className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"
          aria-hidden="true"
        ></div>
        <p className="text-white/60">{message || t('common.loading')}</p>
      </div>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';
