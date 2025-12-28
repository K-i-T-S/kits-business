'use client';

import { useTheme } from 'next-themes';
import type { CSSProperties } from 'react';
import type { ToasterProps } from 'sonner';
import { Toaster as Sonner } from 'sonner';

const Toaster = ({ theme: _themeProp, ...props }: ToasterProps) => {
  const { theme } = useTheme();
  const normalizedTheme: Exclude<ToasterProps['theme'], undefined> =
    (theme ?? 'system') as Exclude<ToasterProps['theme'], undefined>;

  return (
    <Sonner
      theme={normalizedTheme}
      className="toaster group"
      toastOptions={{
        style: {
          background: 'rgba(11, 15, 36, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '0.75rem',
          color: '#f8faff',
          boxShadow: '0 10px 40px rgba(2, 3, 12, 0.6)',
          backdropFilter: 'blur(12px)',
        },
        className: 'dark-toast',
      }}
      style={
        {
          '--normal-bg': 'rgba(11, 15, 36, 0.98)',
          '--normal-text': '#f8faff',
          '--normal-border': 'rgba(255, 255, 255, 0.15)',
          '--success-bg': 'rgba(16, 185, 129, 0.15)',
          '--success-border': 'rgba(16, 185, 129, 0.3)',
          '--success-text': '#10b981',
          '--error-bg': 'rgba(239, 68, 68, 0.15)',
          '--error-border': 'rgba(239, 68, 68, 0.3)',
          '--error-text': '#ef4444',
          '--warning-bg': 'rgba(245, 158, 11, 0.15)',
          '--warning-border': 'rgba(245, 158, 11, 0.3)',
          '--warning-text': '#f59e0b',
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
